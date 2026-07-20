from django.conf import settings

print("ACK_BYTES", settings.BIOMETRIC_TCP_ACK_MESSAGE.encode("utf-8"))
print("CLOSE_AFTER_ACK", settings.BIOMETRIC_TCP_CLOSE_AFTER_ACK)
print("PORT", settings.BIOMETRIC_TCP_PORT)
print("TIMEOUT", settings.BIOMETRIC_TCP_SOCKET_TIMEOUT)
