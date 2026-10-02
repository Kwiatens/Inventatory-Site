// Concept film: bitmaps and pixel text. Everything is drawn at one art pixel per canvas pixel;
// the canvas is scaled up as a whole with nearest-neighbour sampling.
import { CODES, CANVAS, mix, hex, type SpriteData, type Rgb, type PixelRect } from '../pixel';
import fonts from '../../data/pixel-fonts.json';

export type Bitmap = HTMLCanvasElement;

export function bitmap(w: number, h: number): [Bitmap, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w); c.height = Math.max(1, h);
  return [c, c.getContext('2d')!];
}

const shade = (rgb: Rgb) => hex(mix(rgb, CANVAS, .62));

/** A model sprite (scripts/pixel-art), with the lockup's one-pixel drop shadow. */
export function fromCodes(data: SpriteData, shadow = true): Bitmap {
  const [c, g] = bitmap(data.width + 1, data.height + 1);
  for (const pass of shadow ? [1, 0] : [0]) {
    data.rows.forEach((row, y) => {
      for (let x = 0; x < row.length;) {
        const code = row[x];
        if (code === '.') { x++; continue; }
        let run = 1;
        while (x + run < row.length && row[x + run] === code) run++;
        const rgb = CODES[code] ?? [255, 0, 255];
        g.fillStyle = pass ? shade(rgb) : hex(rgb);
        g.fillRect(x + pass, y + pass, run, 1);
        x += run;
      }
    });
  }
  return c;
}

/** Procedural art (lib/pixel Canvas.render, 10 units per pixel) as a bitmap. */
export function fromRects(art: { faces: PixelRect[]; width: number; height: number }, shadow = true): Bitmap {
  const [c, g] = bitmap(art.width / 10 + 1, art.height / 10 + 1);
  const px = (v: number) => Math.round(v / 10);
  if (shadow) for (const f of art.faces) if (f.shadow) { g.fillStyle = f.shadow; g.fillRect(px(f.x) + 1, px(f.y) + 1, px(f.w), px(f.h)); }
  for (const f of art.faces) { g.fillStyle = f.fill; g.fillRect(px(f.x), px(f.y), px(f.w), px(f.h)); }
  return c;
}

/** Quarter turn clockwise: lossless for pixel art. */
export function rotate(src: Bitmap): Bitmap {
  const [c, g] = bitmap(src.height, src.width);
  g.translate(src.height, 0); g.rotate(Math.PI / 2); g.drawImage(src, 0, 0);
  return c;
}

/** Bitmap with a one-pixel drop shadow added under its opaque pixels. */
export function withShadow(src: Bitmap, color = '#080a0a'): Bitmap {
  const [c, g] = bitmap(src.width + 1, src.height + 1);
  const [m, mg] = bitmap(src.width, src.height);
  mg.drawImage(src, 0, 0); mg.globalCompositeOperation = 'source-in'; mg.fillStyle = color; mg.fillRect(0, 0, m.width, m.height);
  g.drawImage(m, 1, 1); g.drawImage(src, 0, 0);
  return c;
}

// ---------- pixel text, from the U8g2 fonts the scanner uses (scripts/pixel-font) ----------

type Glyph = [number, number, number, string];
type Font = { top: number; height: number; glyphs: Record<string, Glyph> };
export type FontName = keyof typeof fonts;
const FONTS = fonts as unknown as Record<FontName, Font>;

// Ω is outside the fonts' Latin-1 range; drawn to match helvB10's capitals.
const OMEGA = ['..#####..', '.##...##.', '##.....##', '##.....##', '##.....##', '##.....##', '.##...##.', '..##.##..', '..##.##..', '###...###', '###...###'];
FONTS.title.glyphs[String(0x3a9)] = [10, 0, 9, [...Array(3).fill('.........'), ...OMEGA, ...Array(3).fill('.........')].join('').replace(/#/g, '1').replace(/\./g, '0')];

const glyph = (font: Font, ch: string) => font.glyphs[String(ch.codePointAt(0))] ?? font.glyphs['63'];

export function measure(name: FontName, str: string) {
  const font = FONTS[name];
  return [...str].reduce((w, ch) => w + glyph(font, ch)[0], 0);
}
export const lineHeight = (name: FontName) => FONTS[name].height;
export const ascent = (name: FontName) => -FONTS[name].top;

/** Draw text with its baseline at y. Returns the advance. */
export function text(g: CanvasRenderingContext2D, name: FontName, str: string, x: number, y: number, color: string) {
  const font = FONTS[name];
  g.fillStyle = color;
  let cx = Math.round(x);
  const top = Math.round(y) + font.top;
  for (const ch of str) {
    const [adv, left, w, rows] = glyph(font, ch);
    for (let r = 0; r < font.height; r++) {
      for (let col = 0; col < w;) {
        if (rows[r * w + col] !== '1') { col++; continue; }
        let run = 1;
        while (col + run < w && rows[r * w + col + run] === '1') run++;
        g.fillRect(cx + left + col, top + r, run, 1);
        col += run;
      }
    }
    cx += adv;
  }
  return cx - Math.round(x);
}

// ---------- dither: the film's transitions, a 4 x 4 ordered pattern ----------

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const patterns = new Map<number, CanvasPattern>();
/** The 4 x 4 ordered pattern at `level` (0..16): the pixels whose threshold is under it. */
function ditherPattern(g: CanvasRenderingContext2D, level: number) {
  let p = patterns.get(level);
  if (!p) {
    const [t, tg] = bitmap(4, 4);
    tg.fillStyle = '#000';
    BAYER.forEach((v, i) => { if (v < level) tg.fillRect(i % 4, i >> 2, 1, 1); });
    p = g.createPattern(t, 'repeat')!;
    patterns.set(level, p);
  }
  return p;
}
/** Dither dissolve: erases `amount` (0..1) of the pixels, ordered, down to row `h`. */
export function dither(g: CanvasRenderingContext2D, amount: number, h = g.canvas.height) {
  const level = Math.round(Math.max(0, Math.min(1, amount)) * 16);
  if (level === 0) return;
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = ditherPattern(g, level);
  g.fillRect(0, 0, g.canvas.width, h);
  g.restore();
}

// ---------- shapes in perspective: pixel-exact polygons, lines and affine-mapped bitmaps ----------

type Pt = [number, number];

/** Fill a polygon on whole pixels (centre sampling); level < 16 dithers it like `dither`. */
export function fillPoly(g: CanvasRenderingContext2D, pts: Pt[], color: string, level = 16) {
  if (level <= 0 || pts.length < 3) return;
  const ys = pts.map(p => p[1]);
  g.fillStyle = color;
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    const yc = y + .5, xs: number[] = [];
    pts.forEach(([ax, ay], i) => {
      const [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
    });
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.ceil(xs[k] - .5), xb = Math.floor(xs[k + 1] - .5);
      if (level >= 16) { if (xb >= xa) g.fillRect(xa, y, xb - xa + 1, 1); continue; }
      for (let x = xa; x <= xb; x++) if (BAYER[(x & 3) + ((y & 3) << 2)] < level) g.fillRect(x, y, 1, 1);
    }
  }
}

/** Convex hull, for light cones between two shapes. */
export function hull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: Pt[]) => {
    const h: Pt[] = [];
    for (const q of list) { while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); }
    h.pop(); return h;
  };
  return [...half(p), ...half(p.reverse())];
}

/** A one-pixel line, Bresenham. */
export function line(g: CanvasRenderingContext2D, a: Pt, b: Pt, color: string) {
  let [x0, y0] = a.map(Math.round), [x1, y1] = b.map(Math.round);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  g.fillStyle = color;
  for (;;) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

const pixelsOf = new WeakMap<Bitmap, ImageData>();
let scratch: [Bitmap, CanvasRenderingContext2D] | null = null;
/**
 * Draw a bitmap through an affine map: source pixel (i, j) lands at o + i·ax + j·ay. Sampled
 * per destination pixel (nearest), so a turned or foreshortened bitmap stays pixel art.
 * Pixels are read once per bitmap; pass `live` for one that is redrawn between calls.
 */
export function drawAffine(g: CanvasRenderingContext2D, src: Bitmap, o: Pt, ax: Pt, ay: Pt, live = false) {
  const w = src.width, h = src.height;
  let data = live ? undefined : pixelsOf.get(src);
  if (!data) { data = src.getContext('2d')!.getImageData(0, 0, w, h); if (!live) pixelsOf.set(src, data); }
  const det = ax[0] * ay[1] - ay[0] * ax[1];
  if (Math.abs(det) < 1e-3) return;
  const cs = [[0, 0], [w, 0], [w, h], [0, h]].map(([i, j]) => [o[0] + i * ax[0] + j * ay[0], o[1] + i * ax[1] + j * ay[1]]);
  const x0 = Math.floor(Math.min(...cs.map(c => c[0]))), x1 = Math.ceil(Math.max(...cs.map(c => c[0])));
  const y0 = Math.floor(Math.min(...cs.map(c => c[1]))), y1 = Math.ceil(Math.max(...cs.map(c => c[1])));
  const bw = x1 - x0, bh = y1 - y0;
  if (bw <= 0 || bh <= 0) return;
  if (!scratch || scratch[0].width < bw || scratch[0].height < bh) scratch = bitmap(Math.max(bw, scratch?.[0].width ?? 0), Math.max(bh, scratch?.[0].height ?? 0));
  const out = scratch[1].createImageData(bw, bh), px = data.data;
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const dx = x0 + x + .5 - o[0], dy = y0 + y + .5 - o[1];
    const i = Math.floor((dx * ay[1] - dy * ay[0]) / det), j = Math.floor((ax[0] * dy - ax[1] * dx) / det);
    if (i < 0 || j < 0 || i >= w || j >= h) continue;
    const k = (j * w + i) * 4;
    if (px[k + 3] < 128) continue;
    out.data.set([px[k], px[k + 1], px[k + 2], 255], (y * bw + x) * 4);
  }
  scratch[1].clearRect(0, 0, bw, bh);
  scratch[1].putImageData(out, 0, 0);
  g.drawImage(scratch[0], 0, 0, bw, bh, x0, y0, bw, bh);
}

/**
 * Draw a bitmap turned by `a` (radians, clockwise) about its middle, which lands on (cx, cy).
 * Three integer shears: every source pixel moves to exactly one pixel, so a turned sprite
 * keeps all its pixels and its features step together (no gaps, no doubled rows).
 */
export function drawRotated(g: CanvasRenderingContext2D, src: Bitmap, cx: number, cy: number, a: number) {
  const w = src.width, h = src.height;
  let data = pixelsOf.get(src);
  if (!data) { data = src.getContext('2d')!.getImageData(0, 0, w, h); pixelsOf.set(src, data); }
  const t = -Math.tan(a / 2), s = Math.sin(a), half = Math.ceil(Math.hypot(w, h) / 2) + 2, size = half * 2;
  if (!scratch || scratch[0].width < size || scratch[0].height < size) scratch = bitmap(Math.max(size, scratch?.[0].width ?? 0), Math.max(size, scratch?.[0].height ?? 0));
  const out = scratch[1].createImageData(size, size), px = data.data;
  const ox = Math.floor(w / 2), oy = Math.floor(h / 2);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = (j * w + i) * 4;
    if (px[k + 3] < 128) continue;
    const x0 = i - ox, y0 = j - oy;
    const x1 = x0 + Math.round(t * y0), y1 = y0 + Math.round(s * x1), x2 = x1 + Math.round(t * y1);
    out.data.set([px[k], px[k + 1], px[k + 2], 255], ((y1 + half) * size + x2 + half) * 4);
  }
  scratch[1].clearRect(0, 0, size, size);
  scratch[1].putImageData(out, 0, 0);
  g.drawImage(scratch[0], 0, 0, size, size, Math.round(cx) - half, Math.round(cy) - half, size, size);
}

export const C = {
  canvas: '#0d1010', surface: '#141918', raised: '#1d2422', hover: '#27312f', divider: '#384543',
  steel: '#5d6865', muted: '#8c9690', secondary: '#cad0ca', text: '#f1eee5', accent: '#58b9b0',
  focus: '#b9e7dd', active: '#315a55', ink: '#0d1010', bone: '#f1eee5', paper2: '#cad0ca',
  shadow: '#080a0a', lcd: '#a9b6a4', lcdInk: '#1f2723', lcdGhost: '#a1ae9c',
};
