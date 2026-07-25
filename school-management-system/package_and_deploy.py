import os
import tarfile
import subprocess
import sys

def run_command(cmd, cwd=None, shell=False):
    print(f"Running: {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    res = subprocess.run(cmd, cwd=cwd, shell=shell, text=True)
    if res.returncode != 0:
        print(f"Error executing command: {cmd}")
        sys.exit(res.returncode)
    return res

def main():
    workspace_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(workspace_dir, "frontend")
    backend_dir = os.path.join(workspace_dir, "backend")
    pem_path = r"C:\Users\Ankit\OneDrive\Desktop\EIC\school-conduct.pem"
    ssh_host = "ec2-user@ec2-13-201-53-169.ap-south-1.compute.amazonaws.com"
    
    # 1. Build Frontend
    print("\n--- 1. Building Frontend ---")
    # Using npm.cmd on Windows, npm on other platforms
    npm_cmd = "npm.cmd" if os.name == 'nt' else "npm"
    run_command([npm_cmd, "run", "build"], cwd=frontend_dir)
    
    # 2. Package Frontend
    print("\n--- 2. Packaging Frontend ---")
    dist_dir = os.path.join(frontend_dir, "dist")
    frontend_tar = os.path.join(workspace_dir, "frontend.tar.gz")
    
    if os.path.exists(frontend_tar):
        os.remove(frontend_tar)
        
    with tarfile.open(frontend_tar, "w:gz") as tar:
        for root, dirs, files in os.walk(dist_dir):
            for file in files:
                file_path = os.path.join(root, file)
                # Store relative to the dist directory
                arcname = os.path.relpath(file_path, dist_dir)
                tar.add(file_path, arcname=arcname)
    print(f"Frontend packaged successfully to {frontend_tar}")

    # 3. Package Backend
    print("\n--- 3. Packaging Backend ---")
    backend_tar = os.path.join(workspace_dir, "backend.tar.gz")
    
    if os.path.exists(backend_tar):
        os.remove(backend_tar)

    exclude_dirs = {".venv", "venv", "db.sqlite3", "__pycache__", "staticfiles", "media", ".git", ".github", ".idea", ".vscode"}
    
    with tarfile.open(backend_tar, "w:gz") as tar:
        for root, dirs, files in os.walk(backend_dir):
            # Modify dirs in-place to skip excluded directories recursively
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            for file in files:
                if file.endswith('.pyc') or file == '.env':
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, backend_dir)
                tar.add(file_path, arcname=arcname)
    print(f"Backend packaged successfully to {backend_tar}")

    # 4. Upload files to EC2 via SCP
    print("\n--- 4. Uploading Archives and Configuration to EC2 ---")
    scp_files = [
        (frontend_tar, "/home/ec2-user/frontend.tar.gz"),
        (backend_tar, "/home/ec2-user/backend.tar.gz"),
        (os.path.join(workspace_dir, "deploy_remote.sh"), "/home/ec2-user/deploy_remote.sh"),
        (os.path.join(backend_dir, ".env"), "/home/ec2-user/backend.env"),
        (os.path.join(workspace_dir, "deploy", "nginx.conf"), "/home/ec2-user/nginx.conf"),
        (os.path.join(workspace_dir, "deploy", "school.conf"), "/home/ec2-user/school.conf")
    ]
    
    for local_file, remote_dest in scp_files:
        print(f"Uploading {os.path.basename(local_file)}...")
        scp_cmd = [
            "scp",
            "-i", pem_path,
            "-o", "StrictHostKeyChecking=no",
            local_file,
            f"{ssh_host}:{remote_dest}"
        ]
        run_command(scp_cmd)
        
    print("Uploads completed.")

    # 5. Run deploy_remote.sh via SSH
    print("\n--- 5. Running remote deployment script ---")
    ssh_cmd = [
        "ssh",
        "-i", pem_path,
        "-o", "StrictHostKeyChecking=no",
        ssh_host,
        "sed -i 's/\\r$//' /home/ec2-user/deploy_remote.sh && chmod +x /home/ec2-user/deploy_remote.sh && /home/ec2-user/deploy_remote.sh"
    ]
    run_command(ssh_cmd)
    
    print("\nDeployment completed successfully!")

if __name__ == "__main__":
    main()
