import json
import os
import subprocess
import sys

from django.conf import settings


def get_bridge_executable_path():
    return os.path.abspath(
        os.path.join(
            settings.BASE_DIR,
            "..",
            "..",
            "SDK20180628-1",
            "20180622_SDK",
            "SDK",
            "Sample_M50",
            "C#_SBXPCDLL_Sample",
            "SBXPCDLLSampleCSharp",
            "bin",
            "x86",
            "Debug",
            "SBXPCSampleCSharp.exe",
        )
    )


def get_runtime_config_dir():
    config_dir = os.path.join(settings.BASE_DIR, "attendance", "bridge_configs")
    os.makedirs(config_dir, exist_ok=True)
    return config_dir


def get_default_server_url():
    return f"{settings.PUBLIC_API_BASE_URL}/api/attendance/biometric-punch/"


def get_device_config_path(device_id):
    return os.path.join(get_runtime_config_dir(), f"device_{device_id}_config.json")


def write_device_runtime_config(device, default_server_url=None):
    default_server_url = default_server_url or get_default_server_url()
    config_path = get_device_config_path(device.id)
    with open(config_path, "w", encoding="utf-8") as handle:
        json.dump(device.build_bridge_config(default_server_url), handle, indent=2)
    return config_path


def delete_device_runtime_config(device_id):
    config_path = get_device_config_path(device_id)
    if os.path.exists(config_path):
        os.remove(config_path)


def sync_all_runtime_configs(devices, default_server_url=None):
    default_server_url = default_server_url or get_default_server_url()
    config_paths = []
    for device in devices:
        config_paths.append(write_device_runtime_config(device, default_server_url))
    return config_paths


def launch_bridge_process(config_path, visible=False):
    exe_path = get_bridge_executable_path()
    if not os.path.exists(exe_path):
        raise FileNotFoundError(f"Bridge executable not found: {exe_path}")

    working_dir = os.path.dirname(exe_path)
    if visible and sys.platform == "win32":
        return subprocess.Popen(
            [exe_path, config_path],
            cwd=working_dir,
            creationflags=0x00000010,  # CREATE_NEW_CONSOLE
        )

    creation_flags = 0x08000000 if sys.platform == "win32" else 0
    return subprocess.Popen(
        [exe_path, config_path],
        cwd=working_dir,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=creation_flags,
    )


def launch_bridge_hub(config_paths, visible=False):
    exe_path = get_bridge_executable_path()
    if not os.path.exists(exe_path):
        raise FileNotFoundError(f"Bridge executable not found: {exe_path}")
    if not config_paths:
        raise ValueError("At least one config path is required to launch the bridge hub.")

    working_dir = os.path.dirname(exe_path)
    args = [exe_path] + list(config_paths)
    if visible and sys.platform == "win32":
        return subprocess.Popen(args, cwd=working_dir, creationflags=0x00000010)

    creation_flags = 0x08000000 if sys.platform == "win32" else 0
    return subprocess.Popen(
        args,
        cwd=working_dir,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=creation_flags,
    )


def stop_existing_bridge_processes():
    if sys.platform != "win32":
        return
    subprocess.run(
        ["taskkill", "/IM", "SBXPCSampleCSharp.exe", "/F"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
