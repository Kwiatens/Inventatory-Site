---
title: "Inventory history"
description: "Inspect commits, create checkpoints, restore snapshots, and reverse selected changes."
---

## Inspect a change

Open **5 History**. Commits are listed newest first. Select a commit to inspect its parent, source, reference, changed part and rack counts, and changed records.

Press `Enter` on a changed record to inspect its before-and-after fields. `Escape` returns to the record list. Parameter changes are shown as individual field differences.

## Create a checkpoint

Press `C` to create a named snapshot checkpoint. This records a reference point without changing inventory. Checkpoints cannot themselves be reversed.

## Choose the right recovery action

| Action | Effect |
| --- | --- |
| Restore snapshot | Replaces current items and racks with the selected commit's exact snapshot |
| Reverse changes | Applies only the selected commit's inverse fields while retaining unrelated later edits |
| Ctrl+Z | Restores the durable parent of the latest inventory-changing commit, including after a restart |

Restore and reversal ask for confirmation and create a new corrective commit. Existing history is retained. **Reverse changes** stops if an affected part or rack changed afterward; it does not silently overwrite a conflict.

Save pending inventory changes before using history actions.

## History and backups

Inventory history lives inside `inventory.db` and is included in application backups. Legacy activity and stock-movement records remain separate; they are not reinterpreted as inventory commits.

History is not a replacement for an external [backup](../backups/). Loss of the data folder can also remove its local history.
