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
  const slides = homepage('[data-feature-slide]');
  if (slides.length !== 6) errors.push('Homepage must contain six feature slides in its no-JavaScript HTML.');
  slides.each((index, element) => {
    const slide = homepage(element);
    if (slide.find('img[data-feature-image]').length !== 1) errors.push('Homepage feature slide ' + (index + 1) + ' must have one image.');
    if (!slide.find('a[data-feature-link]').attr('href')) errors.push('Homepage feature slide ' + (index + 1) + ' must keep its guide link available.');
  });
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
  if (scripts.length !== 1) errors.push('Homepage must ship one local carousel script.');
  scripts.each((_, element) => {
    const src = homepage(element).attr('src');
    if (src && new URL(src, origin + base + '/').origin !== new URL(origin).origin) {
      errors.push('Homepage carousel script must be local.');
    }
  });
}
if (!existsSync(join(root, 'pagefind/pagefind.js'))) errors.push('Documentation search index missing.');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Verified ' + documents.size + ' HTML pages and ' + links + ' internal links/assets/fragments under ' + (base || '/') + '. CSS assets, search index, local carousel bundle, and scanner media present.');
