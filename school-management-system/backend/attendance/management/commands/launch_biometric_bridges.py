from django.core.management.base import BaseCommand, CommandError

from attendance.bridge_runtime import (
    get_bridge_executable_path,
    launch_bridge_hub,
    stop_existing_bridge_processes,
    sync_all_runtime_configs,
)
from attendance.models import BiometricDevice


class Command(BaseCommand):
    help = "Launch one biometric bridge process per active registered machine."

    def add_arguments(self, parser):
        parser.add_argument(
            "--visible",
            action="store_true",
            help="Open each bridge in its own visible cmd window.",
        )
        parser.add_argument(
            "--restart",
            action="store_true",
            help="Stop existing bridge processes before launching all active devices.",
        )
        parser.add_argument(
            "--school",
            type=str,
            help="Optional school_id filter, for example DEFAULT.",
        )

    def handle(self, *args, **options):
        exe_path = get_bridge_executable_path()
        if not exe_path:
            raise CommandError("Bridge executable path could not be resolved.")

        import os

        if not os.path.exists(exe_path):
            raise CommandError(f"Bridge executable not found: {exe_path}")

        queryset = BiometricDevice.objects.filter(is_active=True).select_related("school")
        school_id = (options.get("school") or "").strip()
        if school_id:
            queryset = queryset.filter(school__school_id__iexact=school_id)

        devices = list(queryset.order_by("school__name", "name", "id"))
        if not devices:
            self.stdout.write(self.style.WARNING("No active biometric devices found for launch."))
            return

        if options["restart"]:
            stop_existing_bridge_processes()
            self.stdout.write("Stopped existing bridge processes.")

        config_paths = sync_all_runtime_configs(devices)

        try:
            launch_bridge_hub(config_paths, visible=options["visible"])
        except Exception as exc:
            raise CommandError(f"Failed to launch biometric bridge hub: {exc}")

        for device in devices:
            self.stdout.write(
                f"Registered device in bridge hub: {device.school.school_id} | {device.name} | {device.device_ip}:{device.device_port} | machine {device.machine_number}"
            )

        self.stdout.write(self.style.SUCCESS(f"Started 1 biometric bridge hub for {len(devices)} device(s)."))
