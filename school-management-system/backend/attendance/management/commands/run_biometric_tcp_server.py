import logging
import socketserver
from http.client import HTTPMessage

from django.conf import settings
from django.core.management.base import BaseCommand

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
        raw_request = self._receive_request(max_payload_bytes)
        if not raw_request:
            return

        if looks_like_http_request(raw_request):
            self._handle_http_push(raw_request, source_ip)
            return

        self._handle_tcp_xml_push(raw_request, source_ip)

    def _receive_request(self, max_payload_bytes: int):
        chunks = []
        total_bytes = 0
        expected_http_bytes = None

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

            if looks_like_http_request(chunks[0]):
                joined = b"".join(chunks)
                if expected_http_bytes is None:
                    header_end = joined.find(b"\r\n\r\n")
                    if header_end != -1:
                        header_text = joined[:header_end].decode("iso-8859-1", errors="ignore")
                        lines = header_text.split("\r\n")
                        headers = HTTPMessage()
                        for line in lines[1:]:
                            if ":" not in line:
                                continue
                            key, value = line.split(":", 1)
                            headers[key.strip()] = value.strip()
                        content_length = int(headers.get("Content-Length", "0") or 0)
                        expected_http_bytes = header_end + 4 + content_length

                if expected_http_bytes is not None and len(joined) >= expected_http_bytes:
                    break

        return b"".join(chunks)

    def _handle_tcp_xml_push(self, raw_request: bytes, source_ip: str | None):
        ack_bytes = settings.BIOMETRIC_TCP_ACK_MESSAGE.encode("utf-8")
        buffer = raw_request.decode("utf-8", errors="ignore")
        frames, _remainder = extract_message_frames(buffer)

        for frame in frames:
            try:
                payload = parse_tcp_xml_payload(frame)
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
                self.request.sendall(ack_bytes)
            except Exception as exc:
                logger.exception("Failed to process biometric TCP XML payload from %s: %s", source_ip, exc)

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
            result = process_biometric_event(
                protocol='http',
                payload=payload,
                raw_payload=raw_request.decode("utf-8", errors="ignore"),
                source_ip=source_ip,
                device=device,
            )
            logger.info(
                "Processed biometric HTTP push serial=%s request_code=%s status=%s",
                payload.get('DeviceSerialNo', ''),
                payload.get('request_code', ''),
                result.get('status', 'unknown'),
            )
            self.request.sendall(build_secureye_http_ack())
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
