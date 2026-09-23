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
if (!homepage || homepage('script[src]').length) errors.push('Homepage must not ship a client framework or unnecessary JavaScript.');
if (!existsSync(join(root, 'pagefind/pagefind.js'))) errors.push('Documentation search index missing.');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Verified ' + documents.size + ' HTML pages and ' + links + ' internal links/assets/fragments under ' + (base || '/') + '. CSS assets and search index present; homepage has no external scripts.');
