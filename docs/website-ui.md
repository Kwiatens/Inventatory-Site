# Website UI guide

For people and coding agents changing the Inventatory website in `src/`. Read this before editing a
page, a component or a style. It describes what the site looks like now and the rules that keep it
that way.

## Voice

- Plain and concrete, like a note from someone who built the thing. Name the real parts of the app:
  `R1-B3`, `DigiKey order CSV`, `5 × 5 rack grid`, `KiCad BOM`.
- Sentence case everywhere, including buttons and links. No exclamation marks, emoji, or hype words
  (`seamless`, `effortless`, `unlock`, `supercharge`, `welcome to`).
- Neutral voice. No `I` or `my`.
- Each feature claim must match what the app does. The source for claims is `src/content/docs/`
  and `docs/user-guide.md` in the software repository.

## Page structure: homepage

Top to bottom:

1. **Header**: a sticky bar, `--header-height` tall, on the canvas colour with a 1px divider below.
   The brand mark sits left. Navigation sits right: Documentation, Download, GitHub. The current
   page's link has a 1px accent underline.
2. **Hero**: left-aligned, in the column. The logo lockup, then the H1 claim, then one summary
   sentence, then the primary button (`.press`) and a secondary text link to `#how`. The product
   turntable video plays on the pixel grid. On desktop (44rem and up) it sits behind the text, shifted
   9% to the right so it clears the claim and the summary. On phones (44rem and below) it is a band of
   its own, 15.5rem tall and full bleed, above the text.
3. **What the system does** (`#how`): one short line set large on the page, with no rule above it,
   currently "Here’s what the system does.". It types itself in once when it enters the screen, with
   an accent caret that goes when it finishes. Then the film (`components/concept/Film.astro`). The
   film is one canvas with one timeline. The line is text, not a heading, and has no eyebrow.
   On phones (40rem and below) the film is drawn at 2x and a window follows the action: it eases
   towards the middle of the lit pixels and never moves past the film's edges.
4. **Highlights** (`components/home/Highlights.astro`): one row per desktop feature. Each row has a
   pixel icon, a title, one or two sentences, and a `Read the guide` link. Rows are separated by 1px
   dividers. This is a list, not a card grid.
5. **Scan R1** (`components/home/Scanner.astro`): the name and summary, the device sprite with its
   LCD and keypad, then two columns separated by a 1px rule: `Build it yourself` and
   `Official CAD files`. The purchase button stays disabled with the label `Coming soon` while
   `scanner.bundle.href` is empty.
6. **Install** (`components/PlatformInstallSelector.astro`): a visually hidden H2, a lead sentence,
   OS choices as text tabs with a 2px accent underline on the chosen one, then the command in a
   bordered block. The command wraps; it never scrolls sideways. A text `Copy` button sits in the
   block's header row. Both OS panels share one grid cell, so the box keeps its height when the
   tab changes.
7. **Footer**: a top divider, the muted wordmark, the byline, and one row of links.

The download page (`src/pages/download.astro`) reuses the install component.

## Visual rules

Do:

- Take colours, type sizes and spacing from `src/styles/tokens.css`. Components do not write hex
  values, except the sprite and lockup data.
- Left-align text. Put content in the `.wrap` column, which is `--width` (72rem) wide.
- Separate things with a 1px `--divider` rule and space. Use a border only where it carries
  meaning, such as the input frame of the install command.
- Draw pixel art on the grid: rectangles on an integer grid, `shape-rendering="crispEdges"`, one
  art pixel = `--px`. Icons are 16 × 16 grids with lit pixels in `--accent`.
- The top-bar logo is `--graphite` at rest. On hover only the mark turns `--accent`; the wordmark that
  unfolds on wide screens stays `--graphite`. The colour change takes 120 ms.
- Keep hover states to colour changes. The exceptions are the brand's own pixel arrows on links
  and the pressed state of `.press`.
- Text contrast: 4.5:1 minimum for body and small text. `--muted` (`#8c9690`) on the canvas is
  6.3:1 and is the smallest text colour allowed. Do not use `#4f5a57` or `#2a3331` for text.

Do not:

- No gradients, visible or hidden: no gradient backgrounds, no gradient text, no fades made with
  gradient masks, no dithered edges on bars or sections.
- No glass, blur, neon or coloured glow shadows. The one hard drop shadow is the `.press` button,
  in the lockup's shadow colour.
- No eyebrow labels, kickers, or decorative section titles above content. Sections start with
  their content. Headings that exist for screen readers are visually hidden.
- No grids of identical icon, title and text cards. No nested cards. No rounded boxes. No coloured
  left-border accents.
- No stock photography, people pointing at screens, invented statistics, testimonials, or logo
  walls.
- No centred hero, and no "Welcome to" copy.
- No new fonts. Body text is Space Grotesk (`--font-body`) and mono labels are IBM Plex Mono
  (`--font-mono`). The pixel heading faces are kept in `src/assets/fonts` but nothing on the
  homepage uses them.

## Motion

Allowed:

- The lockup's boot animation, played once when the page loads (`animate` on the logo).
- The "What the system does" line types in once, the first time it is on screen. Reduced motion
  and no-JavaScript visitors see the full line at once.
- The hero video, the film, and the Scan R1 demo, each on its own timeline.
- Short colour transitions of 120 ms or less.

Not allowed: looping decorative motion (bobbing arrows, pulsing badges, floating shapes), scroll-jacking,
and any animation of layout. Everything respects `prefers-reduced-motion`.

## Content and data

- Homepage copy lives in `src/content/pages/home.json`. Edit it there, not in the components.
  - `hero`: the claim, summary and buttons.
  - `highlights.items`: one entry per row, with `icon`, `title`, `text` and `href`. The icon names
    must match the keys in `Highlights.astro`.
  - `scanner`: the Scan R1 copy, its open-source links, and the CAD bundle. Set
    `scanner.bundle.href` to enable the purchase button.
- The hero summary is pinned by `scripts/verify-build.mjs`. Change the two together.
- `src/data/site.ts` holds the navigation and the Scan R1 media. The header and the docs header
  both read `nav`.

## Components

| File | Role |
| --- | --- |
| `src/layouts/BaseLayout.astro` | Document shell: metadata, header, footer, anchor scrolling |
| `src/components/SiteHeader.astro` | Sticky header and navigation |
| `src/components/SiteFooter.astro` | Footer |
| `src/components/BrandMark.astro` | Header brand mark |
| `src/components/Lockup.astro` | The pixel wordmark |
| `src/components/concept/Film.astro` | The workflow film and its timeline |
| `src/components/home/Highlights.astro` | Feature rows with pixel icons |
| `src/components/home/Scanner.astro` | Scan R1 section |
| `src/components/PlatformInstallSelector.astro` | OS tabs and install commands |
| `src/styles/tokens.css` | Colours, type scale, spacing, layout tokens |
| `src/styles/pixel.css` | The pixel grid (`--px`), the notched `.press` button, the link arrows |

## Checks before committing

```bash
npm run check    # type checking
npm run build    # static build
npm run verify   # structure, links, required markup
```

Then look at the result:

- Screenshot the homepage at 1440 × 900 and 390 × 844, scrolling through it.
- No horizontal scroll: `document.documentElement.scrollWidth` equals `clientWidth`.
- On a phone the navigation is visible in the header and clickable.
- The install command wraps inside its block.
- Text contrast meets the minimum above.

## Open decisions

Remove an item from this list when it is settled.

- **CAD destination.** `scanner.bundle.href` is empty, so the purchase button reads `Coming soon`.
- **Body font.** Space Grotesk is kept for now. It is a common default in generated interfaces,
  so a replacement may be worth a look once the layout is settled.
