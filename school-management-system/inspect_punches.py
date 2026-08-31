import base64, struct, paramiko, io
from cryptography.hazmat.primitives.kdf.argon2 import Argon2id
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

def read_ssh_int(blob, offset):
    length = struct.unpack(">I", blob[offset:offset+4])[0]
    offset += 4
    num_bytes = blob[offset:offset+length]
    num = int.from_bytes(num_bytes, byteorder='big')
    return num, offset + length

def read_ssh_str(blob, offset):
    length = struct.unpack(">I", blob[offset:offset+4])[0]
    offset += 4
    s = blob[offset:offset+length]
    return s, offset + length

def get_vps_client():
    with open(r"C:\Users\Ankit\Downloads\new private key.ppk", "r") as f:
        lines = [l.strip() for l in f.readlines()]
    pub_lines, priv_lines = [], []
    i, mem, passes, parallelism, salt = 0, 8192, 21, 1, b""
    while i < len(lines):
        line = lines[i]
        if line.startswith("Public-Lines:"):
            for _ in range(int(line.split(":")[1].strip())):
                i += 1
                pub_lines.append(lines[i])
        elif line.startswith("Argon2-Memory:"):
            mem = int(line.split(":")[1].strip())
        elif line.startswith("Argon2-Passes:"):
            passes = int(line.split(":")[1].strip())
        elif line.startswith("Argon2-Parallelism:"):
            parallelism = int(line.split(":")[1].strip())
        elif line.startswith("Argon2-Salt:"):
            salt = bytes.fromhex(line.split(":")[1].strip())
        elif line.startswith("Private-Lines:"):
            for _ in range(int(line.split(":")[1].strip())):
                i += 1
                priv_lines.append(lines[i])
        i += 1

    pub_blob = base64.b64decode("".join(pub_lines))
    priv_cipher = base64.b64decode("".join(priv_lines))
    kdf = Argon2id(salt=salt, length=80, iterations=passes, lanes=parallelism, memory_cost=mem)
    derived = kdf.derive(b"eicvipvps!")
    cipher = Cipher(algorithms.AES(derived[0:32]), modes.CBC(derived[32:48]))
    decryptor = cipher.decryptor()
    priv_blob = decryptor.update(priv_cipher) + decryptor.finalize()

    off = 0
    key_type, off = read_ssh_str(pub_blob, off)
    e, off = read_ssh_int(pub_blob, off)
    n, off = read_ssh_int(pub_blob, off)
    off = 0
    d, off = read_ssh_int(priv_blob, off)
    p, off = read_ssh_int(priv_blob, off)
    q, off = read_ssh_int(priv_blob, off)
    iqmp, off = read_ssh_int(priv_blob, off)

    dmp1 = rsa.rsa_crt_dmp1(d, p)
    dmq1 = rsa.rsa_crt_dmq1(d, q)
    private_key = rsa.RSAPrivateNumbers(p=p, q=q, d=d, dmp1=dmp1, dmq1=dmq1, iqmp=iqmp, public_numbers=rsa.RSAPublicNumbers(e, n)).private_key()
    pem = private_key.private_bytes(encoding=serialization.Encoding.PEM, format=serialization.PrivateFormat.TraditionalOpenSSL, encryption_algorithm=serialization.NoEncryption())
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect("93.127.199.44", port=22, username="root", pkey=paramiko.RSAKey.from_private_key(io.StringIO(pem.decode('utf-8'))), timeout=10)
    return client

client = get_vps_client()
sftp = client.open_sftp()

script = """import os, sys, django
sys.path.insert(0, '/opt/school-app/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from attendance.models import BiometricDevice, BiometricEventLog, Attendance, TeacherAttendance

print("=== RECENT 10 BIOMETRIC EVENT LOGS ===")
for log in BiometricEventLog.objects.all().order_by('-id')[:10]:
    print(f"Log ID: {log.id} | Device: {log.device_id} | School: {log.school} | Protocol: {log.protocol} | Status: {log.status} | User: {log.user_identifier} | Punch: {log.punch_time} | Msg: {log.error_message} | Recv: {log.received_at}")

print("\\n=== RECENT 10 ATTENDANCE RECORDS TODAY ===")
for att in Attendance.objects.all().order_by('-id')[:10]:
    print(f"StudentAtt ID: {att.id} | Student: {att.student.user.username} | RFID: {att.student.rfid_code} | Date: {att.date} | Status: {att.status} | Punch: {att.punch_time} | MarkedVia: {att.marked_via}")

for tatt in TeacherAttendance.objects.all().order_by('-id')[:10]:
    print(f"TeacherAtt ID: {tatt.id} | Teacher: {tatt.teacher.user.username} | RFID: {tatt.teacher.rfid_code} | Date: {tatt.date} | In: {tatt.punch_in_time} | Out: {tatt.punch_out_time}")
"""

with sftp.open("/opt/school-app/debug_punch.py", "w") as f:
    f.write(script)

stdin, stdout, stderr = client.exec_command("/opt/school-app/venv/bin/python /opt/school-app/debug_punch.py")
print(stdout.read().decode())
err = stderr.read().decode()
if err: print("ERR:", err)

print("=== RECENT GUNICORN ERROR LOGS ===")
stdin, stdout, stderr = client.exec_command("tail -n 30 /opt/school-app/logs/gunicorn-error.log")
print(stdout.read().decode())

sftp.remove("/opt/school-app/debug_punch.py")
sftp.close()
client.close()
