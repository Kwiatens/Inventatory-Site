---
title: "Connection and setup"
description: "Pair a compatible Scan R1 with the Windows desktop application."
---

## Prerequisites

- A compatible Inventatory Scan R1, powered on and nearby.
- Bluetooth available for initial pairing.
- The Windows Inventatory application and your home Wi-Fi credentials.
- A trusted private local network that allows the device to reach the PC.

Read [hardware status](../status/) first. Firmware compatibility and public assembly resources have not been independently verified for this website.

## Pair the device

1. Open **Settings → Devices → Inventatory Scan → Begin Setup**.
2. Choose **Find scanner** in the wizard.
3. Enter the six-digit verification code displayed on the R1.
4. Enter your home Wi-Fi credentials.
5. Complete setup and wait for the device's first report.

Bluetooth LE Secure Connections encrypts and authenticates provisioning. Bluetooth setup then turns off, and normal mDNS discovery starts.

Before the first report, the desktop status reads **Waiting for device**. Once reports arrive, the panel shows online/offline state, device ID, signal, and last contact.

## If the device cannot connect

Check that the PC's device service is running and the device can reach it over the private network. Use the visible status and **Restart bridge** control when troubleshooting. A changed service port takes effect on the next application launch.

Inventatory does not change Windows Firewall settings automatically. If required, allow the executable's current service port on the **Private** profile, limited to the local network. Do not expose the service through public profiles or port forwarding.

The synchronization protocol authenticates traffic but does not provide payload confidentiality. See the [transport specification](https://github.com/Kwiatens/Inventatory-Software/blob/main/docs/scanner-transport-security.md) for details.

## Re-pair or reset

Pairing maintenance is available through **Actions**: re-pair after a firmware update, regenerate the secret, or clear the device. Regeneration invalidates the previous pairing; clearing removes the paired identity. A restored inventory backup also requires fresh pairing.

The documented R1 reset gesture is to hold `#` to erase provisioning and return to setup; queued inventory events remain intact. Confirm that your firmware matches the documented workflow before relying on this gesture.
