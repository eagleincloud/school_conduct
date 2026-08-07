from attendance.models import BiometricEventLog
logs = BiometricEventLog.objects.all().order_by('-received_at')[:5]
for log in logs:
    print(log.received_at, log.user_identifier, log.status, log.error_message)
