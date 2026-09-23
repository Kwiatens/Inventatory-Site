---
title: "Install on Windows"
description: "Download the Windows x64 package, extract it, and complete the initial workspace setup."
---

## Requirements

- A Windows x64 PC and a writable folder for the application and its inventory data.
- A terminal window at least **100 columns × 30 rows**. A smaller window shows a resize notice.
- Internet access to download the release. Core inventory data is stored locally.

A minimum Windows version is not specified in the audited public documentation. Do not assume support for other operating systems.

## Download and launch

1. Open the [official release page](https://github.com/Kwiatens/Inventatory-Software/releases/tag/v0.2.0-rc.2).
2. Read the notes. **v0.2.0-rc.2 is a prerelease**, intended for testing.
3. Download **Inventatory-win-x64.zip** from the release assets and extract the archive to a writable folder.
4. Open the extracted Inventatory folder and run **inventatory.exe**.

Keep the extracted package together. The first-run wizard creates a desktop shortcut after setup is complete.

:::note[About the README install command]
The application README uses GitHub's `releases/latest` URL, which selects a stable release. The public release verified for this website is a prerelease. Use the explicit release above rather than assuming the stable-download command will retrieve it.
:::

## Complete first-run setup

1. Continue from the welcome screen.
2. Accept the inventory data folder or choose another one. The documented default is **Documents\Inventatory**.
3. Choose whether to enable background operation. You can skip it and change this later in Settings.
4. If you have a compatible Scan R1, start its setup. Otherwise choose **Skip**.
5. Finish setup to open Stock.

Continue with [your first inventory](../first-inventory/).

## Updating an existing installation

Make a [backup](../../desktop/backups/) first. Use **Settings → Updates → Check for software updates** for the application's verified update and rollback workflow. Do not extract a new package over a running installation.

## If something goes wrong

- **Resize notice:** enlarge the terminal to at least 100 × 30 cells.
- **Data folder cannot be used:** choose a writable local folder, then retry setup.
- **Update download or verification failed:** the existing installation is retained; review the error and retry through Settings.
- **Scanner is unavailable:** skip scanner setup. The desktop inventory works independently.
