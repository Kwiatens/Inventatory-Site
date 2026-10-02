// Concept film: the props, drawn as pixel art from photos of the real things.
import { Canvas, dataMatrix } from '../pixel';
import { bitmap, fromRects, withShadow, text, measure, C, type Bitmap } from './gfx';
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

// ---------- macro: the tape and the chips at about 7 px per mm ----------
export const MACRO = { pitch: 28, h: 56, pockets: 14, hole: 12, pocket: 36, cover: [20, 52] as [number, number] };
export const macroLength = MACRO.pockets * MACRO.pitch;
export const macroPocketX = (i: number) => 14 + i * MACRO.pitch;
/** The paper carrier: sprocket holes along one edge, a punched pocket per chip. */
export function macroTape(): Bitmap {
  const L = macroLength, H = MACRO.h;
  const [c, g] = bitmap(L, H);
  g.fillStyle = C.paper2; g.fillRect(0, 0, L, H);
  g.fillStyle = C.bone; g.fillRect(0, 0, L, 2);
  g.fillStyle = '#a9b0aa'; g.fillRect(0, H - 2, L, 2);
  for (let i = 0; i < MACRO.pockets; i++) {
    const x = macroPocketX(i);
    // sprocket hole (1.5 mm): a pixel circle through to the dark behind
    g.fillStyle = C.canvas;
    for (let y = -5; y <= 5; y++) for (let dx = -5; dx <= 5; dx++) if (dx * dx + y * y <= 26) g.fillRect(x - 14 + dx, MACRO.hole + y, 1, 1);
    // the pocket, a punched slot a little larger than the chip
    g.fillStyle = '#5d6865'; g.fillRect(x - 5, MACRO.pocket - 8, 10, 16);
    g.fillStyle = '#384543'; g.fillRect(x - 5, MACRO.pocket - 8, 10, 2);
  }
  return c;
}
/** The clear cover tape over the pockets: its edges, and a few glints. */
export function macroCover(): Bitmap {
  const L = macroLength, [a, b] = MACRO.cover;
  const [c, g] = bitmap(L, MACRO.h);
  g.fillStyle = C.bone; g.fillRect(0, a, L, 1); g.fillRect(0, b, L, 1);
  for (let y = a + 1; y < b; y++) for (let x = (y % 2) * 2; x < L; x += 4) if ((x + y) % 8 < 2) g.fillRect(x, y, 1, 1);   // the film's sheen
  for (let x = 9; x < L; x += 47) for (let k = 0; k < 6; k++) g.fillRect(x + k, a + 4 + k * 2, 1, 2);
  return c;
}
/** An 0603 chip resistor, as it sits in the tape: tinned ends top and bottom, black top. */
/** The chip on its edge, seen side on: the white ceramic between the tinned ends. */
export function macroChipEdge(): Bitmap {
  const [c, g] = bitmap(12, 4);
  g.fillStyle = '#8c9690'; g.fillRect(0, 0, 3, 4); g.fillRect(9, 0, 3, 4);
  g.fillStyle = SIDE; g.fillRect(3, 1, 6, 3);
  g.fillStyle = TOP; g.fillRect(3, 0, 6, 1);
  return c;
}
export function macroChip(): Bitmap {
  const [c, g] = bitmap(7, 12);
  g.fillStyle = '#8c9690'; g.fillRect(0, 0, 7, 3); g.fillRect(0, 9, 7, 3);
  g.fillStyle = C.bone; g.fillRect(1, 0, 4, 1); g.fillRect(1, 9, 4, 1);
  g.fillStyle = TOP; g.fillRect(0, 3, 7, 6);
  g.fillStyle = '#27312f'; g.fillRect(1, 3, 5, 1);
  return c;
}

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
  if (labelled) g.drawImage(labelled, 1, 14);
  return c;
}

export function cap(): Bitmap {
  const W = 18, H = 9;
  const [c, g] = bitmap(W + 1, H + 1);
  g.fillStyle = C.shadow; g.fillRect(1, 1, W, H);
  g.fillStyle = C.paper2; g.fillRect(0, 0, W, H);
  g.fillStyle = C.bone; g.fillRect(0, 0, W, 2);
  g.fillStyle = '#8c9690';
  for (let x = 1; x < W; x += 2) g.fillRect(x, 3, 1, H - 3);        // grip ridges
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

/** The same label at the desk's scale (about 32 x 27 mm), in the 4 x 6 font: too small to
 *  read, but it has the label's texture. */
/** The same label at the desk's scale (about 15 x 12 mm, as on the rack model's tubes): too
 *  small for type, so its layout in marks — the dark tab, the part line, the package, the rule,
 *  two parameter lines, the QR code, the slot. */
export function labelTiny(): Bitmap {
  const W = 21, H = 16;
  const [c, g] = bitmap(W, H);
  g.fillStyle = C.bone; g.fillRect(0, 0, W, H); rounded(g, W, H, 2);
  g.fillStyle = C.ink;
  g.fillRect(1, 1, 8, 3);                                                   // tab
  for (const [x, w] of [[1, 5], [7, 3], [11, 4]]) g.fillRect(x, 5, w, 2);  // RES 10K OHM...
  g.fillRect(1, 8, 4, 1);                                                   // 0603
  g.fillRect(1, 9, 10, 1);                                                  // rule
  for (const [y, w] of [[11, 5], [13, 6]]) g.fillRect(1, y, w, 1);          // maker, value
  ['######', '#..#.#', '#.##.#', '##.#..', '#...##', '######'].forEach((row, y) =>   // QR
    [...row].forEach((ch, x) => { if (ch === '#') g.fillRect(13 + x, 8 + y, 1, 1); }));
  g.fillStyle = C.bone; for (let x = 2; x < 9; x += 2) g.fillRect(x, 2, 1, 1);  // the tab's word
  g.fillStyle = C.ink; g.fillRect(1, 15, 7, 1);                             // R1 - B3
  return c;
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

/** The printer for the close-up, from above and in front (tops true to shape, upright faces
 *  shortened): the domed lid with the feed button and its light; under its front edge the
 *  lip, the slot and the base's face. One body: the faces hang from the lid's outline, so they
 *  follow its rounded corners. */
export const PRINTER_ANGLED = { w: 250, h: 80, slot: 54, led: [92, 34] as [number, number] };
export const LINER = '#d8d6b6';
export function printerAngled(): Bitmap {
  const { w: W, h: H, slot: SL } = PRINTER_ANGLED;
  const [c, g] = bitmap(W, H);
  const EDGE = 46, R = 16, LIP = SL - EDGE, BASE = 22;
  const front = (x: number) => {                                    // the lid's front edge, per column
    const d = Math.min(x, W - 1 - x);
    return d >= R ? EDGE : EDGE - Math.round(R - Math.sqrt(R * R - (R - d - .5) * (R - d - .5)));
  };
  for (let x = 0; x < W; x++) {
    const f = front(x), side = x < 6 || x >= W - 6, mid = x >= 36 && x < W - 36;
    const col = (y0: number, y1: number, color: string) => { g.fillStyle = color; g.fillRect(x, y0, 1, y1 - y0); };
    col(0, f, side ? '#5d6865' : mid ? '#7c8783' : '#6b7773');      // the top, its dome lit in the middle
    if (mid) col(f - 6, f, '#6b7773');
    col(f - 1, f, '#8c9690');                                        // the front edge
    col(f, f + LIP, '#4a5754');                                      // the lip
    const inSlot = x >= 55 && x < W - 55;
    col(f + LIP, f + LIP + 2, inSlot ? C.ink : '#1d2422');           // the slot, the split line
    col(f + LIP + 2, f + LIP + BASE, '#3d4a47');                     // the base
    col(f + LIP + BASE, f + LIP + BASE + 2, '#27312f');
  }
  g.fillStyle = '#a9b2ab'; g.fillRect(64, 8, W - 128, 1); g.fillRect(80, 6, W - 160, 1);
  g.fillStyle = '#27312f'; g.fillRect(105, 29, 40, 10); g.fillRect(106, 28, 38, 12);
  g.fillStyle = '#4a5754'; g.fillRect(107, 29, 36, 1);
  g.fillStyle = C.active; g.fillRect(PRINTER_ANGLED.led[0], PRINTER_ANGLED.led[1], 6, 2);
  return c;
}

/** A compact direct-thermal desktop label printer, seen from its side with its front to the
 *  left: a clamshell lid domed over the roll, hinged at the back, its split line running down
 *  to the label slot in the front; a feed button and a light on top; rubber feet; the cable. */
export const PRINTER_SLOT = 23, PRINTER_LED: [number, number] = [16, 10];
/** `s`: scale (the close-up draws it at 3); outlines stay one pixel. */
export function printer(s = 1): Bitmap {
  const W = 60 * s, H = 44 * s, S = (v: number) => Math.round(v * s);
  const [c, g] = bitmap(W, H);
  const front = S(2), back = W - 1, mid = S(36);
  const top = (x: number) => x < mid ? S(4) + S(9) * Math.pow((mid - x) / (mid - front), 2) : S(4) + S(9) * Math.pow((x - mid) / (back - mid), 2);
  const split = (x: number) => S(PRINTER_SLOT) - S(9) * Math.pow((x - front) / (back - front), 1.4);
  for (let x = front; x <= back; x++) {
    const y0 = Math.round(top(x)), ys = Math.round(split(x));
    for (let y = y0; y < H - S(2); y++) {
      const f = y === y0 ? '#a9b2ab' : y < y0 + S(3) ? '#7c8783' : y < ys ? '#6b7773' : y === ys ? '#1d2422' : y === ys + 1 ? '#5d6865' : y < H - S(3) ? '#3d4a47' : '#27312f';
      g.fillStyle = f; g.fillRect(x, y, 1, 1);
    }
  }
  // the front: the lid's lip over the slot, the base's face under it
  g.fillStyle = '#8c9690'; g.fillRect(front, Math.round(top(front)) + 1, s, S(PRINTER_SLOT) - Math.round(top(front)) - 1);
  g.fillStyle = C.ink; g.fillRect(front - 1, S(PRINTER_SLOT), S(6), s);
  g.fillStyle = '#4a5754'; g.fillRect(front, S(PRINTER_SLOT + 1), S(2), H - S(3) - S(PRINTER_SLOT + 1));
  // feed button and light on the top, near the front
  g.fillStyle = '#27312f'; g.fillRect(S(8), Math.round(top(S(8))) - S(2), S(5), S(2));
  g.fillStyle = '#a9b2ab'; g.fillRect(S(9), Math.round(top(S(8))) - S(2), S(3), 1);
  g.fillStyle = C.active; g.fillRect(S(PRINTER_LED[0]), S(PRINTER_LED[1]), S(2), s);
  // feet, the cable at the back
  g.fillStyle = '#1d2422'; g.fillRect(S(6), H - S(2), S(8), S(2)); g.fillRect(W - S(14), H - S(2), S(8), S(2));
  g.fillRect(back - S(2), S(32), S(3), S(5));
  return withShadow(c);
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
