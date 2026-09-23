---
title: "Inventatory Scan R1"
description: "Understand the role of the handheld scanner and its integration with the desktop application."
---

Scan R1 is the dedicated handheld companion to Inventatory. Its desktop integration connects device events, component lookup, inventory operations, and label requests to the PC's inventory and printer.

The scanner complements the desktop application. The PC retains the inventory database and runs the authenticated device service; ordinary stock management does not require a scanner.

## How the connection works

1. **Physical pairing:** verify the scanner using the six-digit code shown on the device and Bluetooth LE setup.
2. **Local-network discovery:** the provisioned device finds the PC using mDNS.
3. **Authenticated synchronization:** the paired device and PC authenticate requests and responses, with protection against replayed events.

mDNS is discovery only. The normal HTTP synchronization authenticates messages but does **not** encrypt their content. Keep the service on a trusted private local network.

## Before you try it

Public hardware and firmware distribution have not been verified. These guides describe the existing desktop integration and the documented workflow for a compatible R1 already in hand. They are not assembly instructions or a claim that hardware is available to purchase.

- [Connect a compatible device](setup/).
- [Use a paired scanner](usage/).
- [Read hardware and firmware status](status/).

No authentic scanner photograph or demonstration recording was supplied for this website. Product imagery will be added when available; the site does not substitute a fictional device.
