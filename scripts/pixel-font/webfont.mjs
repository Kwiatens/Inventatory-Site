// Builds the site's pixel webfonts from the U8g2 bitmaps in src/data/pixel-fonts.json (the same
// glyphs the films and the Scan R1 draw), so headings are real, selectable text on the art grid.
// One font pixel = 100 units and the em is the font's full height, so `font-size: calc(var(--px)
// * height)` puts every glyph pixel on a page pixel.
// Usage: node scripts/pixel-font/webfont.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import opentype from 'opentype.js';

const root = new URL('../../', import.meta.url);
const fonts = JSON.parse(readFileSync(new URL('src/data/pixel-fonts.json', root), 'utf8'));
const U = 100;
// file name -> U8g2 font: helvB12 for headings, helvB08 for subheadings.
const OUT = { 'pixel-head': 'big', 'pixel-sub': 'bold' };

// U8g2's _tf fonts are Latin-1, which has no euro sign: one drawn per font, from its own C.
// Rows from the font's top; '#' is a lit pixel. [advance, left, rows]
const EURO = {
  big: [12, 0, [
    '', '', '', '',
    '....######', '...#######', '..###....#', '..##......', '#######...', '..##......',
    '..##......', '#######...', '..##......', '..###....#', '...#######', '....######',
  ]],
  bold: [8, 0, [
    '', '', '',
    '...####', '..##..#', '######.', '.##....', '######.', '.##....', '..##..#', '...####',
  ]],
};

mkdirSync(new URL('src/assets/fonts/', root), { recursive: true });
for (const [file, name] of Object.entries(OUT)) {
  const { top, height, glyphs: base } = fonts[name];
  const glyphs = { ...base };
  if (EURO[name]) {
    const [advance, left, rows] = EURO[name], width = Math.max(...rows.map(r => r.length));
    const grid = Array.from({ length: height }, (_, r) => (rows[r] ?? '').padEnd(width, '.'));
    glyphs[0x20ac] = [advance, left, width, grid.join('').replace(/#/g, '1').replace(/\./g, '0')];
  }
  const ascent = -top, descent = height - ascent;
  const list = [new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: 4 * U, path: new opentype.Path() })];
  for (const [code, [advance, left, width, rows]] of Object.entries(glyphs)) {
    const path = new opentype.Path();
    // One rectangle per horizontal run of lit pixels, wound clockwise like TrueType outlines.
    for (let r = 0; width && r < rows.length / width; r++) {
      const y1 = (ascent - r) * U, y0 = y1 - U;
      for (let c = 0; c < width; c++) {
        if (rows[r * width + c] !== '1') continue;
        let e = c; while (e + 1 < width && rows[r * width + e + 1] === '1') e++;
        const x0 = (left + c) * U, x1 = (left + e + 1) * U;
        path.moveTo(x0, y0); path.lineTo(x0, y1); path.lineTo(x1, y1); path.lineTo(x1, y0); path.close();
        c = e;
      }
    }
    list.push(new opentype.Glyph({ name: 'u' + code, unicode: Number(code), advanceWidth: advance * U, path }));
  }
  const font = new opentype.Font({
    familyName: 'Inventatory ' + file.replace('pixel-', 'Pixel '), styleName: 'Regular',
    unitsPerEm: height * U, ascender: ascent * U, descender: -descent * U, glyphs: list,
  });
  writeFileSync(new URL(`src/assets/fonts/${file}.otf`, root), Buffer.from(font.toArrayBuffer()));
  console.log(`wrote src/assets/fonts/${file}.otf (${name}, ${list.length} glyphs, em ${height} px)`);
}
