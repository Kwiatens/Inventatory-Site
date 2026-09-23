---
title: "Your first inventory"
description: "Create a component, set its quantity, and give it a physical location."
---

## Choose a starting point

Complete [installation](../installation/) first. The wizard opens **Stock** in your selected data folder. You can add one component manually or bring in a DigiKey order CSV.

## Add a component manually

1. Open **1 Stock**.
2. Choose **New**. Use the visible action or open **Actions** with `Space`.
3. Enter the component details in the editor. Include a useful name or part identifier and its quantity.
4. Save the working copy with `s`.
5. Select the saved row and check its details and quantity.

Use **Edit** to correct fields. `Escape` cancels the active field or edit; it does not save the draft.

## Import an order instead

Open **3 Import**, choose the DigiKey order CSV, then review each row before accepting it. The final summary reports created, merged, skipped, and failed records. See [component import](../../desktop/import/) before importing a large order.

## Give the component a location

Open **2 Racks**. Use the available rack actions to create or select a rack, then assign the component to a slot. Each rack has a 5 × 5 grid. Check the part's displayed rack location when you return to Stock.

Read [racks and storage](../../desktop/racks/) for moving and finding parts.

## Check the result

- Type `/` in Stock and search for the part.
- Select it to confirm its quantity, location, and parameters.
- Open **5 History** to inspect the recorded inventory change.
- Make your first [backup](../../desktop/backups/) once you have entered useful data.
