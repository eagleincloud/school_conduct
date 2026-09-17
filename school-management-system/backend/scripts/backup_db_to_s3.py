#!/usr/bin/env python3
import os
import sys
import subprocess
import datetime
import glob
import logging

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    print("Error: boto3 is not installed.")
    sys.exit(1)

LOG_FILE = "/opt/school-app/logs/db_backup.log"
logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
console = logging.StreamHandler()
console.setLevel(logging.INFO)
logging.getLogger("").addHandler(console)

def load_env(env_path="/opt/school-app/backend/.env"):
    env_vars = {}
    if not os.path.exists(env_path):
        return env_vars
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                env_vars[key.strip()] = val.strip().strip("'").strip('"')
    return env_vars

def run_backup():
    logging.info("==========================================")
    logging.info("Starting PostgreSQL Database S3 Backup...")
    
    env = load_env()
    db_name = env.get("DB_NAME", "myproject_db")
    db_user = env.get("DB_USER", "school_conduct")
    db_pass = env.get("DB_PASSWORD", "SchoolConduct@2026")
    db_host = env.get("DB_HOST", "127.0.0.1")
    db_port = env.get("DB_PORT", "5432")
    
    aws_key = env.get("AWS_ACCESS_KEY_ID")
    aws_secret = env.get("AWS_SECRET_ACCESS_KEY")
    bucket_name = env.get("AWS_S3_BUCKET_NAME", "schoolconduct-db-bkp")
    region_name = env.get("AWS_S3_REGION_NAME", "ap-south-1")
    s3_folder = env.get("AWS_S3_BACKUP_FOLDER", "db_backup").strip("/")

    if not aws_key or not aws_secret or not bucket_name:
        logging.error("AWS credentials missing in /opt/school-app/backend/.env")
        sys.exit(1)

    backup_dir = "/opt/school-app/backups"
    os.makedirs(backup_dir, exist_ok=True)
    
    timestamp = datetime.datetime.now().strftime("%Y_%m_%d_%H%M%S")
    filename = f"school_db_backup_{timestamp}.sql.gz"
    local_filepath = os.path.join(backup_dir, filename)

    # 1. Generate pg_dump gzipped file
    logging.info(f"Dumping database '{db_name}' to {local_filepath}...")
    dump_cmd = f"PGPASSWORD='{db_pass}' pg_dump -U {db_user} -h {db_host} -p {db_port} {db_name} | gzip > '{local_filepath}'"
    res = subprocess.run(dump_cmd, shell=True, capture_output=True, text=True)
    if res.returncode != 0:
        logging.error(f"pg_dump failed: {res.stderr}")
        sys.exit(1)

    file_size = os.path.getsize(local_filepath)
    logging.info(f"Database dump generated successfully! Size: {file_size / (1024*1024):.2f} MB")

    # 2. Upload to AWS S3
    s3_key = f"{s3_folder}/{filename}"
    logging.info(f"Uploading to s3://{bucket_name}/{s3_key}...")
    
    s3 = boto3.client(
        "s3",
        aws_access_key_id=aws_key,
        aws_secret_access_key=aws_secret,
        region_name=region_name
    )

    try:
        s3.upload_file(local_filepath, bucket_name, s3_key)
        logging.info(f"SUCCESS: Uploaded {filename} to s3://{bucket_name}/{s3_key} successfully!")
    except ClientError as e:
        logging.error(f"S3 Upload failed: {e}")
        sys.exit(1)

    # 3. Clean local backups older than 7 days
    logging.info("Cleaning local backups older than 7 days...")
    cutoff = datetime.datetime.now() - datetime.timedelta(days=7)
    for f in glob.glob(os.path.join(backup_dir, "*.sql.gz")):
        try:
            mtime = datetime.datetime.fromtimestamp(os.path.getmtime(f))
            if mtime < cutoff:
                os.remove(f)
                logging.info(f"Removed old local backup: {f}")
        except Exception as err:
            logging.warning(f"Could not remove old backup {f}: {err}")

    logging.info("Backup process finished successfully.")
    logging.info("==========================================\n")

if __name__ == "__main__":
    run_backup()
