from django.apps import AppConfig
import os
import subprocess
import sys

class AttendanceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'attendance'

    def ready(self):
        # Prevent double execution in Django auto-reloader thread
        # When DEBUG is True, Django runs two processes (one is the watcher, the other is the worker)
        # RUN_MAIN environment variable is set to 'true' in the worker process
        from django.conf import settings
        
        # Auto-startup hook is strictly for local development testing (settings.DEBUG = True)
        if settings.DEBUG and 'runserver' in sys.argv:
            is_reloader = '--noreload' not in sys.argv
            is_worker = os.environ.get('RUN_MAIN') == 'true'
            
            # Spawn only in worker when reloader is active, or in the main process when reloader is disabled
            if (is_reloader and is_worker) or (not is_reloader and not is_worker):
                import threading
                threading.Thread(target=self.launch_bridges_deferred, daemon=True).start()


    def launch_bridges_deferred(self):
        import time
        # Delay execution slightly to ensure django startup and database initialization are complete
        time.sleep(2)
        
        from django.conf import settings
        
        exe_path = os.path.join(
            settings.BASE_DIR, 
            "..", "..", 
            "SDK20180628-1", "20180622_SDK", "SDK", "Sample_M50", 
            "C#_SBXPCDLL_Sample", "SBXPCDLLSampleCSharp", "bin", "x86", "Debug", "SBXPCSampleCSharp.exe"
        )
        exe_path = os.path.abspath(exe_path)
        
        if os.path.exists(exe_path):
            from attendance.models import BiometricDevice
            import json
            
            try:
                active_devices = BiometricDevice.objects.filter(is_active=True).select_related('school')
                device_count = active_devices.count()
            except Exception:
                # Silent return if database tables aren't created yet (e.g. during migrations)
                return

            if device_count == 0:
                return

            print(f"[Startup] Found {device_count} active biometric device(s). Spawning background bridges...")
            
            # Ensure directory for runtime device configs exists
            config_dir = os.path.join(settings.BASE_DIR, "attendance", "bridge_configs")
            os.makedirs(config_dir, exist_ok=True)

            creation_flags = 0
            if sys.platform == 'win32':
                creation_flags = 0x08000000  # CREATE_NO_WINDOW
            
            for device in active_devices:
                device_config = {
                    "device_ip": device.device_ip,
                    "device_port": device.device_port,
                    "device_password": device.device_password,
                    "machine_number": device.machine_number,
                    "school_id": device.school.school_id,
                    "server_url": f"http://127.0.0.1:8000/api/attendance/biometric-punch/",
                    "device_secret_key": device.device_secret_key
                }
                
                config_file_name = f"device_{device.id}_config.json"
                config_file_path = os.path.join(config_dir, config_file_name)
                
                try:
                    with open(config_file_path, "w") as f:
                        json.dump(device_config, f, indent=2)
                    
                    subprocess.Popen(
                        [exe_path, config_file_path],
                        cwd=os.path.dirname(exe_path),
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        creationflags=creation_flags
                    )
                    print(f"[Startup] Launched C# Biometric Bridge for: {device.school.name} - {device.name} ({device.device_ip})")
                except Exception as e:
                    print(f"[Startup] ERROR: Failed to launch bridge for {device.name} ({device.device_ip}): {e}")
        else:
            print(f"[Startup] WARNING: Biometric Bridge executable not found at: {exe_path}")
# Trigger reload comment




