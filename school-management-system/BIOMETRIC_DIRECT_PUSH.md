# Biometric direct push

School Conduct can receive supported biometric events directly on its public
TCP listener. A customer-side LAN bridge is not required for devices that can
reach the public server themselves.

## Public listener

- Service: `biometric-tcp.service`
- Bind address: `0.0.0.0`
- Default port: `5555`
- Django command: `python manage.py run_biometric_tcp_server`

The EC2 security group and host firewall must allow inbound TCP port `5555`
from the expected school public IPs. Do not expose any database port.

## SBXPC/M50 setup

1. Register the machine in School Conduct using `TCP XML push`.
2. Prefer the device serial number when the pushed payload contains it.
3. Otherwise set the registered Terminal ID to the SBXPC `MachineID` and
   configure an Allowed Source IP. Machine IDs are not globally unique.
4. On the terminal, set `ManagerPCDomainName` to the School Conduct public
   hostname or IP.
5. Set `ManagerPCPort` to `5555`.
6. Ensure the terminal has a default gateway and DNS server when a hostname is
   used.
7. Perform a test punch and inspect the biometric TCP service log.

SBXPC callback XML is normalized as follows:

| SBXPC field | School Conduct field |
| --- | --- |
| `MachineID` | `TerminalID` |
| `EventType` = `Time Log` | `Event` = `TimeLog` |
| `AttendanceStatus` | `AttendStat` |
| `VerificationMode` | `VerifMode` |

Production audit records confirm that the current M50 firmware sends a plain
`Message` document containing `TerminalType`, `DeviceUID`, `TerminalID`,
`DeviceSerialNo`, `Event`, timestamp fields, `UserID`, `AttendStat`, and
`VerifMode`. The callback-style aliases remain supported for firmware variants.

## Diagnostics and acknowledgements

The listener accepts fragmented XML, multiple XML documents on one connection,
XML declarations, and XML roots other than `Message`. A bounded text and hex
preview of an unrecognized packet is written to the biometric TCP error log.
This is intended to identify a proprietary transport envelope without storing
an unlimited payload.

Environment settings:

```text
BIOMETRIC_TCP_PORT=5555
BIOMETRIC_TCP_ACK_MESSAGE=OK\r\n
BIOMETRIC_SBXPC_ACK_MESSAGE=OK\r\n
BIOMETRIC_SBXPC_CLOSE_AFTER_ACK=True
BIOMETRIC_TCP_DIAGNOSTIC_PREVIEW_BYTES=512
```

M50/SBXPC connections close immediately after the acknowledgement. Production
logs showed that keeping these connections open caused terminals to replay the
same historical transactions continuously. Other TCP/XML integrations retain
their existing `BIOMETRIC_TCP_CLOSE_AFTER_ACK` behavior.

The SBXPC acknowledgement remains configurable because the SDK reference
documents callback XML fields but does not document the device-to-server wire
acknowledgement. Confirm it using a physical-device push. If a terminal still
resends an accepted log, update `BIOMETRIC_SBXPC_ACK_MESSAGE` to the confirmed
vendor response.

## Security and recovery

- These legacy terminals may send unencrypted TCP. Restrict source IPs wherever
  possible and isolate the listener from other services.
- Keep raw event auditing and fingerprint-based deduplication enabled.
- Use stored-log pulling only as recovery for events created while the public
  receiver was unavailable.
- Never identify a school using `MachineID` alone when multiple schools can use
  the same value.
