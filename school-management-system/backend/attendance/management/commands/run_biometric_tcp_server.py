import logging
import socket
import socketserver
from datetime import datetime as datetime_type
from http.client import HTTPMessage

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from attendance.direct_push import (
    build_secureye_http_ack,
    looks_like_http_request,
    normalize_secureye_http_event,
    parse_http_request,
)
from attendance.protocol_diagnostics import ConnectionDiagnostics
from attendance.services import (
    extract_message_frames,
    parse_tcp_xml_payload,
    process_biometric_event,
    resolve_direct_push_device,
)

logger = logging.getLogger(__name__)

_ACK_MODE_SUFFIXES = {
    'CRLF': b'\r\n',
    'NUL': b'\x00',
    'CRLF_NUL': b'\r\n\x00',
    'NO_TERMINATOR': b'',
}


def build_sbxpc_ack(payload):
    ack_template = settings.BIOMETRIC_SBXPC_ACK_TEMPLATE or settings.BIOMETRIC_SBXPC_ACK_MESSAGE
    ack_text = ack_template.replace(
        '{DeviceSerialNo}',
        str(payload.get('DeviceSerialNo', '')),
    ).replace(
        '{TransID}',
        str(payload.get('TransID', '')),
    )
    ack_bytes = ack_text.encode('utf-8')
    while ack_bytes.endswith((b'\r', b'\n', b'\x00')):
        ack_bytes = ack_bytes[:-1]

    ack_mode = settings.BIOMETRIC_SBXPC_ACK_MODE
    try:
        suffix = _ACK_MODE_SUFFIXES[ack_mode]
    except KeyError as exc:
        supported = ', '.join(_ACK_MODE_SUFFIXES)
        raise ValueError(f'Unsupported Z305 ACK mode {ack_mode!r}. Expected one of: {supported}.') from exc
    return ack_bytes + suffix


class BiometricTCPRequestHandler(socketserver.BaseRequestHandler):
    def handle(self):
        self.diagnostics = ConnectionDiagnostics(
            self.request,
            self.client_address,
            enabled=settings.BIOMETRIC_PROTOCOL_DIAGNOSTICS_ENABLED,
        )
        self._close_reason = 'server handler completed'
        self.diagnostics.log_open()
        try:
            self.request.settimeout(settings.BIOMETRIC_TCP_SOCKET_TIMEOUT)
            self._enable_tcp_keepalive()
            max_payload_bytes = settings.BIOMETRIC_TCP_MAX_PAYLOAD_BYTES
            source_ip = self.client_address[0] if self.client_address else None
            self.processed_frame_count = 0
            self._handle_push_stream(max_payload_bytes, source_ip)
        except Exception as exc:
            self._close_reason = f'server exception: {type(exc).__name__}: {exc}'
            self.diagnostics.log_socket_error(exc)
            raise
        finally:
            self.diagnostics.log_close(self._close_reason)

    def _enable_tcp_keepalive(self):
        set_socket_option = getattr(self.request, "setsockopt", None)
        if not set_socket_option:
            return
        try:
            set_socket_option(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
        except OSError as exc:
            logger.debug("Could not enable biometric TCP keepalive: %s", exc)

    @staticmethod
    def _expected_http_bytes(raw_request: bytes):
        header_end = raw_request.find(b"\r\n\r\n")
        if header_end == -1:
            return None

        header_text = raw_request[:header_end].decode("iso-8859-1", errors="ignore")
        lines = header_text.split("\r\n")
        headers = HTTPMessage()
        for line in lines[1:]:
            if ":" not in line:
                continue
            key, value = line.split(":", 1)
            headers[key.strip()] = value.strip()
        content_length = int(headers.get("Content-Length", "0") or 0)
        return header_end + 4 + content_length

    def _handle_push_stream(self, max_payload_bytes: int, source_ip: str | None):
        chunks = []
        buffer = ""
        total_bytes = 0
        raw_message_buffer = b''
        raw_message_queue = []

        while True:
            try:
                chunk = self.request.recv(4096)
            except TimeoutError:
                self._close_reason = 'server receive timeout'
                self.diagnostics.log_timeout(self.request.gettimeout() if hasattr(self.request, 'gettimeout') else 'unknown')
                break
            except OSError as exc:
                self._close_reason = f'socket error/possible peer reset: {type(exc).__name__}: {exc}'
                self.diagnostics.log_socket_error(exc)
                logger.warning("Biometric socket error from %s: %s", self.client_address, exc)
                break

            if not chunk:
                self._close_reason = 'peer sent EOF/FIN'
                break

            # Capture the exact recv() result before decoding, concatenation,
            # XML parsing, newline handling, or NUL removal.
            self.diagnostics.log_rx(chunk)
            raw_message_buffer += chunk
            while b'\x00' in raw_message_buffer:
                nul_position = raw_message_buffer.index(b'\x00')
                raw_message = raw_message_buffer[:nul_position + 1]
                raw_message_buffer = raw_message_buffer[nul_position + 1:]
                message_number = self.diagnostics.next_message(raw_message)
                raw_message_queue.append((message_number, raw_message))

            chunks.append(chunk)
            total_bytes += len(chunk)

            joined = b"".join(chunks)
            if looks_like_http_request(joined):
                if total_bytes > max_payload_bytes:
                    logger.warning(
                        "Biometric HTTP payload exceeded max size from %s; closing connection.",
                        self.client_address,
                    )
                    break
                expected_http_bytes = self._expected_http_bytes(joined)
                if expected_http_bytes is not None and len(joined) >= expected_http_bytes:
                    self._handle_http_push(joined[:expected_http_bytes], source_ip)
                    self._close_reason = 'server completed HTTP response (Connection: close)'
                    return
                continue

            buffer += chunk.decode("utf-8", errors="ignore")
            frames, buffer = extract_message_frames(buffer)
            buffered_bytes = buffer.encode("utf-8", errors="replace")
            frame_sizes = [len(frame.encode("utf-8", errors="replace")) for frame in frames]
            unrecognized_bytes = max(0, total_bytes - sum(frame_sizes) - len(buffered_bytes))
            if any(frame_size > max_payload_bytes for frame_size in frame_sizes):
                logger.warning(
                    "Biometric XML frame exceeded max size from %s; closing connection.",
                    self.client_address,
                )
                break
            if unrecognized_bytes > max_payload_bytes:
                logger.warning(
                    "Biometric XML stream contained excessive non-frame data from %s; closing connection.",
                    self.client_address,
                )
                break

            close_after_batch = False
            for frame in frames:
                if raw_message_queue:
                    message_number, raw_message = raw_message_queue.pop(0)
                else:
                    raw_message = frame.encode('utf-8', errors='replace')
                    message_number = self.diagnostics.next_message(raw_message, reconstructed=True)
                should_close = self._process_tcp_xml_frame(
                    frame,
                    source_ip,
                    message_number=message_number,
                    raw_message=raw_message,
                )
                self.processed_frame_count += 1
                if should_close is None:
                    self._close_reason = 'server closed after frame processing or TX failure'
                    return
                close_after_batch = close_after_batch or should_close

            # The size limit protects one incomplete frame, not the lifetime
            # of an established event stream.  Reset the raw accumulator after
            # complete XML documents have been removed from the text buffer.
            if frames:
                chunks = [buffered_bytes] if buffered_bytes else []
                total_bytes = len(buffered_bytes)
            if total_bytes > max_payload_bytes:
                logger.warning(
                    "Biometric XML frame exceeded max size from %s; closing connection.",
                    self.client_address,
                )
                break

            # Never discard a second complete event that arrived in the same
            # recv() call.  Honour close-after-ACK only after draining and
            # acknowledging the entire batch already received from the device.
            if close_after_batch:
                self._close_reason = 'server close-after-ACK policy'
                return

        if chunks and self.processed_frame_count == 0:
            self._log_unrecognized_payload(b"".join(chunks), source_ip)
        elif buffer.strip():
            self._log_unrecognized_payload(
                buffer.encode("utf-8", errors="replace"),
                source_ip,
                label="trailing or incomplete",
            )

    def _process_tcp_xml_frame(
        self,
        frame: str,
        source_ip: str | None,
        *,
        message_number=None,
        raw_message=None,
    ):
        try:
            payload = parse_tcp_xml_payload(frame)
            self.diagnostics.log_parsed_message(message_number, payload)
            result = process_biometric_event(
                protocol='tcp_xml',
                payload=payload,
                raw_payload=frame,
                source_ip=source_ip,
            )
            logger.info(
                "Processed biometric TCP XML event serial=%s event=%s status=%s",
                payload.get('DeviceSerialNo', ''),
                payload.get('Event', ''),
                result.get('status', 'unknown'),
            )
            is_sbxpc = bool(
                payload.get("MachineID")
                or payload.get("EventType")
                or payload.get("TerminalType")
                or payload.get("DeviceUID")
            )
            if is_sbxpc:
                ack_bytes = build_sbxpc_ack(payload)
            else:
                ack_bytes = settings.BIOMETRIC_TCP_ACK_MESSAGE.encode('utf-8')
            if ack_bytes:
                self._send_bytes(ack_bytes, message_number=message_number, label='TX ACK')
            is_authorized = result.get('device_authorized') is True
            if is_sbxpc:
                close_after_ack = settings.BIOMETRIC_SBXPC_CLOSE_AFTER_ACK or not is_authorized
            else:
                close_after_ack = settings.BIOMETRIC_TCP_CLOSE_AFTER_ACK
            if is_sbxpc and not close_after_ack:
                idle_timeout = settings.BIOMETRIC_SBXPC_IDLE_TIMEOUT_SECONDS
                self.request.settimeout(idle_timeout if idle_timeout > 0 else None)

            ack_hex = ack_bytes.hex() if ack_bytes else ""
            print(
                f"Acknowledged biometric TCP XML source={source_ip or 'unknown'} "
                f"serial={payload.get('DeviceSerialNo', '')} trans_id={payload.get('TransID', '')} "
                f"verify_mode={payload.get('VerifMode', '')} status={result.get('status', 'unknown')} "
                f"ack_hex={ack_hex} close_after_ack={close_after_ack}",
                flush=True,
            )
            return close_after_ack
        except Exception as exc:
            logger.exception("Failed to process biometric TCP XML payload from %s: %s", source_ip, exc)
            self._log_unrecognized_payload(
                frame.encode("utf-8", errors="replace"),
                source_ip,
                label="failed",
            )
            return None

    def _send_bytes(self, data: bytes, *, message_number=None, label='TX'):
        self.diagnostics.log_tx(data, message_number=message_number, label=label)
        try:
            self.request.sendall(data)
        except OSError as exc:
            self.diagnostics.log_tx_result(message_number=message_number, error=exc)
            raise
        self.diagnostics.log_tx_result(message_number=message_number)

    @staticmethod
    def _log_unrecognized_payload(raw_payload: bytes, source_ip: str | None, label="unrecognized"):
        preview_size = settings.BIOMETRIC_TCP_DIAGNOSTIC_PREVIEW_BYTES
        preview = raw_payload[:preview_size]
        text_preview = preview.decode("utf-8", errors="backslashreplace")
        logger.warning(
            "Captured %s biometric TCP payload source=%s bytes=%s text=%r hex=%s",
            label,
            source_ip or "unknown",
            len(raw_payload),
            text_preview,
            preview.hex(" "),
        )

    def _handle_http_push(self, raw_request: bytes, source_ip: str | None):
        try:
            http_request = parse_http_request(raw_request)
            payload, _body_data = normalize_secureye_http_event(http_request, source_ip=source_ip)
            device = resolve_direct_push_device(
                payload,
                source_ip=source_ip,
                integration_modes=('http_push', 'tcp_xml_push'),
                lookup_label='HTTP push',
            )

            # Some FKDATAHS101 terminals upload their complete history before
            # sending a newly-created punch. Acknowledge expired attendance
            # records without running full ORM attendance processing so the
            # terminal can catch up quickly. Today's records still follow the
            # normal matching, audit-log and attendance workflow below.
            punch_time = payload.get('punch_time')
            is_stale_timelog = False
            if payload.get('request_code') == 'realtime_glog' and punch_time:
                try:
                    punch_date = datetime_type.strptime(punch_time, '%Y-%m-%d %H:%M:%S').date()
                    is_stale_timelog = punch_date < timezone.localdate()
                except (TypeError, ValueError):
                    pass

            if is_stale_timelog:
                self._send_bytes(build_secureye_http_ack(), label='TX HTTP ACK')
                logger.info(
                    "Fast-acknowledged stale biometric HTTP log serial=%s user=%s punch_time=%s",
                    payload.get('DeviceSerialNo', ''),
                    payload.get('UserID', ''),
                    punch_time,
                )
                return

            result = process_biometric_event(
                protocol='http',
                payload=payload,
                raw_payload=raw_request.decode("utf-8", errors="ignore"),
                source_ip=source_ip,
                device=device,
            )
            print(
                f"Processed biometric HTTP push serial={payload.get('DeviceSerialNo', '')} "
                f"request_code={payload.get('request_code', '')} user={payload.get('UserID', '')} "
                f"trans_id={payload.get('TransID', '')} punch_time={payload.get('punch_time', '')} "
                f"status={result.get('status', 'unknown')}",
                flush=True,
            )
            logger.info(
                "Processed biometric HTTP push serial=%s request_code=%s user=%s trans_id=%s punch_time=%s status=%s",
                payload.get('DeviceSerialNo', ''),
                payload.get('request_code', ''),
                payload.get('UserID', ''),
                payload.get('TransID', ''),
                payload.get('punch_time', ''),
                result.get('status', 'unknown'),
            )
            self._send_bytes(build_secureye_http_ack(), label='TX HTTP ACK')
        except Exception as exc:
            logger.exception("Failed to process biometric HTTP push payload from %s: %s", source_ip, exc)
            self._send_bytes(
                b"HTTP/1.1 500 Internal Server Error\r\n"
                b"Content-Length: 5\r\n"
                b"Connection: close\r\n\r\nERROR",
                label='TX HTTP ERROR',
            )


class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


class Command(BaseCommand):
    help = "Run the production direct-push listener for biometric devices that send attendance over the internet."

    def add_arguments(self, parser):
        parser.add_argument('--host', default=settings.BIOMETRIC_TCP_HOST)
        parser.add_argument('--port', type=int, default=settings.BIOMETRIC_TCP_PORT)

    def handle(self, *args, **options):
        host = options['host']
        port = options['port']

        with ThreadedTCPServer((host, port), BiometricTCPRequestHandler) as server:
            self.stdout.write(self.style.SUCCESS(f"Biometric direct-push server listening on {host}:{port}"))
            self.stdout.write(f"Z305 ACK MODE: {settings.BIOMETRIC_SBXPC_ACK_MODE}")
            self.stdout.write(
                f"Z305 PROTOCOL DIAGNOSTICS: {settings.BIOMETRIC_PROTOCOL_DIAGNOSTICS_ENABLED}"
            )
            self.stdout.write(
                f"Z305 ACK XML: {settings.BIOMETRIC_SBXPC_ACK_TEMPLATE or settings.BIOMETRIC_SBXPC_ACK_MESSAGE!r}"
            )
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                self.stdout.write(self.style.WARNING("Biometric direct-push server stopped by user."))
