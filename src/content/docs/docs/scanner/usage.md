---
title: "Using a paired scanner"
description: "Use the documented Scan R1 menu and quick-label integration."
---

## Confirm the PC is available

Open **Settings → Devices → Inventatory Scan** and check that the R1 has reported online. The desktop service must be running. Optional **Background & startup** operation keeps it available after the terminal window closes.

The paired-device service is not a browser or phone-camera scanning page. It accepts the authenticated R1 device API.

## Quick Labels

1. Configure a working PC printer and save your presets under **Settings → Devices → Printer → Quick Labels**.
2. On an idle R1, press `C` for the device menu.
3. Open **Quick Labels**. It checks the paired PC for the latest presets.
4. Use `D` for the next page when needed.
5. Select a preset to request an immediate print through the PC printer.

Offline or failed quick-label requests are not a general offline print queue. Check the device result before retrying.

## Quick Settings

The documented device menu includes LCD contrast, standby, OTA, and a confirmed re-pair action. Public firmware release instructions are not verified here, so this guide does not prescribe an OTA image or update procedure.

## Scanning workflow coverage

The desktop integration supports scanner events and component lookup. A complete, current on-device walkthrough for all scan and quantity operations still needs verification against the released hardware and firmware. This guide deliberately does not invent key sequences for those operations.

Read [hardware and firmware status](../status/) for the remaining documentation gaps.
