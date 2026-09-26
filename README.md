# Inventatory Web

A fresh, independent Inventatory website: Astro static pages and Starlight user documentation. The legacy Inventatory-Sitesite project is not used. The desktop application repository is a read-only source of product facts, the original wordmark, and palette.

## Develop and verify

Use Node.js 24 LTS and npm. From this repository:

    npm ci
    npm run dev

Open http://127.0.0.1:4321/Inventatory-Site/.

    npm run check
    npm run build
    npm run verify
    npm run preview

The verifier checks every generated HTML page, local links, fragments, media, CSS assets, deployment prefixes, page metadata, and the Pagefind search index. It also checks that the homepage has no external client scripts. Preview the production build to test documentation search; the development search experience can differ.

To validate a future custom domain in PowerShell:

    $env:SITE_URL = 'https://example.com'
    $env:BASE_PATH = '/'
    npm run build
    npm run verify
    Remove-Item Env:SITE_URL, Env:BASE_PATH

Rebuild afterward for the default project path. Node 24 / npm 11 can report dependency install-script policy: review the official esbuild postinstall if your local npm policy asks for it; do not blanket-enable unknown scripts.

## Edit the site

- **Page text and copy:** Simple JSON files in `src/content/pages/` (`home.json`, `features.json`, `download.json`). Edit text inside quotes without touching code or CSS.
- **Documentation:** Markdown in `src/content/docs/docs/`. Add a matching sidebar entry in `astro.config.mjs`.
- **Page layouts and templates:** `src/pages/` and `src/components/`.
- **Shared navigation and repeated facts:** `src/data/site.ts`.
- **Colors and sizes:** `src/styles/tokens.css`; documentation overrides in `docs.css`.
- **Original logo:** `src/data/logo.ts` and `components/AsciiLogo.astro`.
- **Authentic product media:** `public/media/` and `components/ProductMedia.astro`.

Guides are concise user-facing adaptations, not synchronized copies of developer notes. For each desktop release, review upstream changes, refresh relevant guides, and update verified release metadata. Do not describe current-source behavior as guaranteed in an older release.

## Add real media

The supplied Stock screenshot is the showcase fallback. It is cropped only to remove OS/window chrome. Set media.video to a real MP4 path when supplied and media.videoCaptions to its caption track if speech or meaningful audio is present. Update media.videoDescription with an accurate text alternative. The component uses a poster, native controls, preload=none, and no autoplay, so reduced-motion users are never forced into playback.

For the homepage hero, leave media.heroVideo empty until an authentic whole-system recording exists. It uses the same Stock screenshot as a static fallback; when configured, the muted decorative clip plays only when motion is allowed and the page is visible.

For a scanner photo, set media.scannerPhoto and media.scannerPhotoAlt. Add explicit dimensions matching the real image before publication to reserve its space. Do not create a fictional substitute.

## Publish with GitHub Pages

The canonical source is [Kwiatens/Inventatory-Site](https://github.com/Kwiatens/Inventatory-Site). Pushes to `main` run **Build and deploy website**. In repository Settings → Pages, select **GitHub Actions** as the source. Pull requests validate only; main and manual runs publish the static dist artifact.

CI first verifies a root-domain build, then derives the actual origin and base path from GitHub Pages. Local defaults use https://kwiatens.github.io/Inventatory-Site/. SITE_URL and BASE_PATH support repository renaming and a future custom domain. The deploy job alone has pages:write and id-token:write. No server or browser-side release API is required.

Confirm the live Pages URL and its links after each publication. Local builds do not validate GitHub Pages availability.

## Status and licensing

Before publication, verify scanner media, demonstration footage, public firmware and assembly resources, and live deployment. Do not claim any item that has not been confirmed.

This implementation and the reused GPL application wordmark are distributed under GPL-3.0-only; see LICENSE. Fontsource fonts retain their bundled SIL Open Font License notices. See THIRD_PARTY_NOTICES.md.
