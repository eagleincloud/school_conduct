import socket
import threading
from datetime import timedelta
from unittest import mock

from django.urls import reverse
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from attendance.direct_push import decode_secureye_json_body, normalize_secureye_http_event
from attendance.management.commands.run_biometric_tcp_server import BiometricTCPRequestHandler
from attendance.models import Attendance, BiometricDevice, BiometricEventLog, TeacherAttendance
from attendance.services import (
    compute_event_fingerprint,
    extract_message_frames,
    parse_tcp_xml_payload,
    process_biometric_event,
    resolve_direct_push_device,
    resolve_tcp_device,
)
from classes.models import ClassSection, MainClass, MainSection
from students.models import StudentProfile
from tenants.models import School
from teachers.models import TeacherProfile


class BiometricDeviceApiTests(APITestCase):
    def setUp(self):
        self.school = School.objects.create(name='North Campus', school_id='NORTH')
        self.other_school = School.objects.create(name='South Campus', school_id='SOUTH')
        self.admin_user = User.objects.create_user(
            username='north-admin',
            password='pass1234',
            role='admin',
            school=self.school,
            email='north@example.com',
        )
        self.superadmin_user = User.objects.create_user(
            username='root-admin',
            password='pass1234',
            role='superadmin',
            email='root@example.com',
        )

    def test_admin_creates_device_in_own_school_scope(self):
        self.client.force_authenticate(self.admin_user)

        response = self.client.post(
            reverse('biometric-device-list-create'),
            {
                'school': self.other_school.school_id,
                'name': 'Main Gate',
                'device_ip': '192.168.0.50',
                'device_port': 4370,
                'machine_number': 1,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(BiometricDevice.objects.count(), 1)
        self.assertEqual(BiometricDevice.objects.first().school, self.school)

    def test_superadmin_filters_devices_by_school_code(self):
        device_one = BiometricDevice.objects.create(
            school=self.school,
            name='North Lobby',
            device_ip='192.168.0.10',
        )
        BiometricDevice.objects.create(
            school=self.other_school,
            name='South Lobby',
            device_ip='192.168.0.11',
        )

        self.client.force_authenticate(self.superadmin_user)
        response = self.client.get(reverse('biometric-device-list-create'), {'school': self.school.school_id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], device_one.id)


class BiometricTcpHelpersTests(SimpleTestCase):
    @staticmethod
    def _production_m50_frame(*, user_id, second, verify_mode, trans_id):
        return (
            "<Message><TerminalType>M50</TerminalType>"
            "<DeviceUID>E1E0E457-7D9A6ED8</DeviceUID>"
            "<TerminalID>4</TerminalID><DeviceSerialNo>T230700006</DeviceSerialNo>"
            f"<TransID>{trans_id}</TransID><Event>TimeLog</Event>"
            "<Year>2026</Year><Month>8</Month><Day>11</Day>"
            f"<Hour>12</Hour><Minute>21</Minute><Second>{second}</Second>"
            f"<UserID>{user_id}</UserID><AttendStat>Duty Off</AttendStat>"
            f"<VerifMode>{verify_mode}</VerifMode><Photo>No</Photo></Message>"
        )

    def test_extract_message_frames_handles_multiple_messages_and_remainder(self):
        buffer = (
            "<Message><DeviceSerialNo>A1</DeviceSerialNo></Message>"
            "<Message><DeviceSerialNo>A2</DeviceSerialNo></Message><Mess"
        )
        frames, remainder = extract_message_frames(buffer)

        self.assertEqual(len(frames), 2)
        self.assertTrue(frames[0].endswith("</Message>"))
        self.assertEqual(remainder, "<Mess")

    def test_parse_tcp_xml_payload_and_fingerprint_are_stable(self):
        raw_payload = (
            "<Message><DeviceSerialNo>T230700006</DeviceSerialNo>"
            "<Event>TimeLog</Event><UserID>2</UserID><Year>2026</Year>"
            "<Month>06</Month><Day>25</Day><Hour>16</Hour><Minute>04</Minute>"
            "<Second>22</Second></Message>"
        )
        payload = parse_tcp_xml_payload(raw_payload)

        self.assertEqual(payload['DeviceSerialNo'], 'T230700006')
        self.assertEqual(payload['Event'], 'TimeLog')
        self.assertEqual(
            compute_event_fingerprint('tcp_xml', payload),
            compute_event_fingerprint('tcp_xml', payload),
        )

    def test_verification_mode_and_attendance_state_are_part_of_event_identity(self):
        payload = parse_tcp_xml_payload(
            self._production_m50_frame(
                user_id='2',
                second='3',
                verify_mode='FP',
                trans_id='0',
            )
        )
        card_payload = {**payload, 'VerifMode': 'Card'}
        check_in_payload = {**payload, 'AttendStat': 'Duty On'}

        self.assertNotEqual(
            compute_event_fingerprint('tcp_xml', payload),
            compute_event_fingerprint('tcp_xml', card_payload),
        )
        self.assertNotEqual(
            compute_event_fingerprint('tcp_xml', payload),
            compute_event_fingerprint('tcp_xml', check_in_payload),
        )

    def test_event_identity_normalizes_verification_mode_alias(self):
        payload = parse_tcp_xml_payload(
            self._production_m50_frame(
                user_id='2',
                second='3',
                verify_mode='Card',
                trans_id='0',
            )
        )
        alias_payload = {**payload}
        alias_payload.pop('VerifMode')
        alias_payload['VerificationMode'] = 'Card'

        self.assertEqual(
            compute_event_fingerprint('tcp_xml', payload),
            compute_event_fingerprint('tcp_xml', alias_payload),
        )

    def test_extract_message_frames_accepts_sbxpc_root_and_xml_declaration(self):
        buffer = (
            'transport-noise<?xml version="1.0" encoding="utf-8"?>'
            "<SBXPCEvent><MachineID>4</MachineID><EventType>Time Log</EventType>"
            "<UserID>11</UserID></SBXPCEvent><SBX"
        )

        frames, remainder = extract_message_frames(buffer)

        self.assertEqual(len(frames), 1)
        self.assertTrue(frames[0].startswith("<?xml"))
        self.assertTrue(frames[0].endswith("</SBXPCEvent>"))
        self.assertEqual(remainder, "<SBX")

    def test_parse_sbxpc_event_normalizes_callback_fields(self):
        raw_payload = (
            "<SBXPCEvent><MachineID>4</MachineID><MachineType>M50</MachineType>"
            "<EventType>Time Log</EventType><UserID>11</UserID>"
            "<AttendanceStatus>In</AttendanceStatus>"
            "<VerificationMode>Fingerprint-based</VerificationMode>"
            "<Year>2026</Year><Month>07</Month><Day>27</Day>"
            "<Hour>09</Hour><Minute>15</Minute><Second>12</Second></SBXPCEvent>"
        )

        payload = parse_tcp_xml_payload(raw_payload)

        self.assertEqual(payload["TerminalID"], "4")
        self.assertEqual(payload["Event"], "TimeLog")
        self.assertEqual(payload["UserID"], "11")
        self.assertEqual(payload["AttendStat"], "In")
        self.assertEqual(payload["VerifMode"], "Fingerprint-based")

    def test_parse_production_m50_tcp_xml_shape(self):
        raw_payload = (
            "<Message><TerminalType>M50</TerminalType>"
            "<DeviceUID>E1E0E457-7D9A6ED8</DeviceUID>"
            "<TerminalID>4</TerminalID><DeviceSerialNo>T230700006</DeviceSerialNo>"
            "<TransID>16</TransID><Event>TimeLog</Event>"
            "<Year>2026</Year><Month>7</Month><Day>22</Day>"
            "<Hour>19</Hour><Minute>1</Minute><Second>33</Second>"
            "<UserID>3</UserID><AttendStat>Duty Off</AttendStat>"
            "<VerifMode>FP</VerifMode><JobCode>0</JobCode>"
            "<APStat>None</APStat><flags>33</flags><Photo>No</Photo></Message>"
        )

        payload = parse_tcp_xml_payload(raw_payload)

        self.assertEqual(payload["DeviceSerialNo"], "T230700006")
        self.assertEqual(payload["TerminalID"], "4")
        self.assertEqual(payload["Event"], "TimeLog")
        self.assertEqual(payload["UserID"], "3")
        self.assertEqual(payload["AttendStat"], "Duty Off")
        self.assertEqual(payload["VerifMode"], "FP")

    @override_settings(
        BIOMETRIC_TCP_ACK_MESSAGE='OK\r\n',
        BIOMETRIC_SBXPC_ACK_MESSAGE='SBXPC-OK\r\n',
        BIOMETRIC_SBXPC_CLOSE_AFTER_ACK=True,
        BIOMETRIC_TCP_CLOSE_AFTER_ACK=False,
        BIOMETRIC_TCP_DIAGNOSTIC_PREVIEW_BYTES=512,
        BIOMETRIC_TCP_SOCKET_TIMEOUT=1,
        BIOMETRIC_TCP_MAX_PAYLOAD_BYTES=65536,
    )
    def test_request_handler_uses_sbxpc_ack_profile(self):
        payload = (
            "<Message><TerminalType>M50</TerminalType>"
            "<DeviceUID>E1E0E457-7D9A6ED8</DeviceUID>"
            "<TerminalID>4</TerminalID><DeviceSerialNo>T230700006</DeviceSerialNo>"
            "<Event>TimeLog</Event><UserID>11</UserID>"
            "<Year>2026</Year><Month>07</Month>"
            "<Day>27</Day><Hour>09</Hour><Minute>15</Minute>"
            "<Second>12</Second></Message>"
        ).encode("utf-8")

        class FakeSocket:
            def __init__(self):
                self.chunks = [payload, b""]
                self.sent = []

            def settimeout(self, _value):
                pass

            def recv(self, _size):
                return self.chunks.pop(0)

            def sendall(self, data):
                self.sent.append(data)

        fake_socket = FakeSocket()
        with mock.patch(
            'attendance.management.commands.run_biometric_tcp_server.process_biometric_event',
            return_value={'status': 'processed', 'device_authorized': True},
        ) as process_event_mock:
            BiometricTCPRequestHandler(fake_socket, ('103.106.31.187', 50000), mock.Mock())

        normalized = process_event_mock.call_args.kwargs["payload"]
        self.assertEqual(normalized["TerminalID"], "4")
        self.assertEqual(normalized["Event"], "TimeLog")
        self.assertEqual(fake_socket.sent, [b"SBXPC-OK\r\n"])

    @override_settings(
        BIOMETRIC_TCP_ACK_MESSAGE='OK\r\n',
        BIOMETRIC_SBXPC_ACK_MESSAGE='SBXPC-OK\r\n',
        BIOMETRIC_SBXPC_CLOSE_AFTER_ACK=True,
        BIOMETRIC_TCP_CLOSE_AFTER_ACK=False,
        BIOMETRIC_TCP_DIAGNOSTIC_PREVIEW_BYTES=512,
        BIOMETRIC_TCP_SOCKET_TIMEOUT=1,
        BIOMETRIC_TCP_MAX_PAYLOAD_BYTES=65536,
    )
    def test_m50_drains_all_complete_frames_received_before_close(self):
        first = self._production_m50_frame(
            user_id='2', second='3', verify_mode='FP', trans_id='16'
        )
        second = self._production_m50_frame(
            user_id='3', second='18', verify_mode='Card', trans_id='17'
        )

        class FakeSocket:
            def __init__(self):
                self.chunks = [(first + second).encode('utf-8'), b'']
                self.sent = []

            def settimeout(self, _value):
                pass

            def recv(self, _size):
                return self.chunks.pop(0)

            def sendall(self, data):
                self.sent.append(data)

        fake_socket = FakeSocket()
        with mock.patch(
            'attendance.management.commands.run_biometric_tcp_server.process_biometric_event',
            return_value={'status': 'processed', 'device_authorized': True},
        ) as process_event_mock:
            BiometricTCPRequestHandler(fake_socket, ('103.106.31.187', 50000), mock.Mock())

        payloads = [call.kwargs['payload'] for call in process_event_mock.call_args_list]
        self.assertEqual([payload['VerifMode'] for payload in payloads], ['FP', 'Card'])
        self.assertEqual(fake_socket.sent, [b'SBXPC-OK\r\n', b'SBXPC-OK\r\n'])

    @override_settings(
        BIOMETRIC_TCP_ACK_MESSAGE='OK\r\n',
        BIOMETRIC_SBXPC_ACK_MESSAGE='SBXPC-OK\r\n',
        BIOMETRIC_SBXPC_CLOSE_AFTER_ACK=False,
        BIOMETRIC_SBXPC_IDLE_TIMEOUT_SECONDS=1,
        BIOMETRIC_TCP_CLOSE_AFTER_ACK=False,
        BIOMETRIC_TCP_DIAGNOSTIC_PREVIEW_BYTES=512,
        BIOMETRIC_TCP_SOCKET_TIMEOUT=0.05,
        BIOMETRIC_TCP_MAX_PAYLOAD_BYTES=65536,
    )
    def test_m50_accepts_later_rfid_punch_after_initial_socket_timeout(self):
        first_payload = self._production_m50_frame(
            user_id='2', second='3', verify_mode='FP', trans_id='16'
        ).encode('utf-8')
        second_payload = self._production_m50_frame(
            user_id='3', second='18', verify_mode='Card', trans_id='17'
        ).encode('utf-8')
        server_socket, device_socket = socket.socketpair()
        device_socket.settimeout(0.5)
        handler_errors = []

        def run_handler():
            try:
                BiometricTCPRequestHandler(
                    server_socket,
                    ('103.106.31.187', 50000),
                    mock.Mock(),
                )
            except Exception as exc:  # pragma: no cover - surfaced below
                handler_errors.append(exc)

        with mock.patch(
            'attendance.management.commands.run_biometric_tcp_server.process_biometric_event',
            return_value={'status': 'processed', 'device_authorized': True},
        ) as process_event_mock:
            handler_thread = threading.Thread(target=run_handler)
            handler_thread.start()
            try:
                device_socket.sendall(first_payload)
                first_ack = device_socket.recv(32)
                threading.Event().wait(0.1)
                device_socket.sendall(second_payload)
                second_ack = device_socket.recv(32)
            finally:
                device_socket.close()
                handler_thread.join(timeout=2)
                server_socket.close()

        self.assertFalse(handler_thread.is_alive())
        self.assertEqual(handler_errors, [])
        self.assertEqual(first_ack, b'SBXPC-OK\r\n')
        self.assertEqual(second_ack, b'SBXPC-OK\r\n')
        self.assertEqual(process_event_mock.call_count, 2)

    @override_settings(
        BIOMETRIC_TCP_ACK_MESSAGE='OK\r\n',
        BIOMETRIC_SBXPC_ACK_MESSAGE='SBXPC-OK\r\n',
        BIOMETRIC_SBXPC_CLOSE_AFTER_ACK=False,
        BIOMETRIC_SBXPC_IDLE_TIMEOUT_SECONDS=0,
        BIOMETRIC_TCP_CLOSE_AFTER_ACK=False,
        BIOMETRIC_TCP_DIAGNOSTIC_PREVIEW_BYTES=512,
        BIOMETRIC_TCP_SOCKET_TIMEOUT=1,
        BIOMETRIC_TCP_MAX_PAYLOAD_BYTES=600,
    )
    def test_m50_payload_limit_is_per_frame_not_connection_lifetime(self):
        frames = [
            self._production_m50_frame(
                user_id=str(user_id),
                second=str(user_id),
                verify_mode='Card',
                trans_id=str(user_id),
            ).encode('utf-8')
            for user_id in range(1, 6)
        ]

        class FakeSocket:
            def __init__(self):
                self.chunks = [*frames, b'']
                self.sent = []

            def settimeout(self, _value):
                pass

            def recv(self, _size):
                return self.chunks.pop(0)

            def sendall(self, data):
                self.sent.append(data)

        fake_socket = FakeSocket()
        with mock.patch(
            'attendance.management.commands.run_biometric_tcp_server.process_biometric_event',
            return_value={'status': 'processed', 'device_authorized': True},
        ) as process_event_mock:
            BiometricTCPRequestHandler(fake_socket, ('103.106.31.187', 50000), mock.Mock())

        self.assertEqual(process_event_mock.call_count, 5)
        self.assertEqual(fake_socket.sent, [b'SBXPC-OK\r\n'] * 5)

    @override_settings(
        BIOMETRIC_TCP_ACK_MESSAGE='OK\r\n',
        BIOMETRIC_SBXPC_ACK_MESSAGE='SBXPC-OK\r\n',
        BIOMETRIC_SBXPC_CLOSE_AFTER_ACK=False,
        BIOMETRIC_SBXPC_IDLE_TIMEOUT_SECONDS=86400,
        BIOMETRIC_TCP_CLOSE_AFTER_ACK=False,
        BIOMETRIC_TCP_DIAGNOSTIC_PREVIEW_BYTES=32,
        BIOMETRIC_TCP_SOCKET_TIMEOUT=1,
        BIOMETRIC_TCP_MAX_PAYLOAD_BYTES=100,
    )
    def test_m50_rejects_complete_frame_larger_than_per_frame_limit(self):
        payload = self._production_m50_frame(
            user_id='2', second='3', verify_mode='Card', trans_id='16'
        ).encode('utf-8')

        class FakeSocket:
            def __init__(self):
                self.chunks = [payload, b'']
                self.sent = []

            def settimeout(self, _value):
                pass

            def recv(self, _size):
                return self.chunks.pop(0)

            def sendall(self, data):
                self.sent.append(data)

        fake_socket = FakeSocket()
        with mock.patch(
            'attendance.management.commands.run_biometric_tcp_server.process_biometric_event'
        ) as process_event_mock:
            BiometricTCPRequestHandler(fake_socket, ('103.106.31.187', 50000), mock.Mock())

        process_event_mock.assert_not_called()
        self.assertEqual(fake_socket.sent, [])

    @override_settings(
        BIOMETRIC_TCP_ACK_MESSAGE='OK\r\n',
        BIOMETRIC_SBXPC_ACK_MESSAGE='SBXPC-OK\r\n',
        BIOMETRIC_SBXPC_CLOSE_AFTER_ACK=False,
        BIOMETRIC_SBXPC_IDLE_TIMEOUT_SECONDS=86400,
        BIOMETRIC_TCP_CLOSE_AFTER_ACK=False,
        BIOMETRIC_TCP_DIAGNOSTIC_PREVIEW_BYTES=32,
        BIOMETRIC_TCP_SOCKET_TIMEOUT=1,
        BIOMETRIC_TCP_MAX_PAYLOAD_BYTES=16,
    )
    def test_m50_rejects_non_xml_stream_over_payload_limit(self):
        class FakeSocket:
            def __init__(self):
                self.chunks = [b'x' * 10, b'y' * 10, b'not-read']
                self.recv_count = 0

            def settimeout(self, _value):
                pass

            def recv(self, _size):
                self.recv_count += 1
                return self.chunks.pop(0)

            def sendall(self, _data):
                raise AssertionError('No ACK should be sent for non-XML data.')

        fake_socket = FakeSocket()
        with mock.patch(
            'attendance.management.commands.run_biometric_tcp_server.process_biometric_event'
        ) as process_event_mock:
            BiometricTCPRequestHandler(fake_socket, ('103.106.31.187', 50000), mock.Mock())

        process_event_mock.assert_not_called()
        self.assertEqual(fake_socket.recv_count, 2)

    @override_settings(
        BIOMETRIC_TCP_ACK_MESSAGE='OK\r\n',
        BIOMETRIC_SBXPC_ACK_MESSAGE='SBXPC-OK\r\n',
        BIOMETRIC_SBXPC_CLOSE_AFTER_ACK=False,
        BIOMETRIC_SBXPC_IDLE_TIMEOUT_SECONDS=86400,
        BIOMETRIC_TCP_CLOSE_AFTER_ACK=False,
        BIOMETRIC_TCP_DIAGNOSTIC_PREVIEW_BYTES=32,
        BIOMETRIC_TCP_SOCKET_TIMEOUT=1,
        BIOMETRIC_TCP_MAX_PAYLOAD_BYTES=65536,
    )
    def test_m50_stops_batch_immediately_after_processing_failure(self):
        first = self._production_m50_frame(
            user_id='2', second='3', verify_mode='FP', trans_id='16'
        )
        second = self._production_m50_frame(
            user_id='3', second='18', verify_mode='Card', trans_id='17'
        )

        class FakeSocket:
            def __init__(self):
                self.chunks = [(first + second).encode('utf-8'), b'']
                self.sent = []

            def settimeout(self, _value):
                pass

            def recv(self, _size):
                return self.chunks.pop(0)

            def sendall(self, data):
                self.sent.append(data)

        fake_socket = FakeSocket()
        with mock.patch(
            'attendance.management.commands.run_biometric_tcp_server.process_biometric_event',
            side_effect=RuntimeError('database unavailable'),
        ) as process_event_mock:
            BiometricTCPRequestHandler(fake_socket, ('103.106.31.187', 50000), mock.Mock())

        self.assertEqual(process_event_mock.call_count, 1)
        self.assertEqual(fake_socket.sent, [])

    @override_settings(
        BIOMETRIC_TCP_ACK_MESSAGE='OK\r\n',
        BIOMETRIC_SBXPC_ACK_MESSAGE='SBXPC-OK\r\n',
        BIOMETRIC_SBXPC_CLOSE_AFTER_ACK=False,
        BIOMETRIC_SBXPC_IDLE_TIMEOUT_SECONDS=86400,
        BIOMETRIC_TCP_CLOSE_AFTER_ACK=False,
        BIOMETRIC_TCP_DIAGNOSTIC_PREVIEW_BYTES=32,
        BIOMETRIC_TCP_SOCKET_TIMEOUT=1,
        BIOMETRIC_TCP_MAX_PAYLOAD_BYTES=65536,
    )
    def test_unauthorized_m50_frame_does_not_create_persistent_socket(self):
        payload = self._production_m50_frame(
            user_id='2', second='3', verify_mode='Card', trans_id='16'
        ).encode('utf-8')

        class FakeSocket:
            def __init__(self):
                self.chunks = [payload, b'not-read']
                self.sent = []
                self.timeouts = []

            def settimeout(self, value):
                self.timeouts.append(value)

            def recv(self, _size):
                return self.chunks.pop(0)

            def sendall(self, data):
                self.sent.append(data)

        fake_socket = FakeSocket()
        with mock.patch(
            'attendance.management.commands.run_biometric_tcp_server.process_biometric_event',
            return_value={'status': 'unauthorized', 'device_authorized': False},
        ) as process_event_mock:
            BiometricTCPRequestHandler(fake_socket, ('103.106.31.187', 50000), mock.Mock())

        self.assertEqual(process_event_mock.call_count, 1)
        self.assertEqual(fake_socket.timeouts, [1])
        self.assertEqual(fake_socket.sent, [b'SBXPC-OK\r\n'])

    @override_settings(
        BIOMETRIC_TCP_ACK_MESSAGE='OK\r\n',
        BIOMETRIC_TCP_CLOSE_AFTER_ACK=False,
        BIOMETRIC_TCP_SOCKET_TIMEOUT=1,
        BIOMETRIC_TCP_MAX_PAYLOAD_BYTES=65536,
    )
    def test_request_handler_acks_complete_xml_before_peer_disconnects(self):
        payload = (
            "<Message><DeviceSerialNo>T230700006</DeviceSerialNo><TerminalID>4</TerminalID>"
            "<Event>TimeLog</Event><UserID>11</UserID><Year>2026</Year><Month>07</Month>"
            "<Day>21</Day><Hour>18</Hour><Minute>00</Minute><Second>00</Second></Message>"
        ).encode('utf-8')
        server_socket, device_socket = socket.socketpair()
        device_socket.settimeout(0.5)
        handler_errors = []

        def run_handler():
            try:
                BiometricTCPRequestHandler(
                    server_socket,
                    ('103.106.31.187', 50000),
                    mock.Mock(),
                )
            except Exception as exc:  # pragma: no cover - surfaced below
                handler_errors.append(exc)

        with mock.patch(
            'attendance.management.commands.run_biometric_tcp_server.process_biometric_event',
            return_value={'status': 'processed', 'device_authorized': True},
        ) as process_event_mock:
            handler_thread = threading.Thread(target=run_handler)
            handler_thread.start()
            try:
                device_socket.sendall(payload)
                ack = device_socket.recv(16)
            finally:
                device_socket.close()
                handler_thread.join(timeout=2)
                server_socket.close()

        self.assertFalse(handler_thread.is_alive())
        self.assertEqual(handler_errors, [])
        self.assertEqual(ack, b'OK\r\n')
        self.assertEqual(process_event_mock.call_count, 1)

    @override_settings(
        BIOMETRIC_TCP_ACK_MESSAGE='OK\r\n',
        BIOMETRIC_TCP_CLOSE_AFTER_ACK=False,
        BIOMETRIC_TCP_SOCKET_TIMEOUT=1,
        BIOMETRIC_TCP_MAX_PAYLOAD_BYTES=65536,
    )
    def test_request_handler_accepts_next_xml_message_on_same_open_socket(self):
        first_payload = (
            "<Message><DeviceSerialNo>T230700006</DeviceSerialNo><TerminalID>4</TerminalID>"
            "<Event>TimeLog</Event><UserID>11</UserID><Year>2026</Year><Month>07</Month>"
            "<Day>21</Day><Hour>18</Hour><Minute>00</Minute><Second>00</Second></Message>"
        ).encode('utf-8')
        second_payload = (
            "<Message><DeviceSerialNo>T230700006</DeviceSerialNo><TerminalID>4</TerminalID>"
            "<Event>TimeLog</Event><UserID>12</UserID><Year>2026</Year><Month>07</Month>"
            "<Day>21</Day><Hour>18</Hour><Minute>00</Minute><Second>15</Second></Message>"
        ).encode('utf-8')
        server_socket, device_socket = socket.socketpair()
        device_socket.settimeout(0.5)
        handler_errors = []

        def run_handler():
            try:
                BiometricTCPRequestHandler(
                    server_socket,
                    ('103.106.31.187', 50000),
                    mock.Mock(),
                )
            except Exception as exc:  # pragma: no cover - surfaced below
                handler_errors.append(exc)

        with mock.patch(
            'attendance.management.commands.run_biometric_tcp_server.process_biometric_event',
            return_value={'status': 'processed', 'device_authorized': True},
        ) as process_event_mock:
            handler_thread = threading.Thread(target=run_handler)
            handler_thread.start()
            try:
                device_socket.sendall(first_payload)
                first_ack = device_socket.recv(16)
                device_socket.sendall(second_payload)
                second_ack = device_socket.recv(16)
            finally:
                device_socket.close()
                handler_thread.join(timeout=2)
                server_socket.close()

        self.assertFalse(handler_thread.is_alive())
        self.assertEqual(handler_errors, [])
        self.assertEqual(first_ack, b'OK\r\n')
        self.assertEqual(second_ack, b'OK\r\n')
        self.assertEqual(process_event_mock.call_count, 2)

    @override_settings(
        BIOMETRIC_TCP_ACK_MESSAGE='OK\r\n',
        BIOMETRIC_TCP_CLOSE_AFTER_ACK=False,
        BIOMETRIC_TCP_SOCKET_TIMEOUT=1,
        BIOMETRIC_TCP_MAX_PAYLOAD_BYTES=65536,
    )
    def test_request_handler_processes_all_messages_in_same_connection(self):
        class FakeSocket:
            def __init__(self, chunks):
                self._chunks = list(chunks)
                self.sent = []
                self.timeout = None

            def settimeout(self, value):
                self.timeout = value

            def recv(self, _size):
                if self._chunks:
                    return self._chunks.pop(0)
                return b''

            def sendall(self, data):
                self.sent.append(data)

        payload = (
            "<Message><DeviceSerialNo>T230700006</DeviceSerialNo><TerminalID>4</TerminalID>"
            "<Event>TimeLog</Event><UserID>3</UserID><Year>2026</Year><Month>06</Month>"
            "<Day>29</Day><Hour>10</Hour><Minute>10</Minute><Second>04</Second></Message>"
            "<Message><DeviceSerialNo>T230700006</DeviceSerialNo><TerminalID>4</TerminalID>"
            "<Event>TimeLog</Event><UserID>4</UserID><Year>2026</Year><Month>06</Month>"
            "<Day>29</Day><Hour>10</Hour><Minute>11</Minute><Second>25</Second></Message>"
        ).encode('utf-8')
        fake_socket = FakeSocket([payload, b''])

        with mock.patch(
            'attendance.management.commands.run_biometric_tcp_server.process_biometric_event',
            return_value={'status': 'processed', 'device_authorized': True},
        ) as process_event_mock:
            BiometricTCPRequestHandler(fake_socket, ('103.106.31.187', 50000), mock.Mock())

        self.assertEqual(process_event_mock.call_count, 2)
        self.assertEqual(fake_socket.sent, [b'OK\r\n', b'OK\r\n'])

    @override_settings(BIOMETRIC_TCP_SOCKET_TIMEOUT=1, BIOMETRIC_TCP_MAX_PAYLOAD_BYTES=65536)
    def test_request_handler_processes_secureye_http_push(self):
        class FakeSocket:
            def __init__(self, chunks):
                self._chunks = list(chunks)
                self.sent = []
                self.timeout = None

            def settimeout(self, value):
                self.timeout = value

            def recv(self, _size):
                if self._chunks:
                    return self._chunks.pop(0)
                return b''

            def sendall(self, data):
                self.sent.append(data)

        io_time = timezone.localtime().strftime('%Y%m%d%H%M%S')
        body_json = (
            '{"fk_bin_data_lib":"FKDATAHS101","user_id":"1","verify_mode":"33",'
            f'"io_mode":"0","io_time":"{io_time}"}}'
        ).encode('utf-8')
        body = len(body_json).to_bytes(4, byteorder='little') + body_json + b'\x00'
        request = (
            b"POST / HTTP/1.1\r\n"
            b"Host: 13.201.53.169\r\n"
            b"Content-Type: application/octet-stream\r\n"
            b"Content-Length: " + str(len(body)).encode("ascii") + b"\r\n"
            b"request_code: realtime_glog\r\n"
            b"dev_id: 2508031064\r\n"
            b"trans_id: 0\r\n"
            b"\r\n" + body
        )
        fake_socket = FakeSocket([request, b''])

        device = mock.Mock()
        with mock.patch(
            'attendance.management.commands.run_biometric_tcp_server.resolve_direct_push_device',
            return_value=device,
        ), mock.patch(
            'attendance.management.commands.run_biometric_tcp_server.process_biometric_event',
            return_value={'status': 'processed', 'device_authorized': True},
        ) as process_event_mock:
            BiometricTCPRequestHandler(fake_socket, ('103.106.31.187', 50000), mock.Mock())

        self.assertEqual(process_event_mock.call_count, 1)
        payload = process_event_mock.call_args.kwargs['payload']
        self.assertEqual(payload['DeviceSerialNo'], '2508031064')
        self.assertEqual(payload['Event'], 'TimeLog')
        self.assertEqual(payload['UserID'], '1')
        self.assertTrue(fake_socket.sent[0].startswith(b'HTTP/1.1 200 OK'))
        self.assertIn(b'Content-Length: 0', fake_socket.sent[0])
        self.assertIn(b'response_code: OK', fake_socket.sent[0])
        self.assertTrue(fake_socket.sent[0].endswith(b'\r\n\r\n'))

    @override_settings(BIOMETRIC_TCP_SOCKET_TIMEOUT=1, BIOMETRIC_TCP_MAX_PAYLOAD_BYTES=65536)
    def test_request_handler_fast_acks_stale_secureye_log_without_processing(self):
        class FakeSocket:
            def __init__(self, request):
                self.request = request
                self.sent = []

            def settimeout(self, _value):
                pass

            def recv(self, _size):
                request, self.request = self.request, b''
                return request

            def sendall(self, data):
                self.sent.append(data)

        body_json = b'{"fk_bin_data_lib":"FKDATAHS101","user_id":"16","verify_mode":"1","io_mode":"0","io_time":"20251217113000"}'
        body = len(body_json).to_bytes(4, byteorder='little') + body_json + b'\x00'
        request = (
            b"POST // HTTP/1.0\r\n"
            b"Content-Length: " + str(len(body)).encode('ascii') + b"\r\n"
            b"request_code: realtime_glog\r\n"
            b"dev_id: 2508031064\r\n"
            b"trans_id: 0\r\n\r\n" + body
        )
        fake_socket = FakeSocket(request)

        with mock.patch(
            'attendance.management.commands.run_biometric_tcp_server.resolve_direct_push_device',
            return_value=mock.Mock(),
        ), mock.patch(
            'attendance.management.commands.run_biometric_tcp_server.process_biometric_event',
        ) as process_event_mock:
            BiometricTCPRequestHandler(fake_socket, ('103.106.31.187', 50000), mock.Mock())

        process_event_mock.assert_not_called()
        self.assertEqual(len(fake_socket.sent), 1)
        self.assertIn(b'response_code: OK', fake_socket.sent[0])


class BiometricTcpDeviceResolutionTests(TestCase):
    def setUp(self):
        self.school = School.objects.create(name='North Campus', school_id='NORTH')

    def test_resolves_by_serial_first(self):
        device = BiometricDevice.objects.create(
            school=self.school,
            name='Main Gate',
            integration_mode='tcp_xml_push',
            device_serial_number='T230700006',
            terminal_id='4',
        )

        resolved = resolve_tcp_device(
            {'DeviceSerialNo': 'T230700006', 'TerminalID': '4'},
            source_ip='103.106.31.187',
        )

        self.assertEqual(resolved, device)

    def test_resolves_by_terminal_id_only_with_source_ip_allowlist(self):
        device = BiometricDevice.objects.create(
            school=self.school,
            name='Main Gate',
            integration_mode='tcp_xml_push',
            terminal_id='4',
            allowed_source_ip='103.106.31.187',
        )

        resolved = resolve_tcp_device(
            {'DeviceSerialNo': 'WRONG-SERIAL', 'TerminalID': '4'},
            source_ip='103.106.31.187',
        )

        self.assertEqual(resolved, device)

    def test_sbxpc_machine_id_normalizes_to_terminal_id_for_resolution(self):
        device = BiometricDevice.objects.create(
            school=self.school,
            name='SBXPC Main Gate',
            integration_mode='tcp_xml_push',
            terminal_id='7',
            allowed_source_ip='103.106.31.187',
        )
        payload = parse_tcp_xml_payload(
            "<SBXPCEvent><MachineID>7</MachineID>"
            "<EventType>Time Log</EventType><UserID>11</UserID></SBXPCEvent>"
        )

        resolved = resolve_tcp_device(payload, source_ip='103.106.31.187')

        self.assertEqual(payload["TerminalID"], "7")
        self.assertEqual(resolved, device)

    def test_terminal_id_fallback_requires_matching_source_ip(self):
        BiometricDevice.objects.create(
            school=self.school,
            name='Main Gate',
            integration_mode='tcp_xml_push',
            terminal_id='4',
            allowed_source_ip='103.106.31.187',
        )

        with self.assertRaises(LookupError):
            resolve_tcp_device(
                {'DeviceSerialNo': 'WRONG-SERIAL', 'TerminalID': '4'},
                source_ip='103.187.100.70',
            )

    def test_http_push_device_resolves_by_serial_number(self):
        device = BiometricDevice.objects.create(
            school=self.school,
            name='Office Gate',
            integration_mode='http_push',
            device_serial_number='2508031064',
        )

        resolved = resolve_direct_push_device(
            {'DeviceSerialNo': '2508031064'},
            source_ip='103.106.31.187',
            integration_modes=('http_push',),
            lookup_label='HTTP push',
        )

        self.assertEqual(resolved, device)


class BiometricDeviceLiveStatusTests(TestCase):
    def setUp(self):
        self.school = School.objects.create(name='Status Campus', school_id='STATUS')

    def test_direct_push_device_is_offline_after_short_activity_window(self):
        device = BiometricDevice.objects.create(
            school=self.school,
            name='Main Gate',
            integration_mode='tcp_xml_push',
            device_serial_number='STATUS-001',
            last_seen_at=timezone.now() - timedelta(seconds=16),
        )

        self.assertFalse(device.is_online_now())
        self.assertEqual(device.get_live_status_label(), 'offline')

    def test_direct_push_device_is_online_during_short_activity_window(self):
        device = BiometricDevice.objects.create(
            school=self.school,
            name='Main Gate',
            integration_mode='tcp_xml_push',
            device_serial_number='STATUS-002',
            last_seen_at=timezone.now() - timedelta(seconds=10),
        )

        self.assertTrue(device.is_online_now())
        self.assertEqual(device.get_live_status_label(), 'online')


class TeacherManualAttendanceOverrideTests(APITestCase):
    def setUp(self):
        self.school = School.objects.create(name='North Campus', school_id='NORTH')
        self.teacher_user = User.objects.create_user(
            username='class-teacher',
            password='pass1234',
            role='teacher',
            school=self.school,
            email='teacher@example.com',
        )
        self.teacher_profile = TeacherProfile.objects.create(
            user=self.teacher_user,
            school=self.school,
            employee_id='T-001',
            role='Class Teacher',
        )
        self.main_class = MainClass.objects.create(school=self.school, name='10')
        self.main_section = MainSection.objects.create(school=self.school, name='A')
        self.class_section = ClassSection.objects.create(
            school=self.school,
            class_ref=self.main_class,
            section_ref=self.main_section,
            class_teacher=self.teacher_profile,
        )
        self.student_user = User.objects.create_user(
            username='student-one',
            password='pass1234',
            role='student',
            school=self.school,
            email='student@example.com',
        )
        self.student_profile = StudentProfile.objects.create(
            user=self.student_user,
            school=self.school,
            admission_number='ADM-001',
            roll_number='1',
            rfid_code='RFID-001',
            class_section=self.class_section,
        )
        self.client.force_authenticate(self.teacher_user)

    def test_manual_mark_endpoint_allows_overriding_biometric_attendance_row(self):
        today = timezone.localdate()
        attendance = Attendance.objects.create(
            student=self.student_profile,
            class_section=self.class_section,
            date=today,
            status='present',
            verification_status='approved',
            marked_via='rfid',
        )

        response = self.client.post(
            reverse('mark-attendance'),
            {
                'student': self.student_profile.id,
                'date': attendance.date.isoformat(),
                'status': 'absent',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        attendance.refresh_from_db()
        self.assertEqual(attendance.marked_via, 'manual')
        self.assertEqual(attendance.status, 'absent')
        self.assertEqual(attendance.verification_status, 'rejected')

    def test_bulk_save_allows_overriding_biometric_attendance_rows(self):
        today = timezone.localdate()
        Attendance.objects.create(
            student=self.student_profile,
            class_section=self.class_section,
            date=today,
            status='present',
            verification_status='approved',
            marked_via='rfid',
        )

        response = self.client.post(
            reverse('teacher-attendance-bulk-save'),
            {
                'class_section_id': self.class_section.id,
                'date': today.isoformat(),
                'rows': [
                    {
                        'student_id': self.student_profile.id,
                        'status': 'absent',
                    }
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['saved'], 1)

        attendance = Attendance.objects.get(student=self.student_profile, date=today)
        self.assertEqual(attendance.marked_via, 'manual')
        self.assertEqual(attendance.status, 'absent')
        self.assertEqual(attendance.verification_status, 'rejected')


class AdminTeacherAttendanceClearTests(APITestCase):
    def setUp(self):
        self.school = School.objects.create(name='North Campus', school_id='NORTH')
        self.admin_user = User.objects.create_user(
            username='north-admin-clear',
            password='pass1234',
            role='admin',
            school=self.school,
            email='admin-clear@example.com',
        )
        self.teacher_user = User.objects.create_user(
            username='teacher-clear',
            password='pass1234',
            role='teacher',
            school=self.school,
            email='teacher-clear@example.com',
        )
        self.teacher_profile = TeacherProfile.objects.create(
            user=self.teacher_user,
            school=self.school,
            employee_id='T-CLEAR',
            role='Class Teacher',
        )
        self.client.force_authenticate(self.admin_user)

    def test_admin_can_clear_todays_teacher_attendance(self):
        today = timezone.localdate()
        TeacherAttendance.objects.create(
            teacher=self.teacher_profile,
            date=today,
            status='present',
            marked_via='rfid',
            punch_in_time=timezone.now(),
            punch_out_time=timezone.now() + timedelta(hours=1),
        )

        response = self.client.post(reverse('staff-attendance-clear-today'), {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['deleted'], 1)
        self.assertFalse(TeacherAttendance.objects.filter(teacher=self.teacher_profile, date=today).exists())


class BiometricPunchApprovalTests(TestCase):
    def setUp(self):
        self.school = School.objects.create(name='North Campus', school_id='NORTH')
        self.teacher_user = User.objects.create_user(
            username='class-teacher-two',
            password='pass1234',
            role='teacher',
            school=self.school,
            email='teacher2@example.com',
        )
        self.teacher_profile = TeacherProfile.objects.create(
            user=self.teacher_user,
            school=self.school,
            employee_id='T-002',
            role='Class Teacher',
        )
        self.main_class = MainClass.objects.create(school=self.school, name='9')
        self.main_section = MainSection.objects.create(school=self.school, name='B')
        self.class_section = ClassSection.objects.create(
            school=self.school,
            class_ref=self.main_class,
            section_ref=self.main_section,
            class_teacher=self.teacher_profile,
        )
        self.student_user = User.objects.create_user(
            username='student-two',
            password='pass1234',
            role='student',
            school=self.school,
            email='student2@example.com',
        )
        self.student_profile = StudentProfile.objects.create(
            user=self.student_user,
            school=self.school,
            admission_number='ADM-002',
            roll_number='2',
            rfid_code='3',
            class_section=self.class_section,
        )
        self.device = BiometricDevice.objects.create(
            school=self.school,
            name='Main Gate',
            integration_mode='tcp_xml_push',
            device_serial_number='T230700006',
            terminal_id='4',
            allowed_source_ip='103.106.31.187',
        )

    def test_tcp_biometric_punch_marks_student_present_immediately(self):
        now = timezone.now()
        payload = {
            'DeviceSerialNo': 'T230700006',
            'TerminalID': '4',
            'Event': 'TimeLog',
            'UserID': '3',
            'Year': str(now.year),
            'Month': str(now.month),
            'Day': str(now.day),
            'Hour': str(now.hour),
            'Minute': str(now.minute),
            'Second': str(now.second),
        }

        result = process_biometric_event(
            protocol='tcp_xml',
            payload=payload,
            raw_payload='<Message />',
            source_ip='103.106.31.187',
        )

        self.assertTrue(result['ok'])
        self.assertEqual(result['status'], 'processed')

        attendance = Attendance.objects.get(student=self.student_profile, date=timezone.localdate())
        self.assertEqual(attendance.status, 'present')
        self.assertEqual(attendance.verification_status, 'approved')
        self.assertEqual(attendance.marked_via, 'rfid')

    def test_existing_event_still_deduplicates_after_identity_upgrade(self):
        now = timezone.now()
        payload = {
            'DeviceSerialNo': 'T230700006',
            'TerminalID': '4',
            'Event': 'TimeLog',
            'TransID': '0',
            'UserID': '3',
            'VerifMode': 'Card',
            'AttendStat': 'Duty Off',
            'Year': str(now.year),
            'Month': str(now.month),
            'Day': str(now.day),
            'Hour': str(now.hour),
            'Minute': str(now.minute),
            'Second': str(now.second),
        }

        first_result = process_biometric_event(
            protocol='tcp_xml',
            payload=payload,
            raw_payload='<Message />',
            source_ip='103.106.31.187',
        )
        event_log = BiometricEventLog.objects.get(id=first_result['event_log_id'])
        event_log.event_fingerprint = '0' * 64
        event_log.save(update_fields=['event_fingerprint'])

        second_result = process_biometric_event(
            protocol='tcp_xml',
            payload=payload,
            raw_payload='<Message />',
            source_ip='103.106.31.187',
        )

        self.assertEqual(second_result['event_log_id'], event_log.id)
        self.assertEqual(BiometricEventLog.objects.count(), 1)

    def test_duplicate_unauthorized_event_never_authorizes_persistent_socket(self):
        now = timezone.now()
        payload = {
            'DeviceSerialNo': 'UNREGISTERED-M50',
            'TerminalID': '99',
            'Event': 'TimeLog',
            'TransID': '0',
            'UserID': '3',
            'VerifMode': 'Card',
            'Year': str(now.year),
            'Month': str(now.month),
            'Day': str(now.day),
            'Hour': str(now.hour),
            'Minute': str(now.minute),
            'Second': str(now.second),
        }

        first_result = process_biometric_event(
            protocol='tcp_xml',
            payload=payload,
            raw_payload='<Message />',
            source_ip='203.0.113.10',
        )
        second_result = process_biometric_event(
            protocol='tcp_xml',
            payload=payload,
            raw_payload='<Message />',
            source_ip='203.0.113.10',
        )

        self.assertFalse(first_result['device_authorized'])
        self.assertFalse(second_result['device_authorized'])
        self.assertEqual(BiometricEventLog.objects.filter(device__isnull=True).count(), 1)

    def test_duplicate_tcp_punch_overwrites_manual_absent_for_now(self):
        now = timezone.now()
        payload = {
            'DeviceSerialNo': 'T230700006',
            'TerminalID': '4',
            'Event': 'TimeLog',
            'UserID': '3',
            'Year': str(now.year),
            'Month': str(now.month),
            'Day': str(now.day),
            'Hour': str(now.hour),
            'Minute': str(now.minute),
            'Second': str(now.second),
        }

        first_result = process_biometric_event(
            protocol='tcp_xml',
            payload=payload,
            raw_payload='<Message />',
            source_ip='103.106.31.187',
        )
        self.assertTrue(first_result['ok'])

        attendance = Attendance.objects.get(student=self.student_profile, date=timezone.localdate())
        attendance.status = 'absent'
        attendance.verification_status = 'rejected'
        attendance.marked_via = 'manual'
        attendance.punch_time = None
        attendance.save()

        second_result = process_biometric_event(
            protocol='tcp_xml',
            payload=payload,
            raw_payload='<Message />',
            source_ip='103.106.31.187',
        )

        attendance.refresh_from_db()
        self.assertTrue(second_result['ok'])
        self.assertEqual(second_result['status'], 'processed')
        self.assertEqual(attendance.status, 'present')
        self.assertEqual(attendance.verification_status, 'approved')
        self.assertEqual(attendance.marked_via, 'rfid')
        self.assertIsNotNone(attendance.punch_time)

    def test_duplicate_tcp_punch_recreates_cleared_teacher_attendance_for_now(self):
        self.student_profile.rfid_code = 'STUDENT-3'
        self.student_profile.save(update_fields=['rfid_code'])
        teacher = TeacherProfile.objects.create(
            user=User.objects.create_user(
                username='teacher-biometric-duplicate',
                password='pass1234',
                role='teacher',
                school=self.school,
                email='teacher-biometric-duplicate@example.com',
            ),
            school=self.school,
            employee_id='15',
            rfid_code='15',
            role='Teacher',
        )
        now = timezone.now()
        payload = {
            'DeviceSerialNo': 'T230700006',
            'TerminalID': '4',
            'Event': 'TimeLog',
            'UserID': '15',
            'Year': str(now.year),
            'Month': str(now.month),
            'Day': str(now.day),
            'Hour': str(now.hour),
            'Minute': str(now.minute),
            'Second': str(now.second),
        }

        first_result = process_biometric_event(
            protocol='tcp_xml',
            payload=payload,
            raw_payload='<Message />',
            source_ip='103.106.31.187',
        )
        self.assertTrue(first_result['ok'])
        TeacherAttendance.objects.filter(teacher=teacher, date=timezone.localdate()).delete()

        second_result = process_biometric_event(
            protocol='tcp_xml',
            payload=payload,
            raw_payload='<Message />',
            source_ip='103.106.31.187',
        )

        teacher_attendance = TeacherAttendance.objects.get(teacher=teacher, date=timezone.localdate())
        self.assertTrue(second_result['ok'])
        self.assertEqual(second_result['status'], 'processed')
        self.assertEqual(teacher_attendance.status, 'present')
        self.assertEqual(teacher_attendance.marked_via, 'rfid')
        self.assertIsNotNone(teacher_attendance.punch_in_time)


class SecureyeNormalizationTests(SimpleTestCase):
    def test_decodes_and_normalizes_secureye_http_payload(self):
        body_json = b'{"fk_bin_data_lib":"FKDATAHS101","user_id":"1","verify_mode":"33","io_mode":"0","io_time":"20260701171545"}'
        body = len(body_json).to_bytes(4, byteorder='little') + body_json + b'\x00'
        http_request = {
            'headers': {
                'request_code': 'realtime_glog',
                'dev_id': '2508031064',
                'trans_id': '0',
            },
            'body': body,
        }

        decoded = decode_secureye_json_body(body)
        normalized, body_data = normalize_secureye_http_event(http_request, source_ip='103.106.31.187')

        self.assertEqual(decoded['user_id'], '1')
        self.assertEqual(body_data['fk_bin_data_lib'], 'FKDATAHS101')
        self.assertEqual(normalized['DeviceSerialNo'], '2508031064')
        self.assertEqual(normalized['Event'], 'TimeLog')
        self.assertEqual(normalized['UserID'], '1')
        self.assertEqual(normalized['punch_time'], '2026-07-01 17:15:45')


class BiometricEventSanitizationTests(TestCase):
    def setUp(self):
        self.school = School.objects.create(name='North Campus', school_id='NORTH')
        self.teacher_user = User.objects.create_user(
            username='class-teacher-sanitize',
            password='pass1234',
            role='teacher',
            school=self.school,
            email='teacher-sanitize@example.com',
        )
        self.teacher_profile = TeacherProfile.objects.create(
            user=self.teacher_user,
            school=self.school,
            employee_id='T-003',
            role='Class Teacher',
        )
        self.main_class = MainClass.objects.create(school=self.school, name='8')
        self.main_section = MainSection.objects.create(school=self.school, name='C')
        self.class_section = ClassSection.objects.create(
            school=self.school,
            class_ref=self.main_class,
            section_ref=self.main_section,
            class_teacher=self.teacher_profile,
        )
        self.student_user = User.objects.create_user(
            username='student-sanitize',
            password='pass1234',
            role='student',
            school=self.school,
            email='student-sanitize@example.com',
        )
        self.student_profile = StudentProfile.objects.create(
            user=self.student_user,
            school=self.school,
            admission_number='ADM-003',
            roll_number='3',
            rfid_code='1',
            class_section=self.class_section,
        )
        self.device = BiometricDevice.objects.create(
            school=self.school,
            name='Office Gate',
            integration_mode='http_push',
            device_serial_number='2508031064',
        )

    def test_process_biometric_event_strips_nul_bytes_before_saving(self):
        payload = {
            'DeviceSerialNo': '2508031064',
            'Event': 'TimeLog',
            'UserID': '1\x00',
            'VerifMode': '33',
            'AttendStat': '0',
            'TransID': '0',
            'terminal_id': '1',
            'push_vendor': 'secureye_http',
            'body_json': {
                'user_id': '1\x00',
                'fk_name': 'S-B251CB/WiFi\x00',
            },
            'punch_time': timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
        }

        result = process_biometric_event(
            protocol='http',
            payload=payload,
            raw_payload='POST /\x00 HTTP/1.0\r\nbody\x00',
            source_ip='106.222.215.173',
            device=self.device,
        )

        self.assertTrue(result['ok'])
        event_log = self.device.event_logs.latest('id')
        self.assertNotIn('\x00', event_log.raw_payload)
        self.assertEqual(event_log.user_identifier, '1')
        self.assertEqual(event_log.normalized_payload['UserID'], '1')
        self.assertEqual(event_log.normalized_payload['body_json']['user_id'], '1')
