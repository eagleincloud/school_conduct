import logging
import datetime
import os
import sys
import ctypes
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from django.conf import settings

from zk import ZK
from attendance.models import BiometricDevice, Attendance, TeacherAttendance
from students.models import StudentProfile
from teachers.models import TeacherProfile
from communication.models import Notification

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = "Connects to active biometric devices (ZKTeco/Team Office) directly and pulls punch logs."

    def handle(self, *args, **options):
        active_devices = BiometricDevice.objects.filter(is_active=True).select_related('school')
        
        if not active_devices.exists():
            self.stdout.write(self.style.WARNING("No active biometric devices found."))
            return

        for device in active_devices:
            self.stdout.write(f"Connecting to device '{device.name}' at {device.device_ip}:{device.device_port}...")
            
            # Determine the start cursor time (default to 1 day ago if last_punch_at is not set)
            start_cursor = device.last_punch_at
            if not start_cursor:
                start_cursor = timezone.now() - datetime.timedelta(days=1)
                self.stdout.write(f"  No previous sync cursor found. Starting sync from: {start_cursor}")
            else:
                self.stdout.write(f"  Syncing punches newer than cursor: {start_cursor}")

            # ─── OPTION 1: Team Office / Realtime SBXPC Protocol (Windows DLL) ───
            use_sbxpc = False
            dll_dir = None
            dll_path = None
            if sys.platform == 'win32' and device.device_port == 5005:
                dll_dir = os.path.abspath(os.path.join(settings.BASE_DIR, "..", "..", "SDK20180628-1", "20180622_SDK", "SDK", "Sample_M50", "C#_SBXPCDLL_Sample", "SBXPCDLLSampleCSharp", "bin", "x86", "Debug"))
                dll_path = os.path.join(dll_dir, "SBXPCDLL64.dll")
                if os.path.exists(dll_path):
                    use_sbxpc = True

            if use_sbxpc:
                self.stdout.write("  Detected Team Office machine. Connecting via SBXPC DLL...")
                try:
                    os.add_dll_directory(dll_dir)
                except Exception:
                    pass

                try:
                    lib = ctypes.windll.LoadLibrary(dll_path)
                    lib._DotNET()
                    
                    dwMachineNumber = ctypes.c_int32(device.machine_number)
                    ip_ptr = ctypes.c_wchar_p(device.device_ip)
                    ip_ref = ctypes.byref(ip_ptr)
                    dwPortNumber = ctypes.c_int32(device.device_port)
                    dwPassWord = ctypes.c_int32(device.device_password)

                    lib._ConnectTcpip.restype = ctypes.c_ubyte
                    lib._ConnectTcpip.argtypes = [ctypes.c_int32, ctypes.c_void_p, ctypes.c_int32, ctypes.c_int32]
                    
                    conn_res = lib._ConnectTcpip(dwMachineNumber, ip_ref, dwPortNumber, dwPassWord)
                    if conn_res > 0:
                        self.stdout.write(self.style.SUCCESS(f"  Connected successfully via SBXPC DLL to {device.name}."))
                        now = timezone.now()
                        device.last_seen_at = now
                        device.last_tested_at = now
                        device.last_test_status = 'online'
                        device.last_test_message = 'Direct SBXPC pulling successful.'
                        device.save(update_fields=['last_seen_at', 'last_tested_at', 'last_test_status', 'last_test_message'])

                        try:
                            # Disable device
                            lib._EnableDevice.argtypes = [ctypes.c_int32, ctypes.c_ubyte]
                            lib._EnableDevice(dwMachineNumber, 0)

                            # Read general logs into memory buffer
                            lib._ReadGeneralLogData.restype = ctypes.c_ubyte
                            lib._ReadGeneralLogData.argtypes = [ctypes.c_int32, ctypes.c_ubyte]
                            read_res = lib._ReadGeneralLogData(dwMachineNumber, 0)

                            if read_res > 0:
                                lib._GetGeneralLogData.restype = ctypes.c_ubyte
                                lib._GetGeneralLogData.argtypes = [
                                    ctypes.c_int32,
                                    ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p,
                                    ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p,
                                    ctypes.c_void_p, ctypes.c_void_p
                                ]
                                
                                synced_count = 0
                                new_punches_count = 0
                                latest_punch_time = start_cursor
                                
                                while True:
                                    t_mach = ctypes.c_int32(0)
                                    enroll = ctypes.c_int32(0)
                                    e_mach = ctypes.c_int32(0)
                                    verify = ctypes.c_int32(0)
                                    year = ctypes.c_int32(0)
                                    month = ctypes.c_int32(0)
                                    day = ctypes.c_int32(0)
                                    hour = ctypes.c_int32(0)
                                    minute = ctypes.c_int32(0)
                                    second = ctypes.c_int32(0)

                                    has_log = lib._GetGeneralLogData(
                                        dwMachineNumber,
                                        ctypes.byref(t_mach),
                                        ctypes.byref(enroll),
                                        ctypes.byref(e_mach),
                                        ctypes.byref(verify),
                                        ctypes.byref(year),
                                        ctypes.byref(month),
                                        ctypes.byref(day),
                                        ctypes.byref(hour),
                                        ctypes.byref(minute),
                                        ctypes.byref(second)
                                    )

                                    if not has_log:
                                        break

                                    try:
                                        punch_dt = datetime.datetime(
                                            year.value, month.value, day.value,
                                            hour.value, minute.value, second.value
                                        )
                                        if timezone.is_naive(punch_dt):
                                            punch_dt = timezone.make_aware(punch_dt, timezone.get_current_timezone())
                                    except Exception:
                                        continue

                                    if punch_dt > start_cursor:
                                        new_punches_count += 1
                                        rfid_code = str(enroll.value)
                                        if self.process_punch_log(device, rfid_code, punch_dt):
                                            synced_count += 1
                                        if punch_dt > latest_punch_time:
                                            latest_punch_time = punch_dt

                                if new_punches_count > 0:
                                    device.last_punch_at = latest_punch_time
                                    device.save(update_fields=['last_punch_at'])
                                    self.stdout.write(self.style.SUCCESS(f"  Processed {synced_count}/{new_punches_count} logs. Cursor updated to {latest_punch_time}."))
                                else:
                                    self.stdout.write("  No new punches found.")
                            else:
                                self.stdout.write(self.style.WARNING("  Failed to buffer device logs via SBXPC."))

                        finally:
                            # Enable device and disconnect
                            lib._EnableDevice(dwMachineNumber, 1)
                            lib._Disconnect.argtypes = [ctypes.c_int32]
                            lib._Disconnect(dwMachineNumber)
                            self.stdout.write("  Connection closed.")

                    else:
                        raise ConnectionError("SBXPC connection refused or timed out.")

                except Exception as e:
                    err_msg = f"Failed to poll device '{device.name}' via SBXPC: {e}"
                    self.stdout.write(self.style.ERROR(f"  {err_msg}"))
                    logger.error(err_msg)
                    
                    # Update device offline state
                    now = timezone.now()
                    device.last_tested_at = now
                    device.last_test_status = 'offline'
                    device.last_test_message = f"SBXPC Connection failed: {e}"[:255]
                    device.save(update_fields=['last_tested_at', 'last_test_status', 'last_test_message'])

            # ─── OPTION 2: Standard ZKTeco Protocol (pyzk) ───
            else:
                # Setup ZK connection using TCP mode (force_udp=False) and ommit_ping=True
                zk = ZK(
                    device.device_ip, 
                    port=device.device_port, 
                    timeout=15, 
                    password=device.device_password, 
                    force_udp=False, 
                    ommit_ping=True
                )
                
                conn = None
                try:
                    conn = zk.connect()
                    self.stdout.write(self.style.SUCCESS(f"  Connected successfully to {device.name}."))
                    
                    # Update device online state
                    now = timezone.now()
                    device.last_seen_at = now
                    device.last_tested_at = now
                    device.last_test_status = 'online'
                    device.last_test_message = 'Direct pulling connection successful.'
                    device.save(update_fields=['last_seen_at', 'last_tested_at', 'last_test_status', 'last_test_message'])

                    # Fetch logs
                    attendance_logs = conn.get_attendance()
                    self.stdout.write(f"  Fetched {len(attendance_logs)} logs from device memory.")

                    new_punches = []
                    for log in attendance_logs:
                        log_dt = log.timestamp
                        if timezone.is_naive(log_dt):
                            log_dt = timezone.make_aware(log_dt, timezone.get_current_timezone())
                        if log_dt > start_cursor:
                            new_punches.append((log, log_dt))

                    self.stdout.write(f"  Found {len(new_punches)} new logs to process.")

                    synced_count = 0
                    latest_punch_time = start_cursor

                    for log, punch_dt in new_punches:
                        rfid_code = str(log.user_id)
                        success = self.process_punch_log(device, rfid_code, punch_dt)
                        if success:
                            synced_count += 1
                        
                        if punch_dt > latest_punch_time:
                            latest_punch_time = punch_dt

                    # Update the high-water cursor in the database
                    if new_punches:
                        device.last_punch_at = latest_punch_time
                        device.save(update_fields=['last_punch_at'])
                        self.stdout.write(self.style.SUCCESS(f"  Processed {synced_count}/{len(new_punches)} logs. Cursor updated to {latest_punch_time}."))
                    else:
                        self.stdout.write("  No new punches found.")

                except Exception as e:
                    err_msg = f"Failed to poll device '{device.name}': {e}"
                    self.stdout.write(self.style.ERROR(f"  {err_msg}"))
                    logger.error(err_msg)
                    
                    # Update device offline state
                    now = timezone.now()
                    device.last_tested_at = now
                    device.last_test_status = 'offline'
                    device.last_test_message = f"Connection failed: {e}"[:255]
                    device.save(update_fields=['last_tested_at', 'last_test_status', 'last_test_message'])

                finally:
                    if conn:
                        try:
                            conn.disconnect()
                            self.stdout.write("  Connection closed.")
                        except Exception:
                            pass

    def process_punch_log(self, device, rfid_code, punch_dt):
        """
        Creates or updates attendance records. Matches student or teacher by RFID.
        """
        school = device.school
        target_date = punch_dt.date()

        # 1. Resolve Student
        student = StudentProfile.objects.select_related('class_section', 'user', 'school').filter(
            rfid_code=rfid_code,
            school=school
        ).first()

        if student:
            with transaction.atomic():
                attendance, created = Attendance.objects.select_related('student').get_or_create(
                    student=student,
                    date=target_date,
                    defaults={
                        'status': 'present',
                        'verification_status': 'pending',
                        'marked_via': 'rfid',
                        'punch_time': punch_dt,
                        'class_section': student.class_section
                    },
                )

                if not created and attendance.verification_status != 'pending':
                    # If marked absent or rejected, scanner overrides status to pending present
                    if attendance.status == 'absent' or attendance.verification_status == 'rejected':
                        attendance.status = 'present'
                        attendance.verification_status = 'pending'
                        attendance.marked_via = 'rfid'
                        attendance.punch_time = punch_dt
                        attendance.marked_by = None
                        attendance.verified_by = None
                        attendance.verified_at = None
                        attendance.save()
                elif not created:
                    # Update details for multiple punches on the same day (pending records)
                    attendance.status = 'present'
                    attendance.verification_status = 'pending'
                    attendance.marked_via = 'rfid'
                    attendance.punch_time = punch_dt
                    attendance.class_section = student.class_section
                    attendance.marked_by = None
                    attendance.verified_by = None
                    attendance.verified_at = None
                    attendance.save()

                if created:
                    # Notify Class Teacher
                    class_section = student.class_section
                    if class_section and class_section.class_teacher:
                        teacher_user = class_section.class_teacher.user
                        Notification.objects.create(
                            user=teacher_user,
                            target_role=teacher_user.role,
                            title='Attendance Verification Pending',
                            message=f"{student.user.name or student.user.username} punched attendance for {target_date.isoformat()}. Please verify (Approve/Reject).",
                            is_read=False,
                        )
            return True

        # 2. Resolve Teacher
        teacher = TeacherProfile.objects.select_related('user', 'school').filter(
            rfid_code=rfid_code,
            user__school=school
        ).first()

        if teacher:
            with transaction.atomic():
                attendance, created = TeacherAttendance.objects.get_or_create(
                    teacher=teacher,
                    date=target_date,
                    defaults={
                        'status': 'present',
                        'marked_via': 'rfid',
                        'punch_in_time': punch_dt,
                    },
                )

                if not created:
                    if not attendance.punch_out_time or attendance.punch_out_time < punch_dt:
                        attendance.punch_out_time = punch_dt
                        attendance.save(update_fields=['punch_out_time'])
            return True

        return False
