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

1. **Header**: a sticky bar, `--header-height` tall, on the surface colour. Its lower edge dissolves
   into the page in the films' dither.
   The brand mark sits left. Navigation sits right: Documentation, Download, GitHub. The current
   page's link has a 1px accent underline.
2. **Hero**: left-aligned, in the column. The logo lockup, then the H1 claim, then one summary
   sentence, then the primary button (`.press`) and a secondary text link to `#how`. The product
   turntable video plays on the pixel grid. On desktop (44rem and up) it sits behind the text, shifted
   20% to the right so the scanner starts clear of the claim. On phones (44rem and below) it is a band
   of its own, 15.5rem tall and full bleed, above the text.
3. **The film** (`#how`, `components/concept/Film.astro`): in a `.band`, a surface-tone section whose
   top and bottom edges dissolve into the page in dither. No caption above it. The reel opens on an
   intro (`lib/film/intro.ts`): the cursor, the lockup's prompt mark, types "See what the system can
   do", holds it, backspaces it away, and the film dithers in out of the blank. It is one canvas with
   one timeline: a plain line for the whole loop with the playhead on it, no chapters and no names.
   Click or drag to scrub; the arrow keys step five seconds. On phones (40rem and below) the film is drawn at 2x and a
   window follows the action: it eases towards the middle of the lit pixels and never moves past the
   film's edges.
4. **Highlights** (`components/home/Highlights.astro`): one row per desktop feature, laid out as a
   table. The pixel icon, then the name in one shared column, then the description with its
   `Read the guide` link. Rows are separated by dotted rules. This is a list, not a card grid. The
   name is a button with a pixel plus; a click anywhere on the row but its link opens it, and the
   open row shows a 16:9 slot for a video of the feature on the real thing (`video` and `poster` in
   `home.json`). Until a row has a video, its slot is a frame with a pixel play mark and
   `Video coming soon`. Closing a row pauses its video. On phones the name sits beside the icon,
   the description goes below it, and the video takes the full width.
   The icons are one set: each is the real object the feature works with, rendered from a model by
   `scripts/pixel-art/icons.py` with the film's rack camera, and fitted to the same 44 × 44 grid.
5. **Scan R1** (`components/home/Scanner.astro`): the pixel heading and summary, the device sprite with
   its LCD and keypad, then two framed panels: `Build it yourself` and `Official CAD files`. The CAD
   panel is set apart with an accent outline and a tinted inside. While `scanner.bundle.href` is empty, a
   `Coming soon` status tag (a frame with a quiet label, not a button) stands where the purchase
   button will go. The two cards are the same height, so their footers line up.
6. **Install** (`components/PlatformInstallSelector.astro`): the pixel heading `Install Inventatory`,
   a lead sentence and a `Release notes` link. Windows and Linux are two notched tabs with an OS icon;
   the open one is set in the active tone, with no bar. The command sits in a framed terminal with a `Copy` key in
   its header. The command stays on one line and scrolls sideways inside it, and the right edge
   dissolves in dither. Both OS
   panels share one grid cell, so the box keeps its height when the tab changes.
7. **Footer**: a surface band that dissolves out of the page above in dither, the embossed wordmark,
   the byline, and one row of links.

Every section starts `--section-y` below the one before it (80px; 64px on phones). Sections have
top padding only, except the install block, which keeps 80px below itself so the footer's dithered
band stays clear of the install box.

The download page (`src/pages/download.astro`) reuses the install component.

## Visual rules

Do:

- Take colours, type sizes and spacing from `src/styles/tokens.css`. Components do not write hex
  values, except the sprite and lockup data.
- Left-align text. Put content in the `.wrap` column, which is `--width` (72rem) wide. The exception
  is the features heading, which is centred over its list.
- Separate things with a dotted `.rule` in `--divider`: one grid pixel thick, two on and two off.
  Use a 1px border only where it carries meaning, such as the header's bottom edge or the input
  frame of the install command.
- Draw pixel art on the grid: rectangles on an integer grid, `shape-rendering="crispEdges"`, one
  art pixel = `--px`. The feature icons are 44 × 44 grids from `scripts/pixel-art/icons.sh`, all in
  one camera, with lit pixels in `--accent`. Regenerate them rather than editing the JSON.
- The top-bar logo is `--graphite` at rest. On hover only the mark turns `--accent`; the wordmark that
  unfolds on wide screens stays `--graphite`. The colour change takes 120 ms.
- Keep hover states to colour changes. The exceptions are the brand's own pixel arrows on links
  and the pressed state of `.press`.
- Text contrast: 4.5:1 minimum for body and small text. `--muted` (`#8c9690`) on the canvas is
  6.3:1 and is the smallest text colour allowed. Do not use `#4f5a57` or `#2a3331` for text.

Do not:

- No smooth gradients: no gradient backgrounds, no gradient text, no fades made with smooth gradient
  masks. Transitions between tones are dithered, not blended: a `.band` section, the header's lower
  edge and the footer's upper edge all dissolve in `--dither-edge` (see `pixel.css`). Frames, notched
  buttons and dotted rules are stacked hard-stop gradients on the grid, and the command line's right
  edge is a dithered fade.
- No glass, blur, neon or coloured glow shadows. The one hard drop shadow is the `.press` button,
  in the lockup's shadow colour.
- No eyebrow labels, kickers, or decorative section titles above content. Sections start with
  their content. Headings that exist for screen readers are visually hidden.
- No uppercase text. Labels, table headers and the terminal title are sentence case.
- No grids of identical icon, title and text cards. No nested cards. No rounded boxes. No coloured
  left-border accents.
- No stock photography, people pointing at screens, invented statistics, testimonials, or logo
  walls.
- No centred hero, and no "Welcome to" copy.
- No new fonts. Body text is Space Grotesk (`--font-body`) and mono labels are IBM Plex Mono
  (`--font-mono`). The pixel heading faces (`.px-head` for section headings, `.px-sub` for panel
  headings) are the Scan R1's own bitmap fonts. They appear on the homepage only in the Scan R1 and
  install sections, in pure white (`--pixel-text`) with no shadow.

## Motion

Allowed:

- The lockup's boot animation, played once when the page loads (`animate` on the logo).
- The mascot shakes once on the 404 page, when its page-not-found text renders. This is a response
  to the page state, not a second reveal. Reduced motion shows the still mark.
- The mascot's other behaviours (blink, hop, nod, type, sleep) are built but not on a page yet. Each one
  runs once and stops; nothing loops, not even the cursor's blink.
- The hero video, the film, and the Scan R1 demo, each on its own timeline.
- Short colour transitions of 120 ms or less.

Not allowed: looping decorative motion (bobbing arrows, pulsing badges, floating shapes), scroll-jacking,
and any animation of layout. Everything respects `prefers-reduced-motion`.

## Content and data

- Homepage copy lives in `src/content/pages/home.json`. Edit it there, not in the components.
  - `hero`: the claim, summary and buttons.
  - `highlights.items`: one entry per row, with `id`, `icon`, `title`, `text`, `href`, `video` and
    `poster`. The icon names must match the keys in `src/data/feature-icons.json`. `video` and
    `poster` are site paths (for example `/media/feature-racks.webm`); leave `video` empty until
    the recording exists.
  - `scanner`: the Scan R1 copy, its open-source links, and the CAD bundle. Set
    `scanner.bundle.href` to enable the purchase button.
- The hero summary is pinned by `scripts/verify-build.mjs`. Change the two together.
- The film's props follow the real things. The tube label is the app's part label
  (`src/label_printer/core/LabelPrinter.cpp` in the software repository) and the rack card is its
  rack label (`LabelPrinterRack.cpp`), both with the app's own values for the 10K resistor in R1-B3.
  Rack slots are named as the app's Racks page shows them: letters are columns, A to E from the left,
  and numbers run 1 to 5 down each column from the far side toward the card. When the app's label
  layout changes, update `labelBig` and `rackCard` in `src/lib/film/props.ts`. When the rack model
  changes (`scripts/pixel-art/rack.py`), run `scripts/pixel-art/build.sh`; without the FreeCAD file
  it rebuilds only the racks and keeps the scanner's sprites, then run `icons.sh` for the icons.
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
| `src/components/home/Highlights.astro` | Feature rows with pixel icons, each opening to a video slot |
| `src/components/home/Scanner.astro` | Scan R1 section |
| `src/components/PlatformInstallSelector.astro` | OS tabs and install commands |
| `src/components/Mascot.astro` | The project mascot: the mark's › with a block cursor, rest and sleep poses, one-shot blink, hop, nod, shake and type |
| `src/styles/tokens.css` | Colours, type scale, spacing, layout tokens |
| `src/styles/pixel.css` | The pixel grid (`--px`), the notched `.press` and `.key` buttons, the `.frame` panel, the dotted `.rule`, the pixel headings, the link arrows |

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

- **CAD destination.** `scanner.bundle.href` is empty, so the bundle shows a `Coming soon` status tag.
- **Mascot direction.** The mascot is the › of the mark with a block cursor in the place of the i's
  stem (`Mascot.astro`). It shakes on the 404 page. The
  owner's sketches are not in the repo, so each behaviour is built from the written brief. Check
  them against the sketches, and say which behaviours go on which pages.
- **Body font.** Space Grotesk is kept for now. It is a common default in generated interfaces,
  so a replacement may be worth a look once the layout is settled.
