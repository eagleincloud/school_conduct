import json
import socket
import time
from datetime import timedelta
from urllib.parse import urlparse

from django.http import HttpResponse
from django.http import JsonResponse
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.utils import timezone
from django.views import View
from rest_framework import permissions, status, views
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from tenants.models import School

from .models import BiometricDevice, generate_device_secret_key
from .serializers import BiometricDeviceSerializer
from .bridge_runtime import (
    delete_device_runtime_config,
    get_bridge_executable_path,
    launch_bridge_hub,
    stop_existing_bridge_processes,
    sync_all_runtime_configs,
    write_device_runtime_config,
)


def _ensure_device_manager(user):
    return user.is_authenticated and user.role in ('admin', 'superadmin')


def _get_school_scope(request):
    user = request.user
    if user.role == 'admin':
        return user.school

    school_ref = request.query_params.get('school') or request.data.get('school')
    if not school_ref:
        return None

    school_qs = School.objects.all()
    if str(school_ref).isdigit():
        return get_object_or_404(school_qs, id=int(school_ref))
    return get_object_or_404(school_qs, school_id=school_ref)


def _device_queryset_for_user(user):
    qs = BiometricDevice.objects.select_related('school')
    if user.role == 'admin':
        return qs.filter(school=user.school)
    if user.role == 'superadmin':
        return qs
    return qs.none()


def _probe_device_tcp(device_ip, device_port, timeout_seconds=3.0):
    started = timezone.now()
    with socket.create_connection((device_ip, int(device_port)), timeout=timeout_seconds):
        latency_ms = max(1, int((timezone.now() - started).total_seconds() * 1000))
    return latency_ms


def _probe_local_tcp_listener(device_port, timeout_seconds=3.0):
    started = timezone.now()
    with socket.create_connection(("127.0.0.1", int(device_port)), timeout=timeout_seconds):
        latency_ms = max(1, int((timezone.now() - started).total_seconds() * 1000))
    return latency_ms


def _should_refresh_connectivity(device, cooldown_seconds=15):
    if not device.is_active:
        return False
    if not device.device_ip or not device.device_port:
        return device.integration_mode == 'tcp_xml_push'
    if not device.last_tested_at:
        return True
    return device.last_tested_at < timezone.now() - timedelta(seconds=cooldown_seconds)


def _refresh_device_connectivity(device, timeout_seconds=1.5):
    if device.integration_mode in {'tcp_xml_push', 'http_push'}:
        listener = _tcp_listener_config()
        try:
            latency_ms = _probe_local_tcp_listener(listener['port'], timeout_seconds=timeout_seconds)
            message = (
                f"EC2 TCP listener {listener['host']}:{listener['port']} is ready. "
                "Waiting for the biometric machine to push attendance."
            )
            device.mark_test_result(True, message)
            return True, latency_ms
        except Exception as exc:
            message = f"EC2 TCP listener {listener['host']}:{listener['port']} is not reachable locally. {exc}"
            device.mark_test_result(False, message)
            return False, None

    try:
        latency_ms = _probe_device_tcp(device.device_ip, device.device_port, timeout_seconds=timeout_seconds)
        device.mark_test_result(True, f'TCP connectivity to {device.device_ip}:{device.device_port} is working.')
        return True, latency_ms
    except Exception as exc:
        device.mark_test_result(False, f'Could not reach {device.device_ip}:{device.device_port}. {exc}')
        return False, None


def _refresh_queryset_connectivity(devices, cooldown_seconds=15, timeout_seconds=1.5):
    for device in devices:
        if _should_refresh_connectivity(device, cooldown_seconds=cooldown_seconds):
            _refresh_device_connectivity(device, timeout_seconds=timeout_seconds)


def _default_bridge_url(request):
    return f"{settings.PUBLIC_API_BASE_URL}/api/attendance/biometric-punch/"


def _tcp_listener_config():
    return {
        'host': settings.BIOMETRIC_TCP_HOST,
        'port': settings.BIOMETRIC_TCP_PORT,
        'ack_message': settings.BIOMETRIC_TCP_ACK_MESSAGE,
    }


class BiometricDeviceListCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not _ensure_device_manager(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        queryset = _device_queryset_for_user(request.user)
        school_scope = _get_school_scope(request)
        if school_scope is not None:
            queryset = queryset.filter(school=school_scope)

        devices = list(queryset.order_by('school__name', 'name', 'id'))
        _refresh_queryset_connectivity(devices)
        serializer = BiometricDeviceSerializer(devices, many=True)
        return Response(serializer.data)

    def post(self, request):
        if not _ensure_device_manager(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        serializer = BiometricDeviceSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        device = serializer.save()
        write_device_runtime_config(device, _default_bridge_url(request))
        return Response(BiometricDeviceSerializer(device).data, status=status.HTTP_201_CREATED)


class BiometricDeviceDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, request, device_id):
        if not _ensure_device_manager(request.user):
            return None
        return get_object_or_404(_device_queryset_for_user(request.user), id=device_id)

    def get(self, request, device_id):
        device = self.get_object(request, device_id)
        serializer = BiometricDeviceSerializer(device)
        return Response(serializer.data)

    def patch(self, request, device_id):
        device = self.get_object(request, device_id)
        serializer = BiometricDeviceSerializer(device, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        device = serializer.save()
        write_device_runtime_config(device, _default_bridge_url(request))
        return Response(BiometricDeviceSerializer(device).data)

    def delete(self, request, device_id):
        device = self.get_object(request, device_id)
        delete_device_runtime_config(device.id)
        device.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BiometricDeviceConnectionProbeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not _ensure_device_manager(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        device_ip = request.data.get('device_ip')
        device_port = request.data.get('device_port', 4370)
        timeout_seconds = float(request.data.get('timeout_seconds') or 3)
        integration_mode = request.data.get('integration_mode') or 'bridge_pull'

        if integration_mode != 'tcp_xml_push' and not device_ip:
            return Response({'error': 'device_ip is required'}, status=status.HTTP_400_BAD_REQUEST)

        if integration_mode in {'tcp_xml_push', 'http_push'}:
            listener = _tcp_listener_config()
            try:
                latency_ms = _probe_local_tcp_listener(listener['port'], timeout_seconds=timeout_seconds)
            except Exception as exc:
                return Response(
                    {
                        'ok': False,
                        'message': f"EC2 TCP listener {listener['host']}:{listener['port']} is not ready. {exc}",
                        'listener': listener,
                    },
                    status=status.HTTP_200_OK,
                )

            return Response(
                {
                    'ok': True,
                    'message': (
                        f"EC2 TCP listener {listener['host']}:{listener['port']} is ready. "
                        "This does not confirm whether the biometric device has started pushing yet."
                    ),
                    'latency_ms': latency_ms,
                    'listener': listener,
                }
            )

        try:
            latency_ms = _probe_device_tcp(device_ip, device_port, timeout_seconds=timeout_seconds)
        except Exception as exc:
            return Response(
                {
                    'ok': False,
                    'message': f'Could not reach {device_ip}:{device_port}. {exc}',
                    'device_ip': device_ip,
                    'device_port': device_port,
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                'ok': True,
                'message': f'TCP connectivity to {device_ip}:{device_port} is working.',
                'latency_ms': latency_ms,
                'device_ip': device_ip,
                'device_port': device_port,
                'note': 'This checks network reachability. It does not validate fingerprint SDK login credentials.',
            }
        )


class BiometricDeviceTestView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, device_id):
        if not _ensure_device_manager(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        device = get_object_or_404(_device_queryset_for_user(request.user), id=device_id)
        if device.integration_mode in {'tcp_xml_push', 'http_push'}:
            listener = _tcp_listener_config()
            try:
                latency_ms = _probe_local_tcp_listener(listener['port'])
                message = (
                    f"EC2 TCP listener {listener['host']}:{listener['port']} is ready. "
                    "Waiting for the biometric machine to push attendance."
                )
                device.mark_test_result(True, message)
                return Response(
                    {
                        'ok': True,
                        'message': message,
                        'latency_ms': latency_ms,
                        'device': BiometricDeviceSerializer(device).data,
                        'listener': listener,
                        'note': 'For direct push devices, online status depends on recent punch events received by EC2.',
                    }
                )
            except Exception as exc:
                message = f"EC2 TCP listener {listener['host']}:{listener['port']} is not ready. {exc}"
                device.mark_test_result(False, message)
                return Response(
                    {
                        'ok': False,
                        'message': message,
                        'device': BiometricDeviceSerializer(device).data,
                        'listener': listener,
                    },
                    status=status.HTTP_200_OK,
                )

        try:
            latency_ms = _probe_device_tcp(device.device_ip, device.device_port)
            message = f'TCP connectivity to {device.device_ip}:{device.device_port} is working.'
            device.mark_test_result(True, message)
            return Response(
                {
                    'ok': True,
                    'message': message,
                    'latency_ms': latency_ms,
                    'device': BiometricDeviceSerializer(device).data,
                    'note': 'This checks network reachability. It does not validate fingerprint SDK login credentials.',
                }
            )
        except Exception as exc:
            message = f'Could not reach {device.device_ip}:{device.device_port}. {exc}'
            device.mark_test_result(False, message)
            return Response(
                {
                    'ok': False,
                    'message': message,
                    'device': BiometricDeviceSerializer(device).data,
                },
                status=status.HTTP_200_OK,
            )


class BiometricDeviceRotateSecretView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, device_id):
        if not _ensure_device_manager(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        device = get_object_or_404(_device_queryset_for_user(request.user), id=device_id)
        device.device_secret_key = generate_device_secret_key()
        device.save(update_fields=['device_secret_key'])
        write_device_runtime_config(device, _default_bridge_url(request))
        return Response(
            {
                'message': 'Device secret key rotated successfully.',
                'device': BiometricDeviceSerializer(device).data,
            }
        )


class BiometricDeviceConfigDownloadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, device_id):
        if not _ensure_device_manager(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        device = get_object_or_404(_device_queryset_for_user(request.user), id=device_id)
        config_payload = device.build_bridge_config(_default_bridge_url(request))
        body = json.dumps(config_payload, indent=2)
        response = HttpResponse(body, content_type='application/json')
        response['Content-Disposition'] = f'attachment; filename="device_{device.id}_bridge_config.json"'
        return response


class BiometricDeviceBridgePreviewView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, device_id):
        if not _ensure_device_manager(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        device = get_object_or_404(_device_queryset_for_user(request.user), id=device_id)
        server_url = device.get_effective_server_url(_default_bridge_url(request))
        parsed = urlparse(server_url)
        serializer = BiometricDeviceSerializer(device)
        listener = _tcp_listener_config()
        setup_note = 'Use this config file with the C# bridge executable on the same network as the biometric machine.'
        if device.integration_mode in {'tcp_xml_push', 'http_push'}:
            setup_note = 'Configure the biometric machine to push attendance directly to this public listener.'
        return Response(
            {
                'device': serializer.data,
                'config': device.build_bridge_config(_default_bridge_url(request)),
                'network_target': {
                    'scheme': parsed.scheme,
                    'host': parsed.hostname,
                    'port': parsed.port,
                    'path': parsed.path,
                },
                'tcp_listener': listener,
                'launch_note': setup_note,
            }
        )


class BiometricBridgeLaunchView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not _ensure_device_manager(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        exe_path = get_bridge_executable_path()
        if not exe_path:
            return Response({'error': 'Bridge executable path could not be resolved.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        visible = bool(request.data.get('visible'))
        restart = bool(request.data.get('restart', True))

        queryset = _device_queryset_for_user(request.user).filter(
            is_active=True,
            integration_mode='bridge_pull',
        ).select_related('school')
        school_scope = _get_school_scope(request)
        if school_scope is not None:
            queryset = queryset.filter(school=school_scope)

        devices = list(queryset.order_by('school__name', 'name', 'id'))
        if not devices:
            return Response(
                {'error': 'No active biometric devices found for launch in the selected scope.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if restart:
            stop_existing_bridge_processes()

        config_paths = sync_all_runtime_configs(devices, _default_bridge_url(request))

        launched = [
            {
                'id': device.id,
                'name': device.name,
                'school': device.school.school_id,
                'device_ip': device.device_ip,
                'device_port': device.device_port,
                'machine_number': device.machine_number,
            }
            for device in devices
        ]
        failed = []

        try:
            launch_bridge_hub(config_paths, visible=visible)
        except Exception as exc:
            failed.append({'error': str(exc)})
            launched = []

        return Response(
            {
                'message': f'Started 1 biometric bridge hub for {len(launched)} device(s).',
                'restart': restart,
                'visible': visible,
                'launched_count': len(launched),
                'failed_count': len(failed),
                'launched': launched,
                'failed': failed,
            }
        )


class BiometricDeviceStatusStreamView(View):
    def get(self, request):
        token = (request.GET.get('token') or '').strip()
        if not token:
            return JsonResponse({'error': 'token is required'}, status=status.HTTP_401_UNAUTHORIZED)

        authenticator = JWTAuthentication()
        try:
            validated_token = authenticator.get_validated_token(token)
            user = authenticator.get_user(validated_token)
        except Exception:
            return JsonResponse({'error': 'Invalid token'}, status=status.HTTP_401_UNAUTHORIZED)

        if not _ensure_device_manager(user):
            return JsonResponse({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        school_scope = None
        school_ref = request.GET.get('school')
        if user.role == 'admin':
            school_scope = user.school
        elif school_ref:
            school_qs = School.objects.all()
            if str(school_ref).isdigit():
                school_scope = get_object_or_404(school_qs, id=int(school_ref))
            else:
                school_scope = get_object_or_404(school_qs, school_id=school_ref)

        def event_stream():
            while True:
                queryset = _device_queryset_for_user(user)
                if school_scope is not None:
                    queryset = queryset.filter(school=school_scope)
                devices = list(queryset.order_by('school__name', 'name', 'id'))
                _refresh_queryset_connectivity(devices)
                serializer = BiometricDeviceSerializer(
                    devices,
                    many=True,
                )
                payload = {
                    'devices': serializer.data,
                    'generated_at': timezone.now().isoformat(),
                }
                yield f"data: {json.dumps(payload)}\n\n"
                time.sleep(5)

        response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response
