from django.apps import AppConfig
import os
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

        from attendance.bridge_runtime import (
            get_bridge_executable_path,
            launch_bridge_hub,
            sync_all_runtime_configs,
        )
        from attendance.models import BiometricDevice

        exe_path = get_bridge_executable_path()
        if not os.path.exists(exe_path):
            print(f"[Startup] WARNING: Biometric Bridge executable not found at: {exe_path}")
            return

        try:
            active_devices = list(BiometricDevice.objects.filter(is_active=True).select_related('school'))
        except Exception:
            # Silent return if database tables aren't created yet (e.g. during migrations)
            return

        if not active_devices:
            return

        print(f"[Startup] Found {len(active_devices)} active biometric device(s). Spawning background bridges...")

        config_paths = sync_all_runtime_configs(active_devices)
        try:
            launch_bridge_hub(config_paths, visible=False)
            for device in active_devices:
                print(f"[Startup] Registered device for bridge hub: {device.school.name} - {device.name} ({device.device_ip})")
        except Exception as e:
            print(f"[Startup] ERROR: Failed to launch bridge hub: {e}")
# Trigger reload comment




