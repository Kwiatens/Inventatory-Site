---
title: "Install on Windows and Linux"
description: "Install the Windows x64 or Ubuntu Linux x86-64 public beta and complete first-run setup."
---

## Requirements

- Windows x64, or Ubuntu 24.04 LTS on x86-64, with a writable folder for application data.
- A terminal window at least **100 columns × 30 rows**. A smaller window shows a resize notice.
- Internet access to download the release. Core inventory data is stored locally.

Ubuntu needs the runtime libraries `libsecret-1-0`, `libcurl4`, `libssl3`, and `libglib2.0-0`. Secret storage also requires a running Secret Service provider such as GNOME Keyring. The supported Linux target is Ubuntu 24.04 LTS x86-64.

## Download and launch

1. Open the [download page](../../../download/#download-platforms) and select Windows or Linux.
2. Read the notes for the current prerelease before updating an existing installation, and make a backup of your inventory.
3. Follow the displayed platform command. The Windows installer verifies the package before activation. On Ubuntu, the installer checks the downloaded archive and installer against the published SHA-256 manifest and places the executable at `~/.local/bin/inventatory`.

Launch Inventatory and complete the first-run wizard. On Windows, setup can create a desktop shortcut. On Linux, run `~/.local/bin/inventatory` from a terminal; add `~/.local/bin` to your `PATH` if you want to use the shorter `inventatory` command.

:::note[About the README install command]
The application README uses GitHub's `releases/latest` URL, which selects a stable release. The public release verified for this website is a prerelease. Use the explicit release above rather than assuming the stable-download command will retrieve it.
:::

## Complete first-run setup

1. Continue from the welcome screen.
2. Accept the inventory data folder or choose another one. Windows defaults to **Documents\Inventatory**; Linux uses the XDG data directory, normally **~/.local/share/Inventatory**.
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
