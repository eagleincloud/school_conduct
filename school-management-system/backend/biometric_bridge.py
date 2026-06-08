import time
import requests
from datetime import datetime
from zk import ZK

# =========================================================================
# CONFIGURATION - CHANGE THESE SETTINGS FOR EACH SCHOOL DEPLOYMENT
# =========================================================================
DEVICE_IP = '192.168.0.150'
DEVICE_PORT = 4370         # Z500V2 custom TCP Port (from machine settings)
SCHOOL_ID = 'DEFAULT'            # !!! UNIQUE SCHOOL ID (e.g. 'school_01', 'school_02' etc. as per DB)
SERVER_URL = 'http://13.233.140.195/api/attendance/biometric-punch/'
DEVICE_SECRET_KEY = 'y0ur_Sup3r_S3cr3t_B1om3tr1c_K3y_987'  # Must match the configured key in Django settings
# =========================================================================

def start_bridge():
    print("=" * 60)
    print(f"Biometric Bridge Service - School ID: [{SCHOOL_ID}]")
    print(f"Connecting to Biometric Device {DEVICE_IP}:{DEVICE_PORT}...")
    print("=" * 60)

    # force_udp=False (TCP Mode) and ommit_ping=True based on hardware configuration
    zk = ZK(DEVICE_IP, port=DEVICE_PORT, timeout=10, password=0, force_udp=False, ommit_ping=True)

    conn = None

    try:
        conn = zk.connect()
        print("[SUCCESS] Connected to Biometric Z500V2 machine successfully!")
        
        # Test beep/voice from the machine
        try:
            conn.voice_test(10) # Triggers standard "Connected successfully" voice
        except Exception:
            pass

        print(f"Listening & Polling for new punches. Syncing with: {SERVER_URL}")
        
        # We start checking punches from the current local time onwards
        last_checked_punch_time = datetime.now()

        while True:
            if not conn:
                print("[WARNING] Connection lost. Attempting to reconnect...")
                conn = zk.connect()

            try:
                # Fetch attendance logs from the ZKTeco device memory
                attendance_logs = conn.get_attendance()
                
                for log in attendance_logs:
                    # Filter only new punches recorded after our start pointer
                    if log.timestamp > last_checked_punch_time:
                        print(f"[PUNCH DETECTED] RFID/User ID: {log.user_id} | Time: {log.timestamp}")

                        # Multi-Tenant Payload: Enforce that this data belongs strictly to SCHOOL_ID
                        payload = {
                            'rfid_code': str(log.user_id), # Matches rfid_code field in student DB
                            'school_id': SCHOOL_ID,         # Ensures isolation for this school
                            'punch_time': log.timestamp.strftime("%Y-%m-%d %H:%M:%S")
                        }

                        headers = {
                            'X-Device-Token': DEVICE_SECRET_KEY,
                            'Content-Type': 'application/json'
                        }

                        # POST to the cloud backend
                        try:
                            res = requests.post(SERVER_URL, json=payload, headers=headers, timeout=10)
                            if res.status_code == 201:
                                data = res.json()
                                print(f"  [SYNCED] {data['student_name']} synced with School: {data['school_name']}")
                            else:
                                print(f"  [FAILED] Server rejected punch: {res.status_code} - {res.text}")
                        except Exception as post_err:
                            print(f"  [ERROR] Could not connect to Django server: {post_err}")
                            with open("biometric_bridge_errors.log", "a") as log_file:
                                log_file.write(f"[{datetime.now()}] Server post error for RFID {log.user_id}: {post_err}\n")

                        # Update last checked timestamp
                        last_checked_punch_time = log.timestamp

            except Exception as loop_err:
                print(f"[ERROR] Loop iteration error: {loop_err}")
                time.sleep(5)

            # Polling delay: checks device logs every 5 seconds
            time.sleep(5)

    except Exception as device_err:
        print(f"[CRITICAL ERROR] Device Connection Failed: {device_err}")
        with open("biometric_bridge_errors.log", "a") as log_file:
            log_file.write(f"[{datetime.now()}] Device Connection Failed: {device_err}\n")
        
        # Wait 30 seconds before retrying connection
        print("Retrying connection in 30 seconds...")
        time.sleep(30)
        start_bridge()

    finally:
        if conn:
            try:
                conn.disconnect()
                print("[INFO] Connection closed gracefully.")
            except Exception:
                pass

if __name__ == '__main__':
    while True:
        try:
            start_bridge()
        except KeyboardInterrupt:
            print("\n[STOPPED] Stopping Biometric Bridge.")
            break
        except Exception as main_err:
            print(f"[RESTARTING] Bridge crashed: {main_err}. Restarting in 10s...")
            time.sleep(10)
