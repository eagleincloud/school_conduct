import hashlib
import itertools
import threading
from datetime import datetime


_connection_ids = itertools.count(1)
_output_lock = threading.Lock()
_retry_lock = threading.Lock()
_retry_history = {}


def _timestamp():
    return datetime.now().astimezone()


def _format_timestamp(value):
    return value.isoformat(timespec='microseconds')


def _escape_bytes(data: bytes):
    escaped = []
    for value in data:
        if value == 0:
            escaped.append(r'\x00')
        elif value == 9:
            escaped.append(r'\t')
        elif value == 10:
            escaped.append(r'\n')
        elif value == 13:
            escaped.append(r'\r')
        elif 32 <= value <= 126:
            escaped.append(chr(value))
        else:
            escaped.append(f'\\x{value:02x}')
    return ''.join(escaped)


def _utf8_view(data: bytes):
    return _escape_bytes(data.decode('utf-8', errors='backslashreplace').encode('utf-8'))


def _emit(lines):
    block = '\n'.join(str(line) for line in lines)
    with _output_lock:
        print(block, flush=True)


class ConnectionDiagnostics:
    def __init__(self, request, client_address, *, enabled=True):
        self.enabled = enabled
        self.connection_id = next(_connection_ids)
        self.opened_at = _timestamp()
        self.remote_ip = client_address[0] if client_address else 'unknown'
        self.remote_port = client_address[1] if client_address and len(client_address) > 1 else 'unknown'
        self.message_number = 0
        self.rx_operation = 0
        self.tx_operation = 0

        try:
            local_address = request.getsockname()
        except (AttributeError, OSError):
            local_address = ('unknown', 'unknown')
        self.local_ip = local_address[0] if local_address else 'unknown'
        self.local_port = local_address[1] if local_address and len(local_address) > 1 else 'unknown'

    def log_open(self):
        if not self.enabled:
            return
        _emit(
            [
                f'[{_format_timestamp(self.opened_at)}] CONNECTION OPEN',
                f'ConnectionID: {self.connection_id}',
                f'Remote: {self.remote_ip}:{self.remote_port}',
                f'Local: {self.local_ip}:{self.local_port}',
            ]
        )

    def log_close(self, reason):
        if not self.enabled:
            return
        closed_at = _timestamp()
        _emit(
            [
                f'[{_format_timestamp(closed_at)}] CONNECTION CLOSED',
                f'ConnectionID: {self.connection_id}',
                f'Remote: {self.remote_ip}:{self.remote_port}',
                f'Reason/initiator: {reason}',
                f'Duration seconds: {(closed_at - self.opened_at).total_seconds():.6f}',
            ]
        )

    def log_timeout(self, timeout_value):
        if not self.enabled:
            return
        _emit(
            [
                f'[{_format_timestamp(_timestamp())}] SOCKET TIMEOUT',
                f'ConnectionID: {self.connection_id}',
                f'Remote: {self.remote_ip}:{self.remote_port}',
                f'Timeout setting: {timeout_value}',
            ]
        )

    def log_socket_error(self, exc):
        if not self.enabled:
            return
        _emit(
            [
                f'[{_format_timestamp(_timestamp())}] SOCKET ERROR',
                f'ConnectionID: {self.connection_id}',
                f'Remote: {self.remote_ip}:{self.remote_port}',
                f'Error type: {type(exc).__name__}',
                f'Error: {exc}',
            ]
        )

    def log_rx(self, data: bytes):
        if not self.enabled:
            return
        self.rx_operation += 1
        self._log_bytes('RX', data, operation_number=self.rx_operation)

    def next_message(self, data: bytes, *, reconstructed=False):
        self.message_number += 1
        message_number = self.message_number
        if not self.enabled:
            return message_number
        now = _timestamp()
        digest = hashlib.sha256(data).hexdigest()
        nul_position = data.find(b'\x00')

        with _retry_lock:
            previous = _retry_history.get(digest)
            attempt = (previous['attempt'] + 1) if previous else 1
            _retry_history[digest] = {
                'attempt': attempt,
                'timestamp': now,
                'connection_id': self.connection_id,
            }

        _emit(
            [
                f'========== APPLICATION MESSAGE #{message_number} ==========',
                f'Timestamp: {_format_timestamp(now)}',
                f'ConnectionID: {self.connection_id}',
                f'Source: {self.remote_ip}:{self.remote_port}',
                f'Raw source: {"RECONSTRUCTED FROM XML FRAME" if reconstructed else "ORIGINAL NUL-TERMINATED TCP STREAM BYTES"}',
                f'Byte Length: {len(data)}',
                f'RX SHA256: {digest}',
                f'NUL terminator present: {"YES" if nul_position >= 0 else "NO"}',
                f'NUL position: {nul_position if nul_position >= 0 else "N/A"}',
                f'Bytes after NUL: {len(data) - nul_position - 1 if nul_position >= 0 else "N/A"}',
                f'Attempt number: {attempt}',
                '================================================',
            ]
        )

        if previous:
            _emit(
                [
                    '*** DUPLICATE / RETRY DETECTED ***',
                    f'Current timestamp: {_format_timestamp(now)}',
                    f'Previous timestamp: {_format_timestamp(previous["timestamp"])}',
                    f'Time since previous attempt: {(now - previous["timestamp"]).total_seconds():.6f} seconds',
                    f'Previous ConnectionID: {previous["connection_id"]}',
                    f'Current ConnectionID: {self.connection_id}',
                    f'RX SHA256: {digest}',
                    f'Attempt number: {attempt}',
                ]
            )
        return message_number

    def log_parsed_message(self, message_number, payload):
        if not self.enabled:
            return
        date_time = '-'.join(
            str(payload.get(key, '')) for key in ('Year', 'Month', 'Day')
        ) + ' ' + ':'.join(str(payload.get(key, '')) for key in ('Hour', 'Minute', 'Second'))
        _emit(
            [
                f'========== PARSED MESSAGE #{message_number} ==========',
                f'ConnectionID: {self.connection_id}',
                f'TerminalType: {payload.get("TerminalType", "")}',
                f'TerminalID: {payload.get("TerminalID", "")}',
                f'DeviceSerialNo: {payload.get("DeviceSerialNo", "")}',
                f'DeviceUID: {payload.get("DeviceUID", "")}',
                f'TransID: {payload.get("TransID", "")}',
                f'Event: {payload.get("Event", "")}',
                f'Date/time: {date_time}',
                f'UserID: {payload.get("UserID", "")}',
                f'AttendStat: {payload.get("AttendStat", "")}',
                f'VerifMode: {payload.get("VerifMode", "")}',
                f'APStat: {payload.get("APStat", "")}',
                f'Photo: {payload.get("Photo", "")}',
                '================================================',
            ]
        )

    def log_tx(self, data: bytes, *, message_number=None, label='TX'):
        if not self.enabled:
            return
        self.tx_operation += 1
        self._log_bytes(
            label,
            data,
            operation_number=self.tx_operation,
            message_number=message_number,
        )

    def log_tx_result(self, *, message_number=None, error=None):
        if not self.enabled:
            return
        _emit(
            [
                f'[{_format_timestamp(_timestamp())}] TX {"FAILED" if error else "COMPLETED"}',
                f'ConnectionID: {self.connection_id}',
                f'Message number: {message_number if message_number is not None else "N/A"}',
                f'Error: {error if error else "NONE"}',
            ]
        )

    def _log_bytes(self, direction, data, *, operation_number, message_number=None):
        now = _timestamp()
        digest = hashlib.sha256(data).hexdigest()
        last_bytes = data[-32:]
        nul_position = data.find(b'\x00')
        _emit(
            [
                f'========== {direction} ==========',
                f'Timestamp: {_format_timestamp(now)}',
                f'ConnectionID: {self.connection_id}',
                f'Operation number: {operation_number}',
                f'Message number: {message_number if message_number is not None else "N/A"}',
                f'Remote IP: {self.remote_ip}',
                f'Remote Port: {self.remote_port}',
                f'Byte Length: {len(data)}',
                '',
                'RAW HEX:',
                data.hex(' '),
                '',
                'RAW ESCAPED:',
                _escape_bytes(data),
                '',
                'UTF-8 VIEW:',
                _utf8_view(data),
                '',
                f'SHA256: {digest}',
                '',
                'LAST 32 BYTES HEX:',
                last_bytes.hex(' '),
                '',
                'LAST 32 BYTES ESCAPED:',
                _escape_bytes(last_bytes),
                '',
                f'NUL terminator present: {"YES" if nul_position >= 0 else "NO"}',
                f'NUL position: {nul_position if nul_position >= 0 else "N/A"}',
                f'Bytes after NUL: {len(data) - nul_position - 1 if nul_position >= 0 else "N/A"}',
                '========================',
            ]
        )
