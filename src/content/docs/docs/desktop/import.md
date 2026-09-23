---
title: "Component import"
description: "Review DigiKey order CSV files and send KiCad BOMs to Projects."
---

## Supported workflows

Open **3 Import** and choose a CSV file. Inventatory detects the workflow from the file header:

| CSV source | Result |
| --- | --- |
| DigiKey order | A review list of candidate components |
| KiCad BOM | A project for comparison against stock |

Use the relevant vendor or CAD export rather than assuming an arbitrary CSV layout will be accepted.

## Review a DigiKey order

1. Select the order CSV.
2. Review each candidate and correct its fields if needed.
3. Choose **Accept** or **Skip** for that row.
4. After the final row, choose whether to enrich accepted components with DigiKey metadata.
5. Read the summary of created, merged, skipped, and failed rows.

Metadata enrichment needs configured DigiKey credentials and network access. The optional enrichment step is separate from reviewing and accepting the order rows.

If a row fails, check the reported result and the inventory before retrying it. Do not assume that every row in a partially successful import needs importing again.

## Import a board BOM

A detected KiCad BOM opens the Projects workflow. Review matches and shortages there; it does not mean all required parts are already in stock. Continue with [Projects and BOMs](../projects/).

## Configure DigiKey

Open **Settings → Integrations → DigiKey → Begin Setup**. The wizard collects the Client ID and Client secret. The secret is stored in Windows Credential Manager. Use the live credential test to check the configuration. See [Settings](../settings/).
