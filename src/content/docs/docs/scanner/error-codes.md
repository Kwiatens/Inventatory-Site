---
title: "Error codes"
description: "What each Scan R1 error code means, where it appears on the scanner and what to check."
---

Every problem the scanner reports has an error code: three letters, a dash and two digits. Find the code on the screen and look it up here. The numbers run in order within each area, with no gaps.

## Where the codes appear

- **Fault mark.** While a problem stands, a black exclamation mark shows at the top right of the screen. A problem is the barcode scanner not running, a queue that cannot be read, a blocked sync, or a battery reading that cannot be trusted. The main screen then reads **There is a problem** with the code under it, and its footer offers `# Fault info`. Press `#` for the explanation. The menu offers the same action.
- **Result screens.** A failed action shows its message, with the code on the line below.
- **Pairing screens.** The code is on the bottom line.
- **Print failures.** The code is under the message, in place of the usual hint.
- **Start-up.** A start-up stage that fails shows its code under the stage name.

The low and empty battery warnings show no code. Their entries below give the words the screen shows instead.

When several problems stand at once, the main screen shows each code in turn, about every three seconds. The fault info screen turns with it, so `#` explains the code on show.

## Summary

| Code | Problem |
| --- | --- |
| [SCN-01](#scn-01-scanner-not-replying) | Scanner not replying |
| [SCN-02](#scn-02-scan-data-cannot-be-saved) | Scan data cannot be saved |
| [STO-01](#sto-01-queue-full) | Queue full |
| [STO-02](#sto-02-scan-not-saved) | Scan not saved |
| [STO-03](#sto-03-queue-unreadable) | Queue unreadable |
| [STO-04](#sto-04-could-not-repair-queue) | Could not repair queue |
| [STO-05](#sto-05-could-not-discard-scan) | Could not discard scan |
| [SYN-01](#syn-01-sync-blocked) | Sync blocked |
| [PAI-01](#pai-01-pairing-locked) | Pairing locked |
| [PAI-02](#pai-02-could-not-save-setup) | Could not save setup |
| [PAI-03](#pai-03-check-wi-fi-details) | Check Wi-Fi details |
| [PAI-04](#pai-04-could-not-clear-pairing) | Could not clear pairing |
| [SYS-01](#sys-01-network-service-did-not-start) | Network service did not start |
| [SYS-02](#sys-02-bluetooth-did-not-start) | Bluetooth did not start |
| [OTA-01](#ota-01-update-failed) | Update failed |
| [OTA-02](#ota-02-no-update-received) | No update received |
| [PRT-01](#prt-01-pc-or-printer-offline) | PC or printer offline |
| [PRT-02](#prt-02-pc-offline) | PC offline |
| [PRT-03](#prt-03-refresh-presets-first) | Refresh presets first |
| [PWR-01](#pwr-01-battery-not-read) | Battery not read |

## Scanner

### SCN-01 Scanner not replying

**Shown:** the fault mark and the main screen's "There is a problem". At start-up, "Scanner error". After standby, the result "Check scanner cable".

**Means:** the barcode scanner did not answer when the device started or woke from standby. Standby is not a fault, because the scanner is switched off on purpose.

**What to do:**

- Check the scanner's cable at both ends.
- Restart the device: hold `*` until it powers off, then press `*` to start it again.

The device checks the scanner only at start-up and when it wakes from standby. If the scanner is unplugged while the device is on, no fault shows until the device restarts.

A barcode the scanner does not recognise is ignored, and the screen does not change. Scans are also ignored while a confirmation, a firmware update or a label print is on screen. Neither case shows a code. To add a scan, use an Inventatory code or a standard component label, with the scanner aimed at the whole code.

### SCN-02 Scan data cannot be saved

**Shown:** the result "Scan data cannot be saved", with SCN-02 below it.

**Means:** the scanner read a component label whose part name is longer than 64 characters, and the label has no valid part number to use instead. The device will not keep a name that long, so the scan is not queued.

**What to do:** scan the label again. If the same label always fails, the device cannot store it. Report the label.

## Offline queue and storage

Scans wait on the device until the PC accepts them. The codes below concern that queue.

### STO-01 Queue full

**Shown:** the result "Sync PC before scanning", with STO-01 below it.

**Means:** 16 scans are waiting on the device, which is the most it holds. The new scan was not queued.

**What to do:** keep the device on Wi-Fi, with Inventatory running on the PC. The queue empties as the PC accepts the scans.

### STO-02 Scan not saved

**Shown:** the result "Scan storage write failed", with STO-02 below it. If the scan storage did not open at start-up, or the queue cannot be read (STO-03), every scan shows this code.

**Means:** the device could not write the scan to its storage. The scan is not queued, and the device does not show it as queued.

**What to do:** scan again after a restart. If the code keeps appearing, the storage may be faulty. Keep a record of the scans, and report the code.

### STO-03 Queue unreadable

**Shown:** the main screen reads "There is a problem" with "Error code STO-03" under it, in turn with any other problem. The menu offers "3 Repair scan queue".

**Means:** the saved queue holds scans that were written by another firmware version, or its header is damaged. The device cannot read those scans, so it cannot send them, and it cannot save new scans until the queue is repaired. An empty queue from another version does not show this code: after an update, the device takes it over.

**What to do:** press `C`, then `3`, then `A`. The repair screen says what it will delete:

- "Unreadable scans are lost", with "Readable ones are kept": repair removes only the scans it cannot read.
- "Queued scans cannot be read", with "Repair deletes them for good": repair removes every queued scan.

### STO-04 Could not repair queue

**Shown:** the result "Could not repair queue", with STO-04 below it.

**Means:** the device could not write the repaired queue to its storage.

**What to do:** try the repair again from the menu. If it keeps failing, restart the device and try once more.

### STO-05 Could not discard scan

**Shown:** the result "Could not discard scan", with STO-05 below it.

**Means:** the device could not remove the oldest scan from the queue. The scan is still queued.

**What to do:** try to discard it again. If it keeps failing, restart the device.

## Sync with the PC

### SYN-01 Sync blocked

**Shown:** the main screen reads "There is a problem" with "Error code SYN-01" under it, in turn with any other problem. The menu offers "3 Discard stuck scan".

**Means:** the PC answered the oldest queued scan with an error, or did not accept it, five times in a row. The device keeps that scan, and the scans queued behind it wait.

**What to do:** check the scan on the PC. If the PC should have accepted it, fix the cause and the queue sends again. If the scan has to go, press `C`, then `3`, then `A`. A discarded scan is deleted for good.

## Pairing and Wi-Fi setup

### PAI-01 Pairing locked

**Shown:** the screen "Pairing locked", with "Press A to try again" and PAI-01 below it.

**Means:** the passcode was entered wrongly three times, or the scanner advertised for five minutes without a pairing. Pairing stays locked until someone presses `A` on the scanner.

**What to do:** press `A` on the scanner only when you started the pairing. Then start the pairing again from the PC.

### PAI-02 Could not save setup

**Shown:** the screen "Could not save setup", with PAI-02 below it.

**Means:** the scanner joined the Wi-Fi network, but could not save the setup, so the setup is not kept.

**What to do:** pair the scanner again. If it fails again, restart the scanner first.

### PAI-03 Check Wi-Fi details

**Shown:** the screen "Pairing failed", with "Could not connect" and "Check Wi-Fi details", and PAI-03 below it.

**Means:** the scanner did not join the Wi-Fi network within 20 seconds.

**What to do:** check the network name and password. The scanner joins 2.4 GHz networks only, so a 5 GHz-only network will not work. Then pair the scanner again.

### PAI-04 Could not clear pairing

**Shown:** the result "Could not clear pairing", with PAI-04 below it.

**Means:** the scanner could not remove its pairing, so it keeps the current one. This happens when the network service stays busy for more than a second, or the stored setup cannot be cleared.

**What to do:** try the re-pair again. If it keeps failing, restart the scanner.

## Start-up

### SYS-01 Network service did not start

**Shown:** the screen "Pairing failed" with "Could not connect" and "Try pairing again", and SYS-01 below it.

**Means:** the scanner has its saved setup, but its network service would not start, so it went back to pairing.

**What to do:** restart the scanner. If it returns to this screen, report the code.

### SYS-02 Bluetooth did not start

**Shown:** the start-up screen "Bluetooth error", with SYS-02 under it.

**Means:** the Bluetooth service that pairing needs did not start.

**What to do:** restart the scanner. If it repeats, report the code.

## Firmware update

### OTA-01 Update failed

**Shown:** the result "Update failed", with OTA-01 below it.

**Means:** the update over Wi-Fi stopped during authentication, the connection or the transfer. The scanner carries on with the firmware it had.

**What to do:** make sure the scanner and the computer sending the update are on the same local network, then try again. Firmware update steps are not part of this reference.

### OTA-02 No update received

**Shown:** the result "No update received", with OTA-02 below it.

**Means:** the scanner waited two minutes for an update, and none arrived. It went back to normal use.

**What to do:** start the update again when you are ready. Press `C` to stop the wait early.

## Quick labels

### PRT-01 PC or printer offline

**Shown:** the screen "Print failed" with "PC OR PRINTER OFFLINE", and PRT-01 under it.

**Means:** the PC did not answer the print request in time.

**What to do:** check that Inventatory is running on the PC, and that the printer is on and connected. Then select the preset again.

### PRT-02 PC offline

**Shown:** the screen "Print failed" with "PC OFFLINE", and PRT-02 below it.

**Means:** the scanner is not connected to Wi-Fi, so the request was not sent. Nothing was printed.

**What to do:** wait for the scanner to reconnect, and check that the Wi-Fi network is in range and working. If the network has changed, pair the scanner again.

### PRT-03 Refresh presets first

**Shown:** the screen "Print failed" with "REFRESH PRESETS FIRST", and PRT-03 below it.

**Means:** the scanner has no current list of presets from the PC, or the PC does not support Quick Labels.

**What to do:** open **Quick Labels** again while the PC is running. If the message stays, update Inventatory on the PC.

## Battery

The battery level is an estimate. The low and empty warnings below come from it. They show no code. Only a battery reading that cannot be trusted has one, PWR-01.

### Battery low or empty

**Shown:** for a low battery, the screen "Battery low", with "Dock to charge" and a countdown, "Powering off in N s". At start-up, it reads "Battery low" with "Charge to power on". For an empty battery, the screen reads "Battery empty", with "Charge to power on", for about four seconds, then the scanner powers off. Neither warning shows a code.

**Means:** a low battery is at about 10 percent or less. The scanner powers off after 60 seconds unless it is docked. At start-up, a low battery that is not docked is refused the same way, and the scanner goes back to sleep. An empty battery is at about 3 percent or less.

**What to do:** put the scanner in its dock. Charging cancels the countdown. Charge the scanner in its dock before you use it.

### PWR-01 Battery not read

**Shown:** on the main screen, "There is a problem" with PWR-01 below it, in turn with any other code that stands. The top bar shows the warning mark and no battery level. `#` opens the fault info screen, which reads "Battery not read", "Voltage not valid" and "Check battery wiring".

**Means:** the battery voltage has been outside the range the scanner accepts, 2.5 V to 4.5 V, for four seconds in a row. A battery that is not connected, or a broken voltage wire, can cause this. The scanner cannot tell how much charge is left, so it does not warn or power off because of the battery.

**What to do:** check the battery connection and the voltage wiring. If the code stays after the battery is connected, report it.

## Codes from the PC

Some results come from the PC rather than the scanner. The scanner then shows the message and the code the PC sent, on the line where a scanner code would be, such as `unknown_item` for an item the PC does not have. Those codes are not in this list, because the PC application defines them.

## Report a code that is not listed

If the scanner shows a code that is not on this page, or a code here does not match what you see, report it on the [firmware issue tracker](https://github.com/Kwiatens/Inventatory-Firmware/issues). Include the code, the screen, and what you were doing.
