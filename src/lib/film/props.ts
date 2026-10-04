// Concept film: the props, drawn as pixel art from photos of the real things.
import { Canvas, dataMatrix } from '../pixel';
import { bitmap, fromRects, withShadow, text, measure, fillPoly, line, C, type Bitmap } from './gfx';
import { qr } from '../intake-art';

const clampTo = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export const PART = {
  mpn: 'RC0603FR-0710KL', qty: '100', desc: 'RES 10K OHM 1% 1/10W 0603', slot: 'R1-B3',
};

/**
 * The vendor bag: dark anti-static film, sealed on three sides with a zip along the right,
 * filled out into a pillow by the cut tape inside; its black-and-white shipping label after
 * the DigiKey bag, without the vendor's branding.
 * `back`: the pillow's back half as stacked silhouettes, nearest first, each smaller and darker;
 * drawn behind the front, each pushed one step further along the bag's normal, they give it
 * its thickness when it is seen at an angle.
 */
export const BAG = { w: 148, h: 96, seal: 3, zip: 135, label: { x: 16, y: 15 } };
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function bag(): { art: Bitmap; back: Bitmap[]; dm: { x: number; y: number; size: number } } {
  const { w: W, h: H, seal: S, zip: Z } = BAG;
  const tones = ['#141918', '#1d2422', '#27312f', '#303c39', '#3d4a47', '#4a5754'];
  const [flat, fg] = bitmap(W, H);
  // the body: a pillow lit from the top left, with the soft diagonal sheens of crumpled film,
  // dithered between the film's tones
  const bw = Z - S, bh = H - 2 * S;
  const bump = (v: number) => Math.cos(Math.PI * v) / Math.sqrt(Math.max(.05, Math.sin(Math.PI * v)));
  for (let y = S; y < H - S; y++) for (let x = S; x < Z; x++) {
    const u = (x - S + .5) / bw, v = (y - S + .5) / bh;
    const d = u * 1.4 + v + .08 * Math.sin(v * 9 + u * 3);                   // along the creases
    const sheen = 1.8 * Math.exp(-Math.pow((d - .55) / .07, 2)) + 1.1 * Math.exp(-Math.pow((d - 1.25) / .05, 2))
      + .8 * Math.exp(-Math.pow((d - 1.8) / .06, 2)) - .6 * Math.exp(-Math.pow((d - 1.05) / .12, 2));
    const lit = 1.9 + .35 * bump(u) + .55 * bump(v) - .6 * (u + v) + sheen;
    const lv = clampTo(lit + BAYER4[(x & 3) + ((y & 3) << 2)] / 16 - .5, 0, 5);
    fg.fillStyle = tones[Math.floor(lv)]; fg.fillRect(x, y, 1, 1);
  }
  // the seals: flat film
  fg.fillStyle = tones[2];
  fg.fillRect(0, 0, Z, S); fg.fillRect(0, H - S, Z, S); fg.fillRect(0, 0, S, H);
  // the zip, its two tracks, and the flat lip beyond it
  fg.fillStyle = tones[2]; fg.fillRect(Z, 0, W - Z, H);
  fg.fillStyle = tones[0]; fg.fillRect(Z, 0, 1, H);
  for (const x of [Z + 2, Z + 5]) { fg.fillStyle = tones[5]; fg.fillRect(x, 0, 1, H); fg.fillStyle = tones[0]; fg.fillRect(x + 1, 0, 1, H); }
  // Filled, the bag draws its sides in: the outline pinches toward the middle of each edge.
  const [art, g] = bitmap(W, H);
  const src = fg.getImageData(0, 0, W, H), out = g.createImageData(W, H);
  const PINCH = 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // (the zip side stays straight: the zip is stiff)
    const ex = Math.round(PINCH * Math.sin(Math.PI * y / (H - 1))), ey = Math.round(PINCH * Math.sin(Math.PI * x / (W - 1)));
    if (x < ex || y < ey || y >= H - ey) continue;
    const sx = Math.floor((x - ex + .5) * W / (W - ex)), sy = Math.floor((y - ey + .5) * H / (H - 2 * ey));
    out.data.set(src.data.subarray((sy * W + sx) * 4, (sy * W + sx) * 4 + 4), (y * W + x) * 4);
  }
  g.putImageData(out, 0, 0);
  // the outline: a lit top edge, a dark lower and right edge
  const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && out.data[(y * W + x) * 4 + 3] > 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!opaque(x, y)) continue;
    if (!opaque(x, y - 1)) { g.fillStyle = tones[3]; g.fillRect(x, y, 1, 1); }
    else if (!opaque(x, y + 1) || !opaque(x + 1, y)) { g.fillStyle = tones[0]; g.fillRect(x, y, 1, 1); }
  }
  // the back half of the pillow
  const D = 6;
  const back = Array.from({ length: D }, (_, i) => {
    const d = i + 1, inset = S + PINCH + Math.round(5 * Math.pow(d / D, 2)), r = 1 + Math.round(3 * d / D);
    const [c, cg] = bitmap(W, H);
    const x0 = inset, x1 = Z - inset + S, y0 = inset, y1 = H - inset;
    cg.fillStyle = tones[d < D / 2 ? 1 : 0];
    for (let y = y0; y < y1; y++) {
      const e = Math.max(0, r - Math.min(y - y0, y1 - 1 - y));
      cg.fillRect(x0 + e, y, x1 - x0 - 2 * e, 1);
    }
    cg.fillStyle = tones[d < D / 2 ? 3 : 2];                  // the lit top edge
    cg.fillRect(x0 + r, y0, x1 - x0 - 2 * r, 1);
    return c;
  });
  // Label
  const L = BAG.label.x, T = BAG.label.y, LW = 104, LH = 66;
  g.fillStyle = tones[0]; g.fillRect(L + 1, T + 1, LW, LH);           // stuck on: its edge
  g.fillStyle = C.bone; g.fillRect(L, T, LW, LH);
  g.fillStyle = C.ink;
  g.fillRect(L + 3, T + 3, 9, 7);
  text(g, 'tiny', 'PN', L + 4, T + 9, C.bone);
  text(g, 'mono', PART.mpn, L + 15, T + 9, C.ink);
  g.fillRect(L + 3, T + 12, LW - 6, 1);
  text(g, 'tiny', 'RES 10K OHM 1% 1/10W', L + 3, T + 19, C.ink);
  text(g, 'tiny', 'YAGEO   LOT 2419', L + 3, T + 26, C.ink);
  g.fillRect(L + 3, T + 28, LW - 6, 1);
  // DataMatrix: the code the scanner reads
  const size = 22, dmx = L + 3, dmy = T + 32;
  dataMatrix(size, 41).forEach((row, y) => row.forEach((on, x) => { if (on) g.fillRect(dmx + x, dmy + y, 1, 1); }));
  // 1D barcode and the quantity box
  [1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1].forEach((on, i) => { if (on) g.fillRect(L + 30 + i, T + 33, 1, 10); });
  text(g, 'tiny', '0016898089', L + 30, T + 50, C.ink);
  g.fillRect(L + 70, T + 40, 31, 1); g.fillRect(L + 70, T + 40, 1, 23); g.fillRect(L + 100, T + 40, 1, 23); g.fillRect(L + 70, T + 62, 31, 1);
  text(g, 'tiny', 'QTY', L + 73, T + 47, C.ink);
  text(g, 'title', PART.qty, L + 74, T + 60, C.ink);
  return { art: withShadow(art), back, dm: { x: dmx, y: dmy, size } };
}

// ---------- the parts: 0603 resistors on 8 mm paper tape, then loose in the tube ----------
// A chip is a black top between two tinned ends.
const END = '#cad0ca', TOP = '#0d1010', SIDE = '#f1eee5';

/** Cut tape, drawn from the real thing in millimetres (EIA-481 8 mm paper tape for 0603):
 *  sprocket holes 1.5 mm on a 4 mm pitch, 1.75 mm in from one edge; one oblong pocket per part
 *  (1.1 mm along the tape, 1.9 mm across), 3.5 mm from the holes and 2 mm along from each;
 *  the 1.6 x 0.8 mm chip lies across the tape in it; a clear cover tape is sealed over the
 *  pockets along two lines. On the desk it is 1.25 px per mm (`TAPE_PX_MM`); close up it is drawn
 *  at its size on screen, so it gains detail as the camera comes in, rather than being swapped.
 *  The strip lies along x with its free end at x = 0 and the holes along the bottom edge.
 *  `peelMm`: how much of the cover is off, from the free end; `gone`: pockets already
 *  emptied, from the free end. */
export const TAPE_PX_MM = 1.25;
export const TAPE_MM = { w: 8, pockets: 16, pitch: 4, hole: 1.5, holeY: 6.25, pocketY: 2.75, pocketA: 1.1, pocketB: 1.9, cover: [0.3, 5.2] as const };
export const tapeLength = 84;                                   // desk pixels, 67.2 mm
const TAPE_LEN_MM = tapeLength / TAPE_PX_MM;
/** The middle of pocket k, from the free end, in mm. */
export const pocketMm = (k: number) => 4 + k * TAPE_MM.pitch;
/** Where each feature of the tape is, in mm (along from the free end, across from the top
 *  edge): the sprocket holes, and the pockets (and chips) from the free end. */
export const tapeHoles = () => { const r: number[] = []; for (let mm = 2; mm < TAPE_LEN_MM - 1; mm += TAPE_MM.pitch) r.push(mm); return r; };
export function carrier(pxPerMm: number, peelMm: number, gone: number): Bitmap {
  const T = TAPE_MM, X = (mm: number) => Math.round(mm * pxPerMm);
  const L = X(TAPE_LEN_MM), H = X(T.w);
  const [c, g] = bitmap(L, H);
  // every feature of one kind is the same whole number of pixels, placed on whole pixels, so a
  // row of them stays even at any scale
  const size = (mm: number) => Math.max(1, Math.round(mm * pxPerMm));
  const box = (u: number, v: number, du: number, dv: number, color: string): [number, number, number, number] => {
    const w = size(du), h = size(dv), x = Math.round(u * pxPerMm - w / 2), y = Math.round(v * pxPerMm - h / 2);
    g.fillStyle = color; g.fillRect(x, y, w, h);
    return [x, y, w, h];
  };
  g.fillStyle = C.paper2; g.fillRect(0, 0, L, H);
  g.fillStyle = C.bone; g.fillRect(0, 0, L, 1);
  g.fillStyle = C.muted; g.fillRect(0, H - 1, L, 1);
  // sprocket holes: punched through, so the desk shows through them; one round stamp
  const d = size(T.hole), hole: Array<[number, number]> = [];
  for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) if ((x + .5 - d / 2) ** 2 + (y + .5 - d / 2) ** 2 <= (d / 2) ** 2 + .25) hole.push([x, y]);
  for (const mm of tapeHoles()) {
    const x0 = Math.round(mm * pxPerMm - d / 2), y0 = Math.round(T.holeY * pxPerMm - d / 2);
    for (const [x, y] of hole) g.clearRect(x0 + x, y0 + y, 1, 1);
  }
  // pockets, the far wall in shade; a chip in each one not yet emptied: a black top between
  // two tinned ends, lying across the tape
  for (let k = 0; k < T.pockets; k++) {
    const m = pocketMm(k);
    const [px, py, pw, ph] = box(m, T.pocketY, T.pocketA, T.pocketB, C.divider);
    if (ph >= 4) { g.fillStyle = C.hover; g.fillRect(px, py, pw, 1); }
    if (k < gone) continue;
    const [cx, cy, cw, ch] = box(m, T.pocketY, .8, 1.6, C.ink);
    if (pxPerMm >= 2.5) {
      const e = size(.3);                                                    // tin, darker than the paper
      g.fillStyle = C.muted; g.fillRect(cx, cy, cw, e); g.fillRect(cx, cy + ch - e, cw, e);
    }
  }
  // the clear cover over what is left of it: only its two seal lines show, and its edge where
  // it has been peeled back to (a tint over it read as noise on the chips)
  const from = Math.max(0, Math.min(TAPE_LEN_MM, peelMm));
  if (from < TAPE_LEN_MM) {
    const x0 = X(from), y0 = X(T.cover[0]), y1 = X(T.cover[1]);
    g.fillStyle = C.bone; g.fillRect(x0, y0, L - x0, 1); g.fillRect(x0, y1 - 1, L - x0, 1);
    if (from > 0) g.fillRect(x0, y0, 1, y1 - y0);
  }
  return c;
}
/** The whole strip at the desk's scale, turned by `a` about its middle (cx, cy), drawn as
 *  shapes rather than a sheared bitmap (shearing broke its pockets into offset steps): its
 *  shadow, the paper, the edges, the holes, the pockets and chips. Nothing is peeled yet. */
export function carrierTurned(g: CanvasRenderingContext2D, cx: number, cy: number, a: number) {
  const k = TAPE_PX_MM, co = Math.cos(a), si = Math.sin(a), L = TAPE_LEN_MM, T = TAPE_MM;
  const at = (u: number, v: number): [number, number] => { const x = (u - L / 2) * k, y = (v - T.w / 2) * k; return [cx + x * co - y * si, cy + x * si + y * co]; };
  const quad = (u0: number, u1: number, v0: number, v1: number): Array<[number, number]> => [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
  fillPoly(g, quad(0, L, 0, T.w).map(([x, y]) => [x + 1, y + 1] as [number, number]), C.shadow);
  fillPoly(g, quad(0, L, 0, T.w), C.paper2);
  line(g, at(0, .2), at(L, .2), C.bone);
  line(g, at(0, T.w - .2), at(L, T.w - .2), C.muted);
  g.fillStyle = C.canvas;
  for (const mm of tapeHoles()) { const [x, y] = at(mm, T.holeY); g.fillRect(Math.round(x - 1), Math.round(y - 1), 2, 2); }
  for (let i = 0; i < T.pockets; i++) {
    // a chip filling its pocket: two pixels across the tape, as the upright strip has them
    g.fillStyle = C.ink;
    for (const v of [-.4, .4]) { const [x, y] = at(pocketMm(i), T.pocketY + v); g.fillRect(Math.round(x - .5), Math.round(y - .5), 1, 1); }
  }
}
/** The same strip hanging from its held end: turned a quarter so that end is at the top and
 *  the holes run down the right side. */
export function hanging(b: Bitmap): Bitmap {
  const [c, g] = bitmap(b.height, b.width);
  g.setTransform(0, -1, 1, 0, 0, b.width);
  g.drawImage(b, 0, 0);
  return c;
}

/** Loose chips at the bottom of the tube, at the desk's scale (a chip is about 2 x 1 px):
 *  a low heap of black tops with the tinned ends glinting. */
function pile(w: number, h: number): Bitmap {
  const [c, g] = bitmap(w, h);
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let x = 0; x < w; x++) {
    const top = Math.round(h * (.55 + .4 * Math.cos((x - w * .45) / w * 2.6)) + rnd() - .5);   // a low mound
    for (let y = h - top; y < h; y++) {
      const k = rnd();
      g.fillStyle = k < .1 ? END : k < .13 ? SIDE : k < .7 ? TOP : '#384543';
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}
const PILE = pile(12, 7);

/** A clear tube, front on (the screw cap is separate); `fill`: the chips are in. */
export const TUBE_BODY = { w: 16, h: 40 };
export function tube(fill: number, labelled: Bitmap | null): Bitmap {
  const { w: W, h: H } = TUBE_BODY;
  const [c, g] = bitmap(W + 1, H + 1);
  g.fillStyle = C.shadow; g.fillRect(2, 1, W - 2, H);
  g.fillStyle = '#1d2422'; g.fillRect(1, 0, W - 2, H - 2); g.fillRect(2, H - 2, W - 4, 2);
  if (fill > 0) g.drawImage(PILE, 2, H - 2 - PILE.height);
  g.fillStyle = '#384543'; g.fillRect(1, 0, 1, H - 2); g.fillRect(W - 2, 0, 1, H - 2);
  g.fillStyle = '#4a5754'; g.fillRect(3, 2, 1, H - 8);                             // highlight
  g.fillStyle = '#5d6865'; g.fillRect(1, 0, W - 2, 1);                             // the open mouth's rim
  if (labelled) g.drawImage(labelled, 1, 8);
  return c;
}

/** The screw cap; `turn` (0 or 1) steps its grip ridges, so it can be seen screwed down. */
export function cap(turn = 0): Bitmap {
  const W = 18, H = 9;
  const [c, g] = bitmap(W + 1, H + 1);
  g.fillStyle = C.shadow; g.fillRect(1, 1, W, H);
  g.fillStyle = C.paper2; g.fillRect(0, 0, W, H);
  g.fillStyle = C.bone; g.fillRect(0, 0, W, 2);
  g.fillStyle = '#8c9690';
  for (let x = 1 + turn; x < W; x += 2) g.fillRect(x, 3, 1, H - 3);        // grip ridges
  return c;
}

// ---------- the tube label, after the printed prototypes (photo, 2026-10) ----------
// Landscape; a short dark tab with the category; the part's line large and bold, cut with
// "..."; the package; a short rule; maker and parameters; the QR code right of centre; the
// slot bottom left; the label's code bottom right.
/** Die-cut corners, radius r (the labels' corners are well rounded, as in the photo). */
const rounded = (g: CanvasRenderingContext2D, w: number, h: number, r = 1) => {
  for (let y = 0; y < r; y++) {
    const e = Math.round(r - Math.sqrt(r * r - (r - y - .5) * (r - y - .5)));
    if (e <= 0) continue;
    g.clearRect(0, y, e, 1); g.clearRect(w - e, y, e, 1); g.clearRect(0, h - 1 - y, e, 1); g.clearRect(w - e, h - 1 - y, e, 1);
  }
};

/** The label as printed, at the close-up's scale (256 x 200 dots at a half). */
export function labelBig(): Bitmap {
  const W = 128, H = 100;
  const [c, g] = bitmap(W, H);
  g.fillStyle = C.bone; g.fillRect(0, 0, W, H); rounded(g, W, H, 6);
  g.fillStyle = C.ink; g.fillRect(5, 5, 50, 12); g.clearRect(5, 5, 1, 1); g.fillStyle = C.bone; g.fillRect(5, 5, 1, 1); g.fillRect(54, 5, 1, 1); g.fillRect(5, 16, 1, 1); g.fillRect(54, 16, 1, 1);
  text(g, 'bold', 'Resistor', 9, 14, C.bone);
  text(g, 'big', 'RES 10K OHM...', 5, 35, C.ink);
  text(g, 'sans', '0603', 5, 47, C.ink);
  g.fillStyle = C.ink; g.fillRect(5, 51, 62, 1);
  ['Yageo', 'R 10 kOhm', 'Pwr 0.1W'].forEach((line, i) => text(g, 'sans', line, 5, 62 + i * 10, C.ink));
  qr(19, 5).forEach((row, y) => row.forEach((on, x) => { if (on) g.fillRect(80 + x * 2, 42 + y * 2, 2, 2); }));
  text(g, 'bold', 'R1 - B3', 5, 95, C.ink);
  text(g, 'tiny', 'D-0412', W - 5 - measure('tiny', 'D-0412'), 95, C.ink);
  return c;
}

/** The printed label at any width (px), from the close-up's art: area-averaged down, then each
 *  pixel paper or ink, so it is pixel art at every size and grows legible as it grows. */
const labelSizes = new Map<number, Bitmap>();
let bigLabel: Bitmap | null = null;
export function labelAt(w: number): Bitmap {
  w = Math.max(4, Math.round(w));
  let c = labelSizes.get(w);
  if (c) return c;
  bigLabel ??= labelBig();
  const h = Math.max(3, Math.round(w * bigLabel.height / bigLabel.width));
  const [t, tg] = bitmap(w, h);
  tg.imageSmoothingEnabled = true; tg.imageSmoothingQuality = 'high';
  tg.drawImage(bigLabel, 0, 0, w, h);
  const img = tg.getImageData(0, 0, w, h), d = img.data;
  // small: a dark tone reads as ink sooner, or thin type vanishes
  const cut = w < 40 ? 200 : w < 80 ? 170 : 140;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
    const ink = (d[i] + d[i + 1] + d[i + 2]) / 3 < cut;
    d.set(ink ? [0x0d, 0x10, 0x10, 255] : [0xf1, 0xee, 0xe5, 255], i);
  }
  tg.putImageData(img, 0, 0);
  labelSizes.set(w, t);
  return t;
}

/** The same label at the desk's scale (about 32 x 27 mm), in the 4 x 6 font: too small to
 *  read, but it has the label's texture. */
/** The same label at the desk's scale (about 15 x 12 mm, as on the rack model's tubes): too
 *  small for type, so its layout in marks — the dark tab, the part line, the package, the rule,
 *  two parameter lines, the QR code, the slot. */
export function labelTiny(): Bitmap {
  return labelAt(21);
}

/** The label wrapped round a tube: the middle of it faces you, its sides curve away. `w`:
 *  how much of it still faces you (38 flat .. 14 wrapped), so the wrap can be drawn. The label
 *  is 38 x 30 here: three quarters of the tube's height, as the real one is. */
export const TUBE_LABEL_W = 38;

// The rack's label plate, hung on its front as on the real racks: a bone card with a dark
// header strip, a rule for the title and a dark pill for the rack's number, drawn as marks
// (too small to read). `hot`: the card lit, as the app's blink lights a slot.
const plates = new Map<string, Bitmap>();
export function rackPlate(n: number, hot = false): Bitmap {
  const key = n + (hot ? 'h' : '');
  let b = plates.get(key);
  if (!b) {
    const w = 20, [c, cg] = bitmap(w, 11);
    cg.fillStyle = hot ? C.focus : C.bone; cg.fillRect(0, 0, w, 11);
    cg.fillStyle = C.ink; cg.fillRect(0, 0, w, 2); cg.fillRect(2, 4, w - 4, 1);
    cg.fillRect(4, 7, w - 8, 3);
    cg.fillStyle = hot ? C.focus : C.bone;
    for (let i = 0; i < n; i++) cg.fillRect(6 + i * 2, 8, 1, 1);        // the pill's tally: one mark per rack number
    b = c; plates.set(key, b);
  }
  return b;
}
export function tubeBand(w = 14): Bitmap {
  const src = labelAt(TUBE_LABEL_W);
  const [c, g] = bitmap(w, src.height);
  g.drawImage(src, Math.round((src.width - w) / 2), 0, w, src.height, 0, 0, w, src.height);
  // the edge columns turn away from the light: paper one tone darker, ink unchanged
  const img = g.getImageData(0, 0, w, src.height);
  for (let y = 0; y < src.height; y++) for (const x of [0, w - 1]) {
    const i = (y * w + x) * 4;
    if (img.data[i] > 200) img.data.set([0xca, 0xd0, 0xca, 255], i);
  }
  g.putImageData(img, 0, 0);
  return c;
}

export const LINER = '#d8d6b6';
/** A compact direct-thermal desktop label printer (after the user's Zebra TLP 2824 Plus, about
 *  102 x 210 x 152 mm, not copied: no badge), its front to the left: a warm light grey body, the
 *  front upright below the label slot and the upper cover leaning back to a rounded shoulder, a
 *  near-flat top, a dark smoked window domed over the roll at the back; the slot at the seam
 *  over the base, a round teal feed button on top and a teal release button on the side. */
const PS = 1.7, PSIDE = { w: Math.round(64 * PS), h: Math.round(46 * PS), slot: Math.round(32 * PS), base: Math.round(34 * PS) };
// its side, front left: the outline, as a polygon (64 deep, 46 high: the real one's 210 x 152)
const PROFILE = ([[1, 45.9], [1, 30], [2.5, 22], [4, 15.5], [5.5, 12.5], [8, 10.5], [11, 9.3], [15, 8.8], [29, 8.3], [32, 6.8],
  [37, 4.8], [43, 4.1], [49, 4.3], [54, 5.8], [58, 8.5], [61, 12], [62.4, 16], [62.4, 45.9]] as Array<[number, number]>).map(([x, y]): [number, number] => [Math.min(x * PS, 64 * PS - .1), Math.min(y * PS, 46 * PS - .1)]);
const WINDOW = [Math.round(31 * PS), Math.round(57 * PS)];          // the smoked window, along the top
function printerMask() {
  const { w: W, h: H } = PSIDE;
  const [c, g] = bitmap(W, H);
  fillPoly(g, PROFILE, '#000');
  const d = g.getImageData(0, 0, W, H).data;
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 0;
  const top = Array.from({ length: W }, (_, x) => { for (let y = 0; y < H; y++) if (filled(x, y)) return y; return H; });
  return { c, filled, top };
}
/** The printer at three quarters, its front to the camera (as in the user's photos) and seen a
 *  little from above: its depth recedes up and to the right, so the front with the slot faces
 *  the viewer, the top shows the shoulder and the dome, and the right side shows the profile.
 *  Built from the side's outline: one cross-section per pixel of depth, stacked back to front,
 *  each as wide as the printer and as tall as the profile there; their top edges make the top,
 *  their right edges the side, the frontmost the front.
 *  Returns where the slot is (`o`, its middle: the stock comes out of it and hangs down over the
 *  front, square to the camera; at this scale the real 44 x 36 mm label is the desk-sized label),
 *  the feed button (it lights while printing) and `base`, the bottom row. */
export function printerTop() {
  const { w: D, h: H, slot: SLOT, base: BASE } = PSIDE;
  const FW = Math.round(102 / 210 * D), DX = .42, DY = .29;            // the front 102 mm wide; depth at half
  const { top } = printerMask();
  const ox = 1, oy = Math.ceil(D * DY) + 1;
  const [c, g] = bitmap(FW + Math.ceil(D * DX) + 3, H + oy + 1);
  const inWindow = (k: number) => k >= WINDOW[0] && k <= WINDOW[1];
  const front = top.findIndex(t => t < H);
  const box = (x: number, y: number, w: number, h: number, color: string) => { g.fillStyle = color; g.fillRect(x, y, w, h); };
  // back to front: each cross-section at its depth k
  for (let k = D - 1; k >= front; k--) {
    if (top[k] >= H) continue;
    const x = ox + Math.round(k * DX), y = oy - Math.round(k * DY), t = top[k];
    const win = inWindow(k);
    // the side (seen past the next section's right edge): the cover, the window high up at the
    // back, the seam and the base band under it
    box(x, y + t, FW, H - t, '#aca89f');
    if (win) box(x, y + t, FW, Math.max(0, Math.round(11 * PS) - t), '#27312f');
    box(x, y + BASE, FW, 1, '#6b665e'); box(x, y + BASE + 1, FW, H - BASE - 1, '#958f86');
    // the top: shaded by how steeply it falls toward the front (measured over a few sections)
    const slope = Math.abs(top[Math.min(D - 1, k + 3)] - top[Math.max(front, k - 3)]) / 6;
    const tone = win ? ((k > 42 * PS && k < 47 * PS) ? '#3d4a47' : '#1d2422') : slope > 1.2 ? '#c1bdb4' : slope > .4 ? '#d0ccc3' : '#ddd9d0';
    // down to where the next section's top starts, so a steep run (the leaning front) is solid
    const nk = Math.max(front, k - 1), next = oy - Math.round(nk * DY) + top[nk];
    box(x, y + t, FW - 1, Math.max(2, next - (y + t) + 1), tone);
    box(x + FW - 1, y + t, 1, 1, win ? '#4a5754' : '#e8e4db');                       // the lit top right edge
  }
  // the front: the cover a shade under the top, the slot across it, the seam and the base band
  const fx = ox + Math.round(front * DX), fy = oy - Math.round(front * DY), ft = top[front];
  box(fx, fy + ft, FW, BASE - ft, '#c6c2b9');
  box(fx, fy + ft, FW, 1, '#e8e4db');
  box(fx, fy + BASE, FW, 1, '#6b665e'); box(fx, fy + BASE + 1, FW, H - BASE - 1, '#a7a299');
  box(fx + Math.round(FW * .2), fy + SLOT, Math.round(FW * .6), 1, C.ink);
  box(fx + Math.round(FW * .2), fy + SLOT + 1, Math.round(FW * .6), 1, '#8f8a81');
  // the release button on the side, the feed button on top near the front, toward the right
  const disc = (cx: number, cy: number, rx: number, ry: number, fill: string, rim: string) => {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      const d = (x / (rx + .5)) ** 2 + (y / (ry + .5)) ** 2;
      if (d > 1) continue;
      g.fillStyle = d > .55 ? rim : fill; g.fillRect(cx + x, cy + y, 1, 1);
    }
  };
  const sk = Math.round(10 * PS);
  disc(ox + Math.round(sk * DX) + FW + 1, oy - Math.round(sk * DY) + Math.round(24 * PS), 1, 3, C.accent, C.active);
  const bk = Math.round(16 * PS), bx = ox + Math.round(bk * DX) + Math.round(FW * .72), by = oy - Math.round(bk * DY) + top[bk] + 1;
  disc(bx, by, 4, 2, C.accent, C.active);
  const o: [number, number] = [fx + FW / 2, fy + SLOT];
  return { art: withShadow(c), led: [bx - 1, by] as [number, number], slot: { o }, base: oy + H - 1 };
}

/** A desk monitor; its screen is drawn live by the film. */
export const SCREEN = { x: 6, y: 6, w: 172, h: 104 };
export function monitor(): Bitmap {
  const c = new Canvas(184, 132);
  c.rect(0, 0, 184, 116, 'steel');
  c.rect(SCREEN.x - 1, SCREEN.y - 1, SCREEN.w + 2, SCREEN.h + 2, 'deep');
  c.rect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h, 'ink');
  c.rect(84, 116, 16, 10, 'graphite');
  c.rect(60, 126, 64, 5, 'steel');
  return fromRects(c.render(0, 131));
}

/** The vendor's catalogue, as a small server with a globe. */
export function vendor(color: string = C.accent): Bitmap {
  const [c, g] = bitmap(40, 34);
  const ring = (cx: number, cy: number, r: number) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y);
      if (d <= r + .3 && (d > r - 1.2 || x === 0 || y === 0 || Math.abs(Math.hypot(x * 1.9, y) - r) < .8)) g.fillRect(cx + x, cy + y, 1, 1);
    }
  };
  g.fillStyle = color; ring(20, 11, 10);
  text(g, 'tiny', 'VENDOR', 8, 31, C.muted);
  return withShadow(c);
}

/** The ›-prompt from the mark, as a cursor. */
export function cursor(color = C.focus): Bitmap {
  const [c, g] = bitmap(4, 6);
  g.fillStyle = color;
  [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
  return c;
}

export { measure, text };
