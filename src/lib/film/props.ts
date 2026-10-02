// Concept film: the props, drawn as pixel art from photos of the real things.
import { Canvas, dataMatrix } from '../pixel';
import { bitmap, fromRects, withShadow, text, measure, fillPoly, C, type Bitmap } from './gfx';
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
// Drawn near true scale (about 1.3 px per mm): a chip is a black top between two tinned ends.
const END = '#cad0ca', TOP = '#0d1010', SIDE = '#f1eee5';

/** Cut tape: paper carrier with sprocket holes and one pocket per part, under a clear cover
 *  tape. `peeled` (0..1): how much of the cover is off, from the right end; `gone`: parts
 *  already out, from the right end. */
export const TAPE = { pockets: 16, pitch: 5, h: 10 };
export const tapeLength = TAPE.pockets * TAPE.pitch + 4;
export const pocketX = (i: number) => 4 + i * TAPE.pitch;
export function tape(peeled: number, gone: number, shadow = true): Bitmap {
  const L = tapeLength, H = TAPE.h;
  const [c, g] = bitmap(L, H);
  g.fillStyle = C.paper2; g.fillRect(0, 0, L, H);
  g.fillStyle = C.bone; g.fillRect(0, 0, L, 1);
  g.fillStyle = C.muted; g.fillRect(0, H - 1, L, 1);
  g.fillStyle = C.canvas;
  for (let x = 2; x < L - 1; x += TAPE.pitch) g.fillRect(x, 1, 2, 2);            // sprocket holes
  for (let i = 0; i < TAPE.pockets; i++) {
    const x = pocketX(i) - 2;
    g.fillStyle = '#384543'; g.fillRect(x, 4, 4, 4);                                 // pocket
    if (i >= TAPE.pockets - gone) continue;
    g.fillStyle = END; g.fillRect(x, 5, 1, 2); g.fillRect(x + 3, 5, 1, 2);
    g.fillStyle = TOP; g.fillRect(x + 1, 5, 2, 2);
  }
  const edge = Math.round(L * (1 - peeled));                                         // cover tape
  if (edge > 0) { g.fillStyle = C.bone; g.fillRect(0, 3, edge, 1); g.fillRect(0, 8, edge, 1); }
  return shadow ? withShadow(c) : c;
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
  if (labelled) g.drawImage(labelled, 1, 14);
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
 *  how much of it still faces you (21 flat .. 14 wrapped), so the wrap can be drawn. */
export function tubeBand(w = 14): Bitmap {
  const src = labelTiny();
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
/** A compact direct-thermal desktop label printer (after a photo of the user's, not copied: no
 *  badge, our own proportions), its front to the left: a light grey body whose rounded nose
 *  slopes down to the front, the label slot low in the front over the base band, a dark smoked
 *  window domed over the roll at the back, a round teal feed button on the nose and a teal
 *  release button on the side. */
const PS = 1.7, PSIDE = { w: Math.round(64 * PS), h: Math.round(40 * PS), slot: Math.round(31 * PS), base: Math.round(34 * PS) };
// its side, front left: the outline, as a polygon
const PROFILE = ([[2, 39.9], [2, 22], [3, 18], [5, 14.5], [8, 12], [12, 10], [17, 9], [30, 9], [34, 6.5],
  [40, 4.6], [47, 4.2], [53, 5.5], [57, 8], [60, 11], [61.9, 15], [61.9, 39.9]] as Array<[number, number]>).map(([x, y]): [number, number] => [Math.min(x * PS, 64 * PS - .1), Math.min(y * PS, 40 * PS - .1)]);
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
/** The printer turned a little toward the viewer and seen a little from above, for the bench:
 *  its side, and behind it its width going back up and to the left, so the top (nose, window)
 *  and the front with the slot across it show. Built by stacking the side's outline back across
 *  the width: each step's top edge makes the top, its front edge the front.
 *  Returns where the slot is: `o` its middle, `ax` one step across it toward the near side (one
 *  pixel down, so rows of a label lying in it stay whole rows), `fwd` one pixel of label stock
 *  coming out (to the left); the feed button (it lights while printing); `base`, the bottom row. */
export function printerTop() {
  const { w: W, h: H, slot: SLOT, base: BASE } = PSIDE, ACROSS = 75, DX = .7, DY = .45;
  const { filled, top } = printerMask();
  const ox = Math.ceil(ACROSS * DX) + 1, oy = Math.ceil(ACROSS * DY) + 1;
  const [c, g] = bitmap(W + ox + 1, H + oy + 1);
  const inWindow = (x: number) => x >= WINDOW[0] && x <= WINDOW[1];
  // the top, by how steeply it falls toward the front: the nose a tone under the flat
  const topShade = (x: number, far: boolean) => {
    if (inWindow(x)) return far ? '#4a5754' : (x > 42 * PS && x < 47 * PS) ? '#3d4a47' : '#1d2422';
    if (far) return '#e3e6e0';
    const slope = Math.abs(top[Math.min(W - 1, x + 1)] - top[Math.max(2, x - 1)]) / 2;
    return slope > 1.2 ? '#b8bfb9' : slope > .4 ? '#c8cec9' : '#d6dbd5';
  };
  const frontAt = (y: number, k: number) => y === SLOT && k > ACROSS * .15 && k < ACROSS * .85 ? C.ink
    : y === BASE ? '#5d6865' : y > BASE ? '#8c9690' : '#b8bfb9';
  for (let k = ACROSS; k >= 1; k--) {
    const sx = ox - Math.round(k * DX), sy = oy - Math.round(k * DY), far = k === ACROSS;
    for (let x = 3; x < W; x++) {
      if (top[x] >= H) continue;
      const y0 = top[x], y1 = Math.max(y0 + 1, Math.min(top[x - 1], H));
      g.fillStyle = topShade(x, far); g.fillRect(sx + x, sy + y0, 1, y1 - y0 + 1);
    }
    for (let y = top[2]; y < H; y++) { g.fillStyle = far ? '#a9b2ab' : frontAt(y, k); g.fillRect(sx + 2, sy + y, 1, 1); }
  }
  // the near side
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    if (!filled(x, y)) continue;
    const edge = y === top[x], win = inWindow(x) && y <= 11 * PS;
    g.fillStyle = edge ? (win ? '#4a5754' : '#e3e6e0') : win ? '#27312f' : y === BASE ? '#5d6865' : y > BASE ? '#8c9690' : x <= 3 ? '#c3cac4' : '#a9b2ab';
    g.fillRect(ox + x, oy + y, 1, 1);
  }
  // the release button on the side, the feed button on the nose (near the near side)
  const disc = (cx: number, cy: number, rx: number, ry: number, fill: string, rim: string) => {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      const d = (x / (rx + .5)) ** 2 + (y / (ry + .5)) ** 2;
      if (d > 1) continue;
      g.fillStyle = d > .55 ? rim : fill; g.fillRect(cx + x, cy + y, 1, 1);
    }
  };
  disc(ox + Math.round(9 * PS), oy + Math.round(25 * PS), 3, 3, C.accent, C.active);
  const kb = Math.round(ACROSS * .2), fx = Math.round(14 * PS), bx = ox - Math.round(kb * DX) + fx, by = oy - Math.round(kb * DY) + top[fx] + 2;
  disc(bx, by, 5, 2, C.accent, C.active);
  const o: [number, number] = [ox + 2 - .5 - ACROSS / 2 * DX, oy + SLOT + .5 - ACROSS / 2 * DY];
  return {
    art: withShadow(c), led: [bx - 1, by] as [number, number],
    slot: { o, ax: [DX / DY, 1] as [number, number], fwd: [-1, 0] as [number, number] }, base: oy + H - 1,
  };
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
