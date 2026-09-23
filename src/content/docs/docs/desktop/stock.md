---
title: "Stock management"
description: "Search and edit components, adjust quantities, and perform a guided stocktake."
---

<figure>
<img src="../../../media/stock.png" width="1881" height="970" loading="lazy" alt="The real Stock workspace, showing the component list, quantities, and the selected capacitor’s details." />
<figcaption>Stock workspace. <a href="../../../media/stock.png">Open the full-resolution screenshot.</a></figcaption>
</figure>

## Find and inspect a component

Open **1 Stock** and type `/` to filter by part, category, tag, parameter, location, SKU, status, or quantity expression. Select a row to inspect the component's details.

Press `f`, choose **filters** from Actions, or click **Sort / Filter**. Sort by quantity or name and limit results by modification date. **Reset filters** restores all dates and A–Z sorting.

## Edit a record

Choose **New** or **Edit**. Editing happens in the detail area of Stock. Choose a field, enter its value, and save the working copy with `s`. `Escape` cancels the active field or edit.

Use **−**, **+**, or **Set qty** for quantity work. **Delete** asks for confirmation and records the removal in History. **Print** sends a label through the configured printer.

## Set reorder thresholds

Each part has a **Reorder threshold** in Edit. A positive value overrides the global low-stock setting. **0** uses the global setting. The effective threshold is used by search, rack indicators, and stock warnings.

## Count physical stock

1. Choose **Start stocktake** from Actions, or press `t`.
2. Enter a count for the selected part.
3. Use `j` / `k` or the arrow keys to move between parts.
4. Count every part. Finish remains unavailable until the full count is complete.
5. Press `s` to save the session.

Counts are held in memory until you save. `q` or `Escape` cancels without changing stock. Saved corrections are recorded in stock movement history; the selected part also shows recent movements.

## Understand saved changes

Completed inventory actions create local history commits. See [History](../history/) for snapshots, reversal, and durable undo. If saving fails, resolve the reported error before starting a history operation.
