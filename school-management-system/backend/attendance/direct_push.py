import json
from datetime import datetime as datetime_type

from django.utils import timezone


HTTP_METHOD_PREFIXES = (b"GET ", b"POST ", b"PUT ", b"DELETE ", b"HEAD ", b"OPTIONS ", b"PATCH ")


def looks_like_http_request(data: bytes) -> bool:
    if not data:
        return False
    return any(data.startswith(prefix) for prefix in HTTP_METHOD_PREFIXES)


def parse_http_request(data: bytes):
    header_end = data.find(b"\r\n\r\n")
    if header_end == -1:
        raise ValueError("Incomplete HTTP request headers.")

    head = data[:header_end].decode("iso-8859-1", errors="ignore")
    body = data[header_end + 4 :]
    lines = [line for line in head.split("\r\n") if line]
    if not lines:
        raise ValueError("HTTP request line missing.")

    request_line = lines[0].split()
    if len(request_line) != 3:
        raise ValueError("Malformed HTTP request line.")

    method, path, version = request_line
    headers = {}
    for line in lines[1:]:
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        headers[key.strip().lower()] = value.strip()

    return {
        "method": method.upper(),
        "path": path,
        "version": version,
        "headers": headers,
        "body": body,
    }


def decode_secureye_json_body(body: bytes):
    if not body:
        return {}

    payload = body
    if len(payload) >= 4:
        declared_length = int.from_bytes(payload[:4], byteorder="little", signed=False)
        candidate = payload[4 : 4 + declared_length]
        if declared_length and candidate:
            payload = candidate

    payload = payload.rstrip(b"\x00").strip()
    if not payload:
        return {}

    return json.loads(payload.decode("utf-8", errors="ignore"))


def normalize_secureye_http_event(http_request: dict, source_ip: str | None = None):
    headers = http_request["headers"]
    body_data = decode_secureye_json_body(http_request["body"])
    request_code = (headers.get("request_code") or "").strip()
    event_type = "TimeLog" if request_code == "realtime_glog" else request_code or "HttpPush"

    payload = {
        "DeviceSerialNo": (headers.get("dev_id") or body_data.get("dev_id") or "").strip(),
        "Event": event_type,
        "UserID": str(body_data.get("user_id") or "").strip(),
        "VerifMode": str(body_data.get("verify_mode") or "").strip(),
        "AttendStat": str(body_data.get("io_mode") or "").strip(),
        "TransID": (headers.get("trans_id") or "").strip(),
        "terminal_id": str(body_data.get("machine_id") or body_data.get("terminal_id") or "").strip(),
        "request_code": request_code,
        "push_vendor": "secureye_http",
        "push_model": body_data.get("fk_name") or "",
        "body_json": body_data,
        "source_ip": source_ip or "",
    }

    io_time = str(body_data.get("io_time") or "").strip()
    if io_time:
        try:
            punch_dt = datetime_type.strptime(io_time, "%Y%m%d%H%M%S")
            if timezone.is_naive(punch_dt):
                punch_dt = timezone.make_aware(punch_dt, timezone.get_current_timezone())
            payload["punch_time"] = punch_dt.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            payload["punch_time_raw"] = io_time

    return payload, body_data


def build_secureye_http_ack():
    # FKDATAHS101/WS535-based terminals expect the vendor-specific
    # ``response_code`` header and an empty response body. A generic 200
    # response (or a success value in the body) does not dequeue the log.
    response_body = b""
    headers = [
        b"HTTP/1.1 200 OK",
        b"Content-Length: 0",
        b"Connection: close",
        b"Cache-Control: no-store",
        b"response_code: OK",
        b"",
        b"",
    ]
    return b"\r\n".join(headers) + response_body
