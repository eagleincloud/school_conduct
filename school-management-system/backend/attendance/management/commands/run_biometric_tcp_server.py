import logging
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
from attendance.services import (
    extract_message_frames,
    parse_tcp_xml_payload,
    process_biometric_event,
    resolve_direct_push_device,
)

logger = logging.getLogger(__name__)


class BiometricTCPRequestHandler(socketserver.BaseRequestHandler):
    def handle(self):
        self.request.settimeout(settings.BIOMETRIC_TCP_SOCKET_TIMEOUT)
        max_payload_bytes = settings.BIOMETRIC_TCP_MAX_PAYLOAD_BYTES
        source_ip = self.client_address[0] if self.client_address else None
        self._handle_push_stream(max_payload_bytes, source_ip)

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

        while True:
            try:
                chunk = self.request.recv(4096)
            except TimeoutError:
                break
            except OSError as exc:
                logger.warning("Biometric socket error from %s: %s", self.client_address, exc)
                break

            if not chunk:
                break

            chunks.append(chunk)
            total_bytes += len(chunk)
            if total_bytes > max_payload_bytes:
                logger.warning("Biometric payload exceeded max size from %s; truncating connection.", self.client_address)
                break

            joined = b"".join(chunks)
            if looks_like_http_request(joined):
                expected_http_bytes = self._expected_http_bytes(joined)
                if expected_http_bytes is not None and len(joined) >= expected_http_bytes:
                    close_after = settings.BIOMETRIC_TCP_CLOSE_AFTER_ACK
                    self._handle_http_push(
                        joined[:expected_http_bytes],
                        source_ip,
                        close_connection=close_after,
                    )
                    if close_after:
                        return
                    remainder = joined[expected_http_bytes:]
                    chunks = [remainder] if remainder else []
                    total_bytes = len(remainder)
                continue

            buffer += chunk.decode("utf-8", errors="ignore")
            frames, buffer = extract_message_frames(buffer)
            if frames:
                for frame in frames:
                    self._process_tcp_xml_frame(frame, source_ip)
                chunks = []
                total_bytes = 0
                if settings.BIOMETRIC_TCP_CLOSE_AFTER_ACK:
                    return

    def _handle_tcp_xml_push(self, raw_request: bytes, source_ip: str | None):
        buffer = raw_request.decode("utf-8", errors="ignore")
        frames, _remainder = extract_message_frames(buffer)

        for frame in frames:
            self._process_tcp_xml_frame(frame, source_ip)

    def _process_tcp_xml_frame(self, frame: str, source_ip: str | None):
        try:
            payload = parse_tcp_xml_payload(frame)
            result = process_biometric_event(
                protocol='tcp_xml',
                payload=payload,
                raw_payload=frame,
                source_ip=source_ip,
            )
            serial = payload.get('DeviceSerialNo', '')
            print(
                f"Processed biometric TCP XML event serial={serial} "
                f"event={payload.get('Event', '')} user={payload.get('UserID', '')} "
                f"status={result.get('status', 'unknown')}",
                flush=True,
            )
            logger.info(
                "Processed biometric TCP XML event serial=%s event=%s status=%s",
                serial,
                payload.get('Event', ''),
                result.get('status', 'unknown'),
            )
            ack_bytes = settings.BIOMETRIC_TCP_ACK_MESSAGE.encode("utf-8")
            self.request.sendall(ack_bytes)
        except Exception as exc:
            logger.exception("Failed to process biometric TCP XML payload from %s: %s", source_ip, exc)

    def _handle_http_push(
        self,
        raw_request: bytes,
        source_ip: str | None,
        close_connection: bool = False,
    ):
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
                self.request.sendall(build_secureye_http_ack(close_connection=close_connection))
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
            self.request.sendall(build_secureye_http_ack(close_connection=close_connection))
        except Exception as exc:
            logger.exception("Failed to process biometric HTTP push payload from %s: %s", source_ip, exc)
            self.request.sendall(
                b"HTTP/1.1 500 Internal Server Error\r\n"
                b"Content-Length: 5\r\n"
                b"Connection: close\r\n\r\nERROR"
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
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                self.stdout.write(self.style.WARNING("Biometric direct-push server stopped by user."))
