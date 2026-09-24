import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { load } from 'cheerio';
const root = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1');
const base = (process.env.BASE_PATH ?? '/Inventatory-Site').replace(/\/$/, '');
const origin = process.env.SITE_URL || 'https://kwiatens.github.io';
const errors = [];
const documents = new Map();
const walk = path => readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(join(path, entry.name)) : [join(path, entry.name)]);
for (const file of walk(root).filter(file => file.endsWith('.html'))) {
  const rel = relative(root, file).replaceAll('\\', '/');
  const route = base + '/' + rel.replace(/index\.html$/, '');
  documents.set(route, { file, $: load(readFileSync(file, 'utf8')) });
}
let links = 0;
for (const [route, { $ }] of documents) {
  if ($('h1').length !== 1) errors.push(route + ': expected one h1');
  if (!$('html').attr('lang')) errors.push(route + ': missing language');
  if (!$('title').text() || !$('meta[name="description"]').attr('content')) errors.push(route + ': missing page metadata');
  $('img').each((_, image) => { if ($(image).attr('alt') === undefined) errors.push(route + ': image lacks alt text'); });
  const refs = [];
  $('[href], [src], [poster]').each((_, element) => {
    for (const attr of ['href', 'src', 'poster']) { const value = $(element).attr(attr); if (value) refs.push(value); }
  });
  $('[srcset]').each((_, element) => refs.push(...$(element).attr('srcset').split(',').map(part => part.trim().split(/\s+/)[0])));
  for (const ref of refs) {
    if (/^(data:|mailto:|tel:)/.test(ref)) continue;
    const target = new URL(ref, origin + route);
    if (target.origin !== new URL(origin).origin) continue;
    links++;
    if (base && !target.pathname.startsWith(base + '/')) { errors.push(route + ': path escapes deployment base: ' + ref); continue; }
    const local = decodeURIComponent(target.pathname.slice(base.length)).replace(/^\//, '');
    const file = join(root, local || 'index.html');
    const resolved = existsSync(file) && statSync(file).isDirectory() ? join(file, 'index.html') : file;
    if (!existsSync(resolved)) { errors.push(route + ': missing target ' + ref); continue; }
    if (target.hash && resolved.endsWith('.html')) {
      const page = load(readFileSync(resolved, 'utf8'));
      const id = decodeURIComponent(target.hash.slice(1));
      if (!page('[id]').toArray().some(node => page(node).attr('id') === id)) errors.push(route + ': missing fragment ' + ref);
    }
  }
}
// Check CSS font/image URLs as well as HTML references.
for (const file of walk(root).filter(file => file.endsWith('.css'))) {
  const route = base + '/' + relative(root, file).replaceAll('\\', '/');
  for (const match of readFileSync(file, 'utf8').matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)) {
    const ref = match[1];
    if (/^(data:|https?:|#)/.test(ref)) continue;
    const target = new URL(ref, origin + route);
    const local = decodeURIComponent(target.pathname.slice(base.length)).replace(/^\//, '');
    if (!existsSync(join(root, local))) errors.push(route + ': missing CSS asset ' + ref);
  }
}
const homepage = documents.get(base + '/')?.$;
if (!homepage) {
  errors.push('Homepage missing from production output.');
} else {
  const featureItems = homepage('.feature-list > .feature-item');
  if (featureItems.length !== 6) errors.push('Homepage must show all six features together in its static feature list.');
  featureItems.each((index, element) => {
    const item = homepage(element);
    if (!item.find('h3').text().trim() || !item.find('.feature-copy > p').text().trim()) errors.push('Homepage feature ' + (index + 1) + ' must include its title and summary.');
    if (!item.find('a.feature-link').attr('href')) errors.push('Homepage feature ' + (index + 1) + ' must keep its guide link available.');
  });
  if (homepage('[data-feature-carousel], [data-feature-slide], [data-carousel-controls], [data-slide-to]').length) errors.push('Homepage feature list must not contain carousel markup.');
  if (homepage('.hero .eyebrow, .hero-caption').length) errors.push('Homepage hero must not contain the removed eyebrow or screenshot caption.');
  const homepageText = homepage.text();
  if (!homepageText.includes('Open-source, terminal based hardware inventory management system.')) errors.push('Homepage must show the approved hero summary.');
  for (const removedText of [
    'LOCAL INVENTORY / REAL WORKFLOW',
    'STOCK WORKSPACE · ACTUAL SCREENSHOT',
    'Track parts, storage and projects from one local workspace.',
    'Electronic component inventory · Windows desktop + Scan R1',
    'Public beta · Windows x64 · GPL-3.0-only',
    'From incoming parts to your next board',
    'A connected workflow',
  ]) {
    if (homepageText.includes(removedText)) errors.push('Homepage must not contain removed copy: ' + removedText);
  }
  if (homepage('section[aria-labelledby="features-heading"]').length) errors.push('Homepage must not include the connected workflow section.');
  if (homepage('.scanner-copy > .eyebrow').text().trim() === 'Scan R1') errors.push('Scanner section must not include its eyebrow label.');
  verifyInstallSelector(homepage, '#homepage-download', 'Homepage');
  const scannerVideo = homepage('video[data-scanner-preview]');
  if (scannerVideo.length !== 1) errors.push('Homepage must include one scanner preview video.');
  else {
    for (const attribute of ['autoplay', 'muted', 'loop', 'playsinline', 'poster']) {
      if (!scannerVideo.is('[' + attribute + ']')) errors.push('Scanner preview must include ' + attribute + '.');
    }
    if (scannerVideo.is('[controls]')) errors.push('Scanner preview must not expose controls.');
    if (scannerVideo.find('source[src$=".webm"]').length !== 1) errors.push('Scanner preview must use one local WebM source.');
  }
  const scripts = homepage('script');
  if (scripts.length !== 1) errors.push('Homepage must ship one local media playback script.');
  scripts.each((_, element) => {
    const src = homepage(element).attr('src');
    if (src && new URL(src, origin + base + '/').origin !== new URL(origin).origin) {
      errors.push('Homepage media playback script must be local.');
    }
  });
}
const download = documents.get(base + '/download/')?.$;
if (!download) errors.push('Download page missing from production output.');
else verifyInstallSelector(download, '#download-platforms', 'Download page');
if (!existsSync(join(root, 'pagefind/pagefind.js'))) errors.push('Documentation search index missing.');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Verified ' + documents.size + ' HTML pages and ' + links + ' internal links/assets/fragments under ' + (base || '/') + '. CSS assets, search index, static feature list, platform installers, and scanner media present.');

function verifyInstallSelector($, selector, pageName) {
  const section = $(selector);
  if (section.length !== 1) {
    errors.push(pageName + ' must include one platform install selector.');
    return;
  }
  for (const platform of ['windows', 'linux']) {
    if (section.find('input[type="radio"][value="' + platform + '"]').length !== 1) errors.push(pageName + ' must include a ' + platform + ' platform option.');
    if (section.find('[data-platform-panel="' + platform + '"]').length !== 1) errors.push(pageName + ' must include one ' + platform + ' install guide.');
  }
  if (!section.find('[data-platform-panel="windows"] pre code').text().includes('Install-Inventatory.ps1')) errors.push(pageName + ' Windows command must use the published installer.');
  const linuxCommand = section.find('[data-platform-panel="linux"] pre code').text();
  for (const asset of ['Inventatory-linux-x64.tar.gz', 'SHA256SUMS-linux.txt', 'Install-Inventatory.sh']) {
    if (!linuxCommand.includes(asset)) errors.push(pageName + ' Linux command must download ' + asset + '.');
  }
}
