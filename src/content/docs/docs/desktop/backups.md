---
title: "Backups and restore"
description: "Create validated backups and understand what changes when a workspace is restored."
---

## Create a backup

Use **Backup data** in the application's data-management actions. Inventatory prepares a timestamped bundle, validates it, and only then publishes the finished backup. Keep a copy outside the active data folder.

The bundle includes the SQLite inventory database, projects and inventory history, activity history, printer configuration, quick-label configuration, and sanitized application settings. A manifest records file sizes and SHA-256 hashes.

## Restore a backup

1. Select the intended bundle through **Restore backup**.
2. Review and confirm the restore action.
3. Inventatory validates the files and database before activation and creates an automatic pre-restore backup.
4. After success, check your inventory and re-pair Scan R1 if used.

If validation or activation fails, the active workspace remains unchanged. Read the error and keep the original backup for investigation; do not manually copy some of its files over the active database.

## Credentials and scanner pairing

DigiKey secrets remain in Windows Credential Manager and are not exported. Scan R1 secrets and paired-device configuration are excluded from backups.

After a successful restore, the Scan R1 secret is rotated, replay state is cleared, and the paired-device identity is removed. **Pair the scanner again.** DigiKey credentials stay local to the PC; a different PC may require credential setup.

## Change the data folder

Settings saves the current inventory before switching data folders and validates the new location before activation. An empty new data folder starts an empty workspace; switching folders does not copy the previous inventory into it.

For implementation details, see the source repository's [backup and restore specification](https://github.com/Kwiatens/Inventatory-Software/blob/main/docs/backup-restore.md).
