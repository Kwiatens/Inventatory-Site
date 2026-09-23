---
title: "Projects and BOMs"
description: "Compare a KiCad bill of materials with inventory, review shortages, and pick components."
---

## Review a project

Import a KiCad BOM through **3 Import**, then open it in **4 Projects**. Lines are grouped by **In Stock** or **Missing**, and then by component category. Review the part, package, location or suggested match, **Need / Have**, and status.

Use `+` and `−` to change board count and re-run the analysis. Press `a` to cycle between candidate matches for a BOM line. The selected match is remembered.

## Handle shortages

Shortages are looked up on DigiKey in the background. Press `o` to write shortages to a CSV beside the BOM. Select a missing line and press `Enter` to open its restock flow.

Check matching decisions before treating the analysis as a purchasing or picking list. Network-dependent lookup can fail independently of local inventory comparison.

## Find components in storage

1. Press `f` for **Find in racks**. While shortages remain, this can preview the available picks.
2. Follow the highlighted slots on the current rack.
3. Use `Enter` to advance and `Backspace` to go back.
4. Finish any picks grouped by non-rack location.
5. Answer whether to subtract the picked parts from stock.

`Ctrl+Z` restores the preceding inventory state for the latest inventory-changing action. See [History](../history/) before using it after additional changes.

## Reopen or remove a project

Projects persist in the inventory database. Reopening Inventatory restores their analysis against current stock without uploading the BOM again. Press `d` to forget a project.
