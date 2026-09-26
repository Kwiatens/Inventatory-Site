# Website Content Files

All user-facing copy on the website lives in these simple JSON files:

- **[`home.json`](./home.json)**:
  - Hero headline, summary, button labels
  - Presentation section title, description, step titles, text, and captions
  - Scan R1 titles, summaries, "Build it yourself" text, and "Official CAD bundle" specs/price
  - "After installing" next step links

- **[`features.json`](./features.json)**:
  - Features page title, description, intro lead, notice
  - Feature cards (Stock, Racks, Import, Projects, History, Scanner) titles, descriptions, and bullet points
  - Current boundaries section text and link

- **[`download.json`](./download.json)**:
  - Download page title, description, intro lead
  - Note sections ("Already installed?", "Scanner resources", "Source code and license")

## How to edit content

1. Open the file corresponding to the page you want to update (e.g. `home.json`).
2. Change the text inside the quotes.
3. Save, commit, and push. The website updates automatically without touching any HTML, CSS, or component code.
