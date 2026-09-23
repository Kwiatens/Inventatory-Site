# Inventatory Website

Website and documentation for [Inventatory](https://github.com/Kwiatens/Inventatory-Software), built with [Astro](https://astro.build/) and [Starlight](https://starlight.astro.build/).

Live site: [kwiatens.github.io/Inventatory-Site](https://kwiatens.github.io/Inventatory-Site/)

## Development

Requires Node.js 22+ (Node.js 24 LTS recommended) and npm.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4321/Inventatory-Site/` in your browser.

### Build and verify

```bash
npm run check    # Diagnostics and type checking
npm run build    # Static site production build
npm run verify   # Verification of links, assets, and metadata
npm run preview  # Local preview of the production build
```

## Deployment

The site is built and deployed automatically to GitHub Pages via GitHub Actions upon pushes to `main`.

## Licensing

Distributed under the GNU General Public License v3.0 (GPL-3.0-only). See [LICENSE](LICENSE) for details.

Third-party notices and font licenses are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
