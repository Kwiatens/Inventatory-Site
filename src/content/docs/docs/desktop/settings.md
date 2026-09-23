---
title: "Settings and printing"
description: "Configure the data folder, printer, DigiKey, background operation, and updates."
---

## Save or cancel settings

Open **6 Settings**. Settings are grouped under System, Devices, and Integrations. Changes to data location, printer, Quick Labels, Scan R1 configuration, and DigiKey settings are staged until **Save**. **Cancel** restores the saved values.

Printer and DigiKey tests use the staged values, so test a draft before saving it.

## Printer and Quick Labels

Configure the printer under **Devices → Printer**. Use the printer test, then save. Stock and rack actions use this configured printer for labels.

**Quick Labels** is nested under Printer. It supports up to twelve shared cable-flag texts and an optional custom wire label. Add, edit, remove, reorder, or test-print presets, then save them. The paired R1 receives the saved list on its next sync.

The custom wire label can be edited and printed directly. Cable flags print normally oriented text on both folded halves, scaled to fit.

## DigiKey

An unconfigured DigiKey section shows **Begin Setup**. Enter the Client ID and Client secret in the wizard. The secret goes to Windows Credential Manager. After setup, account and regional settings and a live credential test are available.

## Background operation

Under **General / Data → Background & startup**, choose whether Inventatory stays available for Scan R1 after the terminal closes. The default is Off.

When enabled, Inventatory starts for the signed-in Windows user and continues the R1 service in the notification area. The tray menu offers **Open Inventatory** and **Quit Inventatory**. Disabling the setting removes its Windows startup entry. It does not run before sign-in.

## Software updates

Choose **Settings → Updates → Check for software updates**. When an update is available, choose **Update to vX.Y.Z**, press `u`, or open the same action through Actions.

The wizard previews release notes, offers to save pending settings, downloads the package, verifies published SHA-256 hashes, and hands off to the installer. Prereleases can be offered by the updater.

Cancel is available during download. After installer handoff the application closes and restarts. A failed replacement preserves the previous installation and presents a retryable error. Inventory data and normal local settings are preserved.

**Auto-check for updates** controls the daily background check and is staged until Save.

## Scan R1

Use **Devices → Inventatory Scan → Begin Setup** for a new device. After provisioning, the panel shows pairing controls and device status. A service-port change takes effect on the next launch. Read [scanner setup](../../scanner/setup/) before changing network access.
