// Concept: "One scan" — the intake film. A 384 x 192 pixel-art canvas, scaled up whole.
//
// render(t) draws the complete frame for any moment of the loop, so playback, scrubbing and
// reduced motion share one code path. Motion is smooth (60 fps) but every position is rounded
// to the art pixel grid. Shots change with an ordered-dither dissolve.
//
// Accuracy: the scanner close-up plays the firmware's own "intake" recording 1:1; the values
// and the slot follow the desktop app (vendor enrichment, first free slot, auto-printed label).
import art from '../../data/pixel-art.json';
import { lcdFrameAt, frameBits, paintLcdCanvas } from '../scan-player';
import { GLYPHS, type SpriteData } from '../pixel';
import { bitmap, fromCodes, rotate, text, measure, dither, fillPoly, hull, line, drawAffine, drawRotated, C, type Bitmap } from './gfx';
import * as P from './props';
import { getLockup, shadowOffset, CELL_W, CELL_H, TOP_ROW } from '../lockup';
import { hero } from '../../data/home';

export const W = 384, H = 192;
const DESK = 166;
// Each shot keeps its own clock. The scan runs on t; the close-up on t - FACE_SHIFT; the
// shots after it on t - LATER_SHIFT.
// The close-up's clock starts at 4800 and the later shots' at 11900, so trimming one shot
// moves everything after it.
const SCAN_END = 6400, FACE_SHIFT = SCAN_END - 4800, FACE_HOLD = 600, FACE_END = FACE_SHIFT + 12400 - FACE_HOLD, LATER_SHIFT = FACE_END - 11900;
const later = (u: number) => u + LATER_SHIFT;
// The bench (u 20000..BENCH_END) has two close-ups in it, the macro and the printer; each
// part is timed from the one before, and the rack runs on u - BENCH_EXTRA.
const MACRO_IN = 22400, MACRO_LEN = 3000;
const MACRO = [MACRO_IN, MACRO_IN + MACRO_LEN], CAP = MACRO[1] + 300;   // then the cap goes on
const PRINT = [CAP + 1300, CAP + 1300 + 3300];
const BENCH_END = PRINT[1] + 2200, BENCH_EXTRA = BENCH_END - 28200;
// After the end card (rack clock), the sign-off: the lockup assembles from the film's motifs.
// The lockup first, then what it took (RESULT: the lockup moves up, the numbers come in).
const SIGN = 32600, RESULT = SIGN + 5000, SIGN_END = SIGN + 9600, PAUSE = 1000;   // then a blank second
export const LOOP = later(SIGN_END + BENCH_EXTRA) + PAUSE;
/** The frame to show still (reduced motion): the finished lockup. */
export const POSTER = later(SIGN_END + BENCH_EXTRA) - 900;
/** Chapter starts, for the scrubber. */
export const CHAPTERS = [0, SCAN_END, FACE_END, ...[20000, PRINT[0], BENCH_END, SIGN + BENCH_EXTRA, RESULT + BENCH_EXTRA].map(later)];
const CAPTIONS: Array<[number, number, string]> = [
  [400, SCAN_END - 300, 'Scan the label on the bag.'],
  [SCAN_END + 200, FACE_SHIFT + 9100 - FACE_HOLD, 'The quantity came from the label.'],
  [FACE_SHIFT + 9200 - FACE_HOLD, FACE_END - 200, 'Press A to add it.'],
  ...([
    [12000, 14300, 'The label fills in the part and quantity.'],
    [14400, 19800, 'Inventatory asks the vendor for the rest.'],
    [20200, PRINT[0] - 200, 'Peel the tape; the parts drop in.'],
    [PRINT[0] + 100, BENCH_END - 200, 'Its label prints by itself.'],
    [28300 + BENCH_EXTRA, SIGN - 100 + BENCH_EXTRA, 'And it already has a slot: R1-B3.'],
  ] as Array<[number, number, string]>).map(([a, b, c]): [number, number, string] => [later(a), later(b), c]),
];

// ---------- timing helpers ----------
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeInOut = (k: number) => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const easeIn = (k: number) => k * k * k;
const R = Math.round;

// ---------- world (art px). Objects stand on one desk; the camera slides along it ----------
const RACK = { x: 1100, y: DESK - 118 };

type Tagged = SpriteData & { tags: Record<string, number[][]> };
type Pose = Tagged & { az: number; el: number; bounds: number[] };
type V3 = [number, number, number];
type Pt = [number, number];

// ---------- the CAD renders' projection (scripts/pixel-art/pixelize.py `view`) ----------
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function axes(az: number, el: number): [V3, V3] {
  const a = az * Math.PI / 180, e = el * Math.PI / 180;
  const d: V3 = [Math.cos(e) * Math.sin(a), -Math.cos(e) * Math.cos(a), Math.sin(e)];
  const n = Math.hypot(d[0], d[1]);
  const r: V3 = [-d[1] / n, d[0] / n, 0];
  return [r, [d[1] * r[2] - d[2] * r[1], d[2] * r[0] - d[0] * r[2], d[0] * r[1] - d[1] * r[0]]];
}
/** Model point (mm) to sprite pixel. */
const project = (p: Pose, P: V3): Pt => {
  const [r, u] = axes(p.az, p.el), [x0, x1, , y1] = p.bounds, s = p.width / (x1 - x0);
  return [(dot(P, r) - x0) * s, (y1 - dot(P, u)) * s];
};
/** Model direction (mm) to sprite pixels. */
const linear = (p: Pose, v: V3): Pt => {
  const [r, u] = axes(p.az, p.el), s = p.width / (p.bounds[1] - p.bounds[0]);
  return [dot(v, r) * s, -dot(v, u) * s];
};

// Scan R1 (FreeCAD model, mm): the scan window in the nose, and the hover pose's footprint.
const BAG_DEPTH = 1.6;                                           // mm per back layer
const NOSE = -67, WINDOW = { y: 10.8, z0: -3.8, z1: 8.4 }, WINDOW_Z = 2.3;
const FOOT = { x: 65, y: 37, z: -13 };

export function createFilm(canvas: HTMLCanvasElement) {
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;

  // Bitmaps, built once.
  const bag = P.bag();
  const poses = art.filmScanner as unknown as Pose[];
  const poseArt = poses.map(p => fromCodes(p));
  const AIM = poses.length - 1;                          // az 35: the pose that aims at the label
  const poseAt = (az: number) => Math.round(clamp((poses[0].az - az) / (poses[0].az - poses[AIM].az)) * AIM);
  const rackEmpty = fromCodes(art.filmRackEmpty as unknown as Tagged);
  const rackFull = fromCodes(art.filmRackFull as unknown as Tagged);
  const rackTube = fromCodes(art.filmTube as unknown as Tagged);
  const rackTags = (art.filmRackFull as unknown as Tagged).tags;
  const labelBig = P.labelBig(), labelTiny = P.labelTiny();
  const printerAngled = P.printerAngled();
  const labelShadow = (() => {
    const [c, cg] = bitmap(labelBig.width, labelBig.height);
    cg.drawImage(labelBig, 0, 0); cg.globalCompositeOperation = 'source-in'; cg.fillStyle = C.shadow; cg.fillRect(0, 0, c.width, c.height);
    return c;
  })();
  const band = P.tubeBand();
  const bands = new Map<number, Bitmap>();
  const bandOf = (w: number) => { let b = bands.get(w); if (!b) { b = P.tubeBand(w); bands.set(w, b); } return b; };
  const cap = P.cap();
  const printer = P.printer();
  const monitor = P.monitor();
  const vendor = P.vendor();
  // The part of the bag label the close-up quotes: its codes and the QTY box (P.bag layout).
  const BL = P.BAG.label;
  const QTY_CROP = { x: BL.x, y: BL.y + 29, w: 104, h: 37 }, QTY_BOX = { x: BL.x + 70, y: BL.y + 40, w: 31, h: 23 };
  const faceData = art.filmFace as unknown as Tagged;
  const face = fromCodes(faceData);
  // The glass the window shows, and the 128 x 64 dot area centred in it.
  const glassPx = (faceData.uv ?? []).map(q => [q[0], q[1]] as Pt);
  const gx0 = Math.min(...glassPx.map(q => q[0])), gx1 = Math.max(...glassPx.map(q => q[0]));
  const gy0 = Math.min(...glassPx.map(q => q[1])), gy1 = Math.max(...glassPx.map(q => q[1]));
  const faceLcd: Pt = [Math.floor((gx0 + gx1 + 1 - 128) / 2), Math.floor((gy0 + gy1 + 1 - 64) / 2)];
  // Key tops only (the lighter band; the darker rows under them are the keys' front faces).
  const faceKeys = Object.entries(faceData.tags).filter(([k]) => k.startsWith('key-')).map(([k, all]) => {
    const cells = all.filter(([x, y]) => faceData.rows[y][x] === 'K');
    const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
    return { key: k.slice(4), x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
  });

  // Scanner sprite in a pose, with the firmware frame painted into its LCD pixels.
  const lcdCache = new Map<string, Bitmap>();
  const scannerAt = (pose: number, frame: number) => {
    const key = pose + ':' + frame;
    let b = lcdCache.get(key);
    if (!b) {
      const src = poseArt[pose];
      const [c, cg] = bitmap(src.width, src.height);
      cg.drawImage(src, 0, 0);
      paintLcdCanvas(cg, poses[pose].uv ?? [], frame);
      b = c; lcdCache.set(key, b);
    }
    return b;
  };
  const lcdCentre = poses.map(p => {
    const uv = p.uv ?? [[0, 0]];
    return [uv.reduce((a, q) => a + q[0], 0) / uv.length, uv.reduce((a, q) => a + q[1], 0) / uv.length] as Pt;
  });

  // ---------- the scan shot's space: the bag stands in the scanner's model space ----------
  // The label ends up square to the scan window, 100 mm ahead of the nose, its DataMatrix at the
  // window's height; so the bag is drawn with the same projection as the scanner.
  const aim = poses[AIM];
  const MM = (aim.bounds[1] - aim.bounds[0]) / aim.width;          // mm per art pixel
  const bagW = bag.art.width - 1, bagH = bag.art.height - 1;
  const dmc: Pt = [bag.dm.x + bag.dm.size / 2, bag.dm.y + bag.dm.size / 2];
  const PIVOT: V3 = [NOSE - 100, (bagW / 2 - dmc[0]) * MM, WINDOW_Z - (bagH - dmc[1]) * MM];
  const DESK_Z = PIVOT[2];
  // The bag turns about its bottom edge's middle: from square to the viewer (yaw 90 - az, tilted
  // back by el) to square to the scanner (yaw 0, upright). Returns the bag-pixel → screen map.
  const bagMap = (k: number, pivot: Pt) => {
    const yaw = (90 - aim.az) * (1 - k) * Math.PI / 180, tilt = aim.el * (1 - k) * Math.PI / 180;
    const ex: V3 = [Math.sin(yaw), Math.cos(yaw), 0];
    const ey: V3 = [Math.cos(yaw) * Math.sin(tilt), -Math.sin(yaw) * Math.sin(tilt), -Math.cos(tilt)];
    const ax = linear(aim, ex).map(v => v * MM) as Pt, ay = linear(aim, ey).map(v => v * MM) as Pt;
    const o: Pt = [pivot[0] - bagW / 2 * ax[0] - bagH * ay[0], pivot[1] - bagW / 2 * ax[1] - bagH * ay[1]];
    const at = (i: number, j: number): Pt => [o[0] + i * ax[0] + j * ay[0], o[1] + i * ax[1] + j * ay[1]];
    const n: V3 = [ex[1] * ey[2] - ex[2] * ey[1], ex[2] * ey[0] - ex[0] * ey[2], ex[0] * ey[1] - ex[1] * ey[0]];
    const back = linear(aim, n).map(v => v * MM * BAG_DEPTH) as Pt;
    return { o, ax, ay, at, back };
  };
  // Frame it: bag and scanner centred together, the bag's foot just above the desk band.
  const pivotRel = project(aim, PIVOT);
  const endBag = bagMap(1, pivotRel);
  const corners = [[0, 0], [bagW, 0], [bagW, bagH], [0, bagH]].map(([i, j]) => endBag.at(i, j));
  const xs = [0, aim.width, ...corners.map(c => c[0])];
  const bottom = Math.max(aim.height, ...corners.map(c => c[1]));
  const AIMED: Pt = [R(W / 2 - (Math.min(...xs) + Math.max(...xs)) / 2), R(DESK - 6 - bottom)];
  const BAG_END: Pt = [AIMED[0] + pivotRel[0], AIMED[1] + pivotRel[1]];
  const BAG_START: Pt = [W / 2, 150];
  // Turned back to show its screen, it rises and steps right, clear of the bag.
  const OUT_X = 16;
  // The close-up LCD at 1:1.
  const lcdImages = new Map<number, ImageData>();
  const lcdImage = (frame: number) => {
    let img = lcdImages.get(frame);
    if (!img) {
      img = g.createImageData(128, 64);
      const bits = frameBits(frame);
      const on = [0x1f, 0x27, 0x23], off = [0xa9, 0xb6, 0xa4];
      for (let i = 0; i < 128 * 64; i++) { const c = bits[i] ? on : off; img.data.set([c[0], c[1], c[2], 255], i * 4); }
      lcdImages.set(frame, img);
    }
    return img;
  };
  // The close-up's glass: a firmware frame cut to the pixels the window shows (its corners are
  // filleted in the CAD model).
  const glassMask = new Set(glassPx.map(([x, y]) => (x - faceLcd[0]) + ',' + (y - faceLcd[1])));
  const glassCache = new Map<number, Bitmap>();
  const lcdGlass = (frame: number) => {
    let b = glassCache.get(frame);
    if (!b) {
      const img = new ImageData(new Uint8ClampedArray(lcdImage(frame).data), 128, 64);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) if (!glassMask.has(x + ',' + y)) img.data[(y * 128 + x) * 4 + 3] = 0;
      const [c, cg] = bitmap(128, 64);
      cg.putImageData(img, 0, 0);
      b = c; glassCache.set(frame, b);
    }
    return b;
  };
  const tubeCache = new Map<string, Bitmap>();
  const tubeOf = (fill: number, withBand: boolean) => {
    const key = (fill > 0 ? 'f' : '') + (withBand ? 'b' : '');
    let b = tubeCache.get(key);
    if (!b) { b = P.tube(fill, withBand ? band : null); tubeCache.set(key, b); }
    return b;
  };

  // Slot geometry in the rack sprite: cap tops for the cursor, B3's rim for the drop.
  const slotTop: Record<string, [number, number]> = {};
  for (const [tag, cells] of Object.entries(rackTags)) {
    const top = Math.min(...cells.map(([, y]) => y));
    const xs = cells.filter(([, y]) => y <= top + 1).map(([x]) => x);
    slotTop[tag.replace('slot-1', '')] = [(Math.min(...xs) + Math.max(...xs)) / 2, top];
  }
  const b3 = rackTags['slot-1B3'] ?? [];
  const b3Rim = Math.max(...b3.map(([, y]) => y)) + 1;

  // The bag in any pose: its back half (thickness), then the front.
  const drawBag = (o: Pt, ax: Pt, ay: Pt, back: Pt) => {
    for (let d = bag.back.length; d >= 1; d--) drawAffine(g, bag.back[d - 1], [o[0] + back[0] * d, o[1] + back[1] * d], ax, ay);
    drawAffine(g, bag.art, o, ax, ay);
  };

  // The bench bag, opened at the zip by `open` (0..1): the front's zip side is drawn back to the
  // left and the back's bows out to the right, most at the middle (the sealed corners hold).
  const ZIP = P.BAG.zip, BW = P.BAG.w, BH = P.BAG.h, SQUEEZE = 12;   // film between the label and the zip
  const bow = (y: number, open: number, px: number) => R(open * px * Math.pow(Math.sin(Math.PI * y / (BH - 1)), .8));
  const pull = (y: number, open: number) => bow(y, open, 4);
  const bagOpenBack = (x: number, y: number, open: number) => {
    if (open <= 0) return;
    for (let j = 1; j < BH - 1; j++) {
      const d = pull(j, open), b = bow(j, open, 3);
      if (d <= 0 && b <= 0) continue;
      // the back's zip side, bowed out, in the shade inside the bag; darkest under the front's edge
      g.fillStyle = '#1d2422'; g.fillRect(x + ZIP + b, y + j, BW - ZIP, 1);
      g.fillStyle = '#303c39'; g.fillRect(x + ZIP + 2 + b, y + j, 1, 1); g.fillRect(x + ZIP + 5 + b, y + j, 1, 1);
      g.fillStyle = '#27312f'; g.fillRect(x + BW - 1 + b, y + j, 1, 1);
      g.fillStyle = C.ink; g.fillRect(x + BW - d - 1, y + j, Math.min(3, d + b + 1), 1);
    }
  };
  const bagOpenFront = (x: number, y: number, open: number) => {
    const art = bag.art, keep = ZIP - SQUEEZE;
    for (let j = 0; j < art.height; j++) {
      const d = j < BH ? pull(j, open) : 0;
      if (d <= 0) { g.drawImage(art, 0, j, art.width, 1, x, y + j, art.width, 1); continue; }
      g.drawImage(art, 0, j, keep, 1, x, y + j, keep, 1);
      g.drawImage(art, keep, j, SQUEEZE, 1, x + keep, y + j, SQUEEZE - d, 1);
      g.drawImage(art, ZIP, j, art.width - ZIP, 1, x + ZIP - d, y + j, art.width - ZIP, 1);
    }
  };

  let camX = 0;
  const draw = (b: Bitmap, x: number, y: number) => g.drawImage(b, R(x - camX), R(y));
  // The caption bar: black, under a divider; things on the desk stand on its line. The picture
  // above it is transparent.
  const bar = () => {
    g.fillStyle = C.canvas; g.fillRect(0, DESK, W, H - DESK);
    g.fillStyle = C.divider; g.fillRect(0, DESK, W, 1);
  };
  const caption = (t: number) => {
    const c = CAPTIONS.find(([a, b]) => t >= a && t < b);
    if (!c) return;
    const shown = R(seg(t, c[0], c[0] + c[2].length * 28) * c[2].length);
    text(g, 'bold', c[2].slice(0, shown), 12, 184, C.text);
  };

  // ---------- shots ----------
  // 1. The bag, label to the viewer; it turns to face the scanner, which is brought in and aims;
  //    light from the scan window, a decode flash and a beep; it turns its screen to the viewer.
  function shotScan(t: number) {
    camX = 0;
    // the bag turns
    const turn = easeInOut(seg(t, 1200, 2200));
    const pivot: Pt = [lerp(BAG_START[0], BAG_END[0], turn), lerp(BAG_START[1], BAG_END[1], turn)];
    const bm = bagMap(turn, pivot);
    // the scanner: carried in from the right while it turns to aim; held (a pixel of hand
    // shake); turned back to show its screen
    const inK = seg(t, 2300, 3700), outK = easeInOut(seg(t, 5300, 6300));
    let az = lerp(poses[0].az, aim.az, easeInOut(seg(t, 2500, 3700)));
    az = lerp(az, poses[0].az, outK);
    const pose = poseAt(az);
    const held = t > 3700 && t < 5300 ? R(Math.sin((t - 3700) / 340)) : 0;
    const sx = AIMED[0] + lerp(260, 0, easeOut(inK)) + outK * OUT_X;
    const sy = AIMED[1] + lerp(-36, 0, easeOut(inK)) - outK * 14 + held;
    // its shadow on the desk, under the hovering body
    if (inK > 0) {
      const foot = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as Pt[]).map(([a, b]) => {
        const p = project(poses[pose], [a * FOOT.x, b * FOOT.y, DESK_Z]);
        return [R(sx) + p[0], AIMED[1] + p[1]] as Pt;
      });
      g.save(); g.beginPath(); g.rect(0, 0, W, DESK); g.clip();
      fillPoly(g, foot, C.shadow, R(10 * clamp(inK * 2) * (1 - outK * .6)));
      g.restore();
    }
    drawBag(bm.o, bm.ax, bm.ay, bm.back);
    // light: a cone from the scan window onto the code, the code lit, the aiming line across it
    const dm = bag.dm, P = (i: number, j: number) => bm.at(i, j);
    const lit = t > 3850 && t < 4960;
    if (lit) {
      const win = ([[-1, WINDOW.z0], [1, WINDOW.z0], [1, WINDOW.z1], [-1, WINDOW.z1]] as Pt[])
        .map(([a, z]) => { const p = project(aim, [NOSE, a * WINDOW.y, z]); return [R(sx) + p[0], R(sy) + p[1]] as Pt; });
      const m = 5, spot = [P(dm.x - m, dm.y - m), P(dm.x + dm.size + m, dm.y - m), P(dm.x + dm.size + m, dm.y + dm.size + m), P(dm.x - m, dm.y + dm.size + m)];
      const k = seg(t, 3850, 4100);
      // the cone stops at the spot; in the spot the paper takes the light and the code stays sharp
      g.save(); g.beginPath(); g.rect(0, 0, W, H); spot.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.clip('evenodd');
      fillPoly(g, hull([...win, ...spot]), C.focus, R(k * 3));
      g.restore();
      if (k >= 1) { g.globalCompositeOperation = 'darken'; fillPoly(g, spot, C.focus); g.globalCompositeOperation = 'source-over'; }
      if (t > 4050) {
        const y = dm.y + dm.size / 2;
        line(g, P(dm.x - m - 4, y), P(dm.x + dm.size + m + 4, y), C.accent);
      }
    }
    // decoded: the code's modules flash, then brackets hold it
    if (t > 4800 && t < 4960 && Math.floor((t - 4800) / 80) % 2 === 0) {
      g.globalCompositeOperation = 'lighten';
      fillPoly(g, [P(dm.x, dm.y), P(dm.x + dm.size, dm.y), P(dm.x + dm.size, dm.y + dm.size), P(dm.x, dm.y + dm.size)], C.accent);
      g.globalCompositeOperation = 'source-over';
    }
    if (t > 4800 && t < 5800) {
      const a = 2, L = 5;
      ([[-a, -a, 1, 1], [dm.size + a, -a, -1, 1], [dm.size + a, dm.size + a, -1, -1], [-a, dm.size + a, 1, -1]] as number[][]).forEach(([i, j, si, sj]) => {
        line(g, P(dm.x + i, dm.y + j), P(dm.x + i + si * L, dm.y + j), C.accent);
        line(g, P(dm.x + i, dm.y + j), P(dm.x + i, dm.y + j + sj * L), C.accent);
      });
    }
    draw(scannerAt(pose, lcdFrameAt('intake', clamp(t - 2200, 0, 3800))), sx, sy);
    // beep: two rings off the scanner's screen
    for (const [a, b] of [[4850, 5250], [5000, 5400]]) {
      if (t <= a || t >= b) continue;
      const k = seg(t, a, b), r = R(10 + k * 16);
      const [cx, cy] = lcdCentre[pose];
      g.fillStyle = C.focus; g.globalAlpha = 1 - k;
      for (let i = 0; i < 24; i++) g.fillRect(R(sx + cx + Math.cos(i / 24 * 6.283) * r), R(sy + cy + Math.sin(i / 24 * 6.283) * r * .6), 1, 1);
      g.globalAlpha = 1;
    }
  }

  // 2. Close-up, square to the screen (the CAD model, az 90 / el 58): the firmware's intake
  //    recording 1:1. New part with the label's quantity; the camera tilts down to the keypad
  //    for the one key press, and back up for Sending → Done.
  function shotFace(u: number) {
    camX = 0;
    // the held New part screen is cut short by FACE_HOLD (nothing moves there)
    if (u > 8400) u += FACE_HOLD;
    const down = easeInOut(seg(u, 9000, 9600)), up = easeInOut(seg(u, 10500, 11100));
    const fx = R((W - face.width) / 2) + 44, fy = -R(lerp(16, lerp(40, 16, up), down));
    g.drawImage(face, fx, fy);
    // The recording: New part arrives at u 5800 and is held (cursor still blinking) while the
    // label link is shown; A at u 9900; the wait for the PC's answer is cut short.
    let rec = u < 6800 ? u - 1900 : u < 9100 ? 3950 + (u - 6800 + 950) % 1200 : u - 3900;
    if (rec > 7000) rec += 1800;
    g.drawImage(lcdGlass(lcdFrameAt('intake', clamp(rec, 0, 12000))), fx + faceLcd[0], fy + faceLcd[1]);
    // where the quantity came from: the bag label's QTY box, a dotted line to the screen, and
    // brackets on the field
    if (u > 6100 && u < 9400) {
      const reveal = seg(u, 6100, 6400) * (1 - seg(u, 9150, 9400)), qy = fy + faceLcd[1] + 44;
      const cx = 18, cy = qy - (QTY_BOX.y - QTY_CROP.y + QTY_BOX.h / 2);
      // the piece of label opens from its middle row, with the props' drop shadow
      const h = R(QTY_CROP.h * easeInOut(reveal)), top = R((QTY_CROP.h - h) / 2), y = R(cy);
      if (h > 0) {
        g.fillStyle = C.shadow; g.fillRect(cx + 1, y + top + 1, QTY_CROP.w, h);
        g.drawImage(bag.art, QTY_CROP.x, QTY_CROP.y + top, QTY_CROP.w, h, cx, y + top, QTY_CROP.w, h);
      }
      const from = cx + QTY_BOX.x - QTY_CROP.x + QTY_BOX.w + 2, to = fx + gx0 - 2;   // to the glass; the bracket marks the field
      const reach = R(lerp(from, to, easeInOut(seg(u, 6300, 6800)) * (1 - seg(u, 9000, 9200))));
      if (reach > from) { g.fillStyle = C.accent; g.fillRect(from, qy, reach - from, 1); }
    }
    if (u > 6700 && u < 9400 && (u > 7200 || Math.floor((u - 6700) / 150) % 2 === 0)) {
      const x0 = fx + faceLcd[0] + 75, y0 = fy + faceLcd[1] + 37, x1 = x0 + 25, y1 = y0 + 14, L = 4;
      for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x1, y1, -1, -1], [x0, y1, 1, -1]]) {
        line(g, [cx, cy], [cx + sx * L, cy], C.accent); line(g, [cx, cy], [cx, cy + sy * L], C.accent);
      }
    }
    // legends on the key tops; the pressed key sinks a pixel and lights up
    const pressed = u > 9900 && u < 10250 ? 'A' : null;
    for (const k of faceKeys) {
      const glyph = GLYPHS[k.key];
      if (!glyph) continue;
      const on = k.key === pressed ? 1 : 0;
      if (on) { g.fillStyle = '#121716'; g.fillRect(fx + k.x, fy + k.y, k.w, on); g.fillStyle = '#1d2422'; g.fillRect(fx + k.x, fy + k.y + on, k.w, k.h); }
      const ox = fx + k.x + Math.floor((k.w - (glyph[0].length * 2 - 0)) / 2), oy = fy + k.y + on + Math.floor((k.h - 10) / 2);
      g.fillStyle = on ? C.accent : C.secondary;
      glyph.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') g.fillRect(ox + i * 2, oy + j * 2, 2, 2); }));
    }
    // the press: a ring off the key
    if (u > 9900 && u < 10300) {
      const a = faceKeys.find(k => k.key === 'A');
      if (a) {
        const k = seg(u, 9900, 10300), r = R(14 + k * 12);
        g.fillStyle = C.focus; g.globalAlpha = 1 - k;
        for (let i = 0; i < 32; i++) g.fillRect(R(fx + a.x + a.w / 2 + Math.cos(i / 32 * 6.283) * r), R(fy + a.y + a.h / 2 + Math.sin(i / 32 * 6.283) * r * .8), 1, 1);
        g.globalAlpha = 1;
      }
    }
  }

  // ---------- 3. The PC: the record fills itself, one source at a time ----------
  // The form is on screen from the start with every field empty. The scanner's packet fills
  // what the label had; the PC asks the vendor, whose answer fills the part's parameters; the
  // rack slot comes last. Each group has its own colour and gutter mark.
  type Src = 'label' | 'vendor' | 'rack';
  const LINES: Array<[string, string, Src]> = [
    ['PART', P.PART.mpn, 'label'], ['QTY', P.PART.qty, 'label'],
    ['TYPE', 'CHIP RESISTOR', 'vendor'], ['VALUE', '10K OHM', 'vendor'], ['TOL', '1%', 'vendor'],
    ['POWER', '0.1W', 'vendor'], ['CASE', '0603', 'vendor'], ['MAKER', 'YAGEO', 'vendor'], ['DOCS', 'DATASHEET', 'vendor'],
    ['SLOT', P.PART.slot, 'rack'],
  ];
  /** Fields the user did not type: everything on the form. */
  const FILLED = LINES.length;
  const SRC: Record<Src, string> = { label: C.secondary, vendor: C.accent, rack: C.focus };
  // When each line starts typing (shot clock).
  const AT: number[] = [];
  { let label = 13500, vendor = 16200; LINES.forEach(([, , src], i) => { AT[i] = src === 'label' ? (label += i ? 450 : 0) : src === 'vendor' ? (vendor += 260) - 260 : 18300; }); }
  const PC_DONE = 18900;
  const lineY = (i: number) => 23 + i * 8 + (i >= 2 ? 4 : 0) + (i >= 9 ? 4 : 0);
  // Gutter marks: the label's code, the vendor's globe, the rack.
  const MARKS: Record<Src, string[]> = {
    label: ['#.###', '.#..#', '##.#.', '#.###', '#####'],
    vendor: ['.###.', '#.#.#', '#####', '#.#.#', '.###.'],
    rack: ['#####', '#.#.#', '#####', '#...#', '#...#'],
  };
  const mark = (src: Src, x: number, y: number, color: string) => {
    g.fillStyle = color;
    MARKS[src].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') g.fillRect(x + i, y + j, 1, 1); }));
  };
  const screen = (t: number, sx: number, sy: number) => {
    const s = P.SCREEN;
    const x0 = R(sx + s.x - camX) + 6, y0 = R(sy + s.y);
    // title row: the mark, the app, the record's state
    g.fillStyle = C.accent;
    [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]].forEach(([x, y]) => g.fillRect(x0 + x, y0 + 4 + y, 1, 1));
    g.fillRect(x0 + 4, y0 + 4, 1, 5);
    text(g, 'mono', 'INVENTATORY', x0 + 9, y0 + 10, C.text);
    const done = t > PC_DONE;
    const state = done ? 'IN STOCK' : 'NEW PART';
    const flash = done && t < PC_DONE + 500 && Math.floor((t - PC_DONE) / 100) % 2 === 0;
    text(g, 'mono', state, x0 + s.w - 14 - measure('mono', state), y0 + 10, done ? (flash ? C.text : C.focus) : C.muted);
    g.fillStyle = C.divider; g.fillRect(x0, y0 + 13, s.w - 12, 1);
    // groups: a gutter mark and bar in the source's colour once the group has arrived
    const groups: Array<[Src, number, number]> = [['label', 0, 1], ['vendor', 2, 8], ['rack', 9, 9]];
    for (const [src, a, b] of groups) {
      const on = t >= AT[a];
      mark(src, x0, y0 + lineY(a) - 6, on ? SRC[src] : C.divider);
      if (on && b > a) { g.fillStyle = SRC[src]; g.fillRect(x0 + 2, y0 + lineY(a) + 1, 1, Math.min(lineY(b), lineY(a) + (t - AT[a]) / 4) - lineY(a)); }
    }
    LINES.forEach(([k, v, src], i) => {
      const y = y0 + lineY(i), at = AT[i];
      const shown = R(seg(t, at, at + v.length * 28) * v.length);
      text(g, 'mono', k, x0 + 9, y, t >= at ? C.muted : C.divider);
      if (t < at) { g.fillStyle = C.divider; for (let d = 0; d < 9; d++) g.fillRect(x0 + 45 + d * 3, y - 1, 1, 1); return; }
      text(g, 'mono', v.slice(0, shown), x0 + 45, y, src === 'label' ? C.text : SRC[src]);
      if (shown < v.length && Math.floor(t / 100) % 2 === 0) { g.fillStyle = SRC[src]; g.fillRect(x0 + 45 + shown * 5, y - 6, 4, 7); }
    });
  };

  // Data moves on PCB traces: 2 px, 45° corners, a pad at each end. A trace is drawn out from
  // the side that starts the exchange; a pulse (a bright head and a fading tail) runs along it.
  const route = (a: Pt, b: Pt): Pt[] => {
    const dy = b[1] - a[1], dx = b[0] - a[0], mid = (a[0] + b[0]) / 2, h = Math.abs(dy) / 2 * Math.sign(dx);
    const pts: Pt[] = [];
    const run = (p: Pt, q: Pt) => {
      const n = Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1]));
      for (let i = pts.length ? 1 : 0; i <= n; i++) pts.push([R(p[0] + (q[0] - p[0]) * i / n), R(p[1] + (q[1] - p[1]) * i / n)]);
    };
    run(a, [R(mid - h), a[1]]); run([R(mid - h), a[1]], [R(mid + h), b[1]]); run([R(mid + h), b[1]], b);
    return pts;
  };
  const pad = (p: Pt, color: string) => {
    g.fillStyle = color; g.fillRect(p[0] - 2, p[1] - 2, 6, 6);
    g.clearRect(p[0], p[1], 2, 2);
  };
  const trace = (pts: Pt[], drawn: number, color: string) => {
    const n = R(drawn * (pts.length - 1));
    if (drawn <= 0) return;
    g.fillStyle = color;
    for (let i = 0; i <= n; i++) g.fillRect(pts[i][0], pts[i][1], 2, 2);
    pad(pts[0], color);
    if (drawn >= 1) pad(pts[pts.length - 1], color);
  };
  // a gentle ease, so the pulse is seen the whole way rather than waiting in the pads
  const PULSE = 18;
  const pulse = (pts: Pt[], k: number, head: string, body: string) => {
    if (k <= 0 || k >= 1) return;
    const i = R(k * k * (3 - 2 * k) * (pts.length + PULSE));
    for (let d = PULSE; d >= 0; d--) {
      const j = i - d;
      if (j < 0 || j >= pts.length) continue;
      g.fillStyle = d < 4 ? head : d < 10 ? body : C.active;
      g.fillRect(pts[j][0], pts[j][1], 2, 2);
    }
  };
  const small = fromCodes(art.scannerSmall as unknown as Tagged);
  const smallDone = (() => {
    const [c, cg] = bitmap(small.width, small.height);
    cg.drawImage(small, 0, 0); paintLcdCanvas(cg, (art.scannerSmall as unknown as Tagged).uv ?? [], lcdFrameAt('intake', 9500));
    return c;
  })();
  const vendorLit = P.vendor(C.bone);
  // The monitor is centred in the picture; the vendor sits above its middle and the scanner
  // below it by the same amount, either side, and both traces meet the monitor at its middle.
  const pcX = R((W - monitor.width) / 2), pcY = R((DESK - monitor.height) / 2);
  const midY = pcY + P.SCREEN.y + P.SCREEN.h / 2, OFF = 18, SPAN = 30;     // both traces alike
  const SMALL = { x: pcX - 5 - SPAN - 4 - small.width, y: R(midY + OFF - small.height / 2) };
  const VEN = { x: pcX + monitor.width + 3 + SPAN - 5, y: R(midY - OFF - 11) };
  const scanTrace = route([SMALL.x + small.width + 4, midY + OFF], [pcX - 5, midY]);
  const vendorTrace = route([pcX + monitor.width + 3, midY], [VEN.x + 5, midY - OFF]);
  const vendorBack = [...vendorTrace].reverse();

  function shotPc(t: number) {
    camX = 0;
    g.drawImage(smallDone, SMALL.x, SMALL.y);
    g.drawImage(monitor, pcX, pcY);
    g.drawImage(Math.floor(seg(t, 15000, 15400) * 4) % 2 === 1 ? vendorLit : vendor, VEN.x, VEN.y);
    screen(t, pcX, pcY);
    // the scan goes from the scanner to the PC
    trace(scanTrace, seg(t, 12100, 12400), t > 13400 ? C.divider : C.steel);
    pulse(scanTrace, seg(t, 12400, 13400), C.bone, C.secondary);
    // the PC asks the vendor; the vendor blinks; its answer comes back in three parts
    trace(vendorTrace, seg(t, 14300, 14600), t > 16300 ? C.divider : C.steel);
    pulse(vendorTrace, seg(t, 14400, 15000), C.text, C.muted);
    for (let i = 0; i < 3; i++) pulse(vendorBack, seg(t, 15300 + i * 220, 15900 + i * 220), C.focus, C.accent);
  }

  // 4. The bench. The cut tape comes out of the bag and is held over the open tube; then a
  //    macro shot (shotMacro): its cover tape peels back, it tips, and the chips slide out of
  //    their pockets into the tube. Back on the bench: cap on. The label is printed in the
  //    close-up (shotPrint), then put on here.
  const TL = P.tapeLength, FILL = 1;
  // The bench, in world pixels. Before the macro the frame holds the bag, the tube, the cap and
  // the printer; after it, it closes in on the tube and the printer.
  const BENCH = {
    bag: { x: 14, y: DESK - P.BAG.h },
    tube: { x: 238, y: DESK - P.TUBE_BODY.h },
    cap: { x: 272, y: DESK - 10 },
    printer: { x: 314, y: DESK - printer.height + 1 },
  };
  const CAM_B = R((BENCH.tube.x + BENCH.printer.x + printer.width) / 2 - W / 2);
  // the tape's right end: it slides out through the opened zip, then is lifted over the tube
  const tapeOut = BENCH.bag.y + 46;
  // ... and turned to hang straight down, its pockets over the mouth (as in the macro)
  const tapePose = (t: number): { end: Pt; a: number } => {
    const inside = BENCH.bag.x + P.BAG.zip, out = BENCH.bag.x + P.BAG.w + 3 + TL;
    const k = easeOut(seg(t, 20500, 21300)), l = easeInOut(seg(t, 21300, 22100));
    const slid: Pt = [lerp(inside, out, k), tapeOut];
    const hang: Pt = [BENCH.tube.x + 8 + 1, BENCH.tube.y - 8];
    // a few degrees off flat or upright only shows as a stray step at the end: snap those
    const deg = Math.min(90, Math.max(0, (l * 90 - 4) * 90 / 82));
    return { end: [lerp(slid[0], hang[0], l), lerp(slid[1], hang[1], l) - Math.sin(Math.PI * l) * 14], a: deg * Math.PI / 180 };
  };

  // The cut tape, turned whole (gfx.drawRotated); its shadow stays down and to the right.
  const benchTape = P.tape(0, 0, false), benchTapeShadow = (() => {
    const [c, cg] = bitmap(benchTape.width, benchTape.height);
    cg.drawImage(benchTape, 0, 0); cg.globalCompositeOperation = 'source-in'; cg.fillStyle = C.shadow; cg.fillRect(0, 0, c.width, c.height);
    return c;
  })();
  const drawTape = (centre: Pt, a: number) => {
    drawRotated(g, benchTapeShadow, centre[0] + 1, centre[1] + 1, a);
    drawRotated(g, benchTape, centre[0], centre[1], a);
  };

  function shotBench(t: number) {
    const before = t < MACRO[0];
    camX = before ? 0 : CAM_B;
    const { tube: T, printer: PR } = BENCH;
    const blink = t >= PRINT[1] && t < PRINT[1] + 400 && Math.floor(t / 100) % 2 === 0;
    draw(printer, PR.x, PR.y);
    if (blink) { g.fillStyle = C.focus; g.fillRect(R(PR.x + P.PRINTER_LED[0] - camX), PR.y + P.PRINTER_LED[1], 2, 1); }
    const labelled = t >= PRINT[1] + 1250;
    const lift = R(easeIn(seg(t, BENCH_END - 450, BENCH_END)) * 120);    // picked up, off to the rack
    draw(tubeOf(before ? 0 : FILL, labelled), T.x, T.y - lift);
    if (before) {
      // the bag, then slid away. Unzipped, its front pulls open at the zip: the front film and its
      // zip draw back to the left (the body squeezed up against them), showing the back's zip and
      // the dark inside; the tape comes out between them.
      const k = easeInOut(seg(t, 21450, 22000)), bx = R(BENCH.bag.x - k * 180), by = BENCH.bag.y;
      const open = easeOut(seg(t, 20100, 20500)) - .4 * easeInOut(seg(t, 21300, 21700));
      for (let d = bag.back.length; d >= 1; d--) g.drawImage(bag.back[d - 1], R(bx + .8 * d), R(by - .8 * d));
      bagOpenBack(bx, by, open);
      if (t > 20500) {
        const { end, a } = tapePose(t), ax: Pt = [Math.cos(a), Math.sin(a)];
        drawTape([end[0] - camX - TL / 2 * ax[0], end[1] - TL / 2 * ax[1]], a);
      }
      bagOpenFront(bx, by, open);
    }
    // the cap: picked up off the desk, carried over in an arc, lowered on, screwed down
    const carry = easeInOut(seg(t, CAP, CAP + 450)), lower = easeOut(seg(t, CAP + 450, CAP + 600));
    const twist = t > CAP + 600 && t < CAP + 850 ? (Math.floor(t / 60) % 2) : 0;
    const over: Pt = [T.x - 1, T.y - 16];
    const capX = lerp(BENCH.cap.x, over[0], carry) + twist;
    const capY = carry < 1 ? lerp(BENCH.cap.y, over[1], carry) - Math.sin(Math.PI * carry) * 22 : lerp(over[1], T.y - 7, lower);
    draw(cap, R(capX), R(capY) - (carry >= 1 ? lift : 0));
    // back from the printer: the label, at the desk's scale, goes onto the tube and wraps it
    if (t >= PRINT[1] && !labelled) {
      const k = easeInOut(seg(t, PRINT[1] + 350, PRINT[1] + 750));
      const x = lerp(PR.x - labelTiny.width + 2, T.x + 8 - labelTiny.width / 2, k);
      const y = lerp(PR.y + P.PRINTER_SLOT - labelTiny.height / 2, T.y + 14, k) - Math.sin(Math.PI * k) * 12;
      // wrapping: its sides turn away round the tube, evenly, down to the band it ends as
      const w = R(lerp(labelTiny.width, 14, easeInOut(seg(t, PRINT[1] + 750, PRINT[1] + 1250))));
      const b = w < labelTiny.width ? bandOf(w) : labelTiny;
      g.drawImage(b, R(x + Math.round((labelTiny.width - w) / 2) - camX), R(y));
    }
  }

  // Macro, about 7 px per mm. The tape hangs straight down over the tube's mouth, pockets to
  // the camera. Its cover is peeled from the bottom up, over the pockets in the picture only
  // and at a pace the eye can follow; as each pocket opens, its chip drops out and falls,
  // tumbling, into the tube, and on down out of sight: the tube is deep.
  const M = P.MACRO, ML = P.macroLength;
  const macroTape = P.macroTape(), macroCover = P.macroCover(), mchip = P.macroChip(), mchipFlat = rotate(mchip), mchipEdge = P.macroChipEdge();
  const TAPE_END: Pt = [200, 100];                                   // the tape's bottom end, its middle
  const macroAt = (i: number, j: number): Pt => [TAPE_END[0] - (j - M.h / 2), TAPE_END[1] - (ML - i)];
  const POCKET_X = macroAt(0, M.pocket)[0];
  const MOUTH = { x0: POCKET_X - 34, x1: POCKET_X + 34, y: 140 };
  // the peel stops above the top pocket in the picture, just inside its top edge
  const PEEL_TO = P.macroPocketX(M.pockets - 3) - 16, PEEL = [MACRO[0] + 400, MACRO[0] + 2200];
  const edgeAt = (t: number) => R(lerp(ML, PEEL_TO, seg(t, PEEL[0], PEEL[1])));
  const GRAVITY = .0021;                                            // px per ms²
  const mchips = Array.from({ length: M.pockets }, (_, i) => {
    const px = P.macroPocketX(i);
    // it drops once the peel has cleared its whole pocket (10 long); the pockets the peel
    // never reaches keep their chips
    const clear = (ML - (px - 5)) / (ML - PEEL_TO);
    const go = clear <= 1 ? PEEL[0] + (PEEL[1] - PEEL[0]) * clear + 40 : Infinity;
    const at = macroAt(px + .5, M.pocket);
    return { i, go, x: at[0] - 6, y: at[1] - 3.5, drift: ((i * 5) % 7 - 3) * .006, spin: 45 + (i * 13) % 30 };
  });
  const [mtape, mtg] = bitmap(ML, M.h);

  function shotMacro(t: number) {
    camX = 0;
    const cx = (MOUTH.x0 + MOUTH.x1) / 2, rx = (MOUTH.x1 - MOUTH.x0) / 2 + 3;
    const rim = (from: number, to: number, color: string) => {
      g.fillStyle = color;
      for (let a = from; a <= to; a += .02) g.fillRect(R(cx + Math.cos(a) * rx), R(MOUTH.y + Math.sin(a) * 4), 2, 1);
    };
    // the tube: its inside and far rim
    g.fillStyle = '#384543'; g.fillRect(MOUTH.x0, MOUTH.y, MOUTH.x1 - MOUTH.x0, H - MOUTH.y);
    rim(Math.PI, 2 * Math.PI, '#4a5754');
    // the tape: carrier, the chips still in it, the cover tape where it is not yet peeled
    const edge = edgeAt(t);
    mtg.clearRect(0, 0, ML, M.h);
    mtg.drawImage(macroTape, 0, 0);
    for (const c of mchips) if (t < c.go) mtg.drawImage(mchip, P.macroPocketX(c.i) - 3, M.pocket - 6);
    if (edge > 0) mtg.drawImage(macroCover, 0, 0, edge, M.h, 0, 0, edge, M.h);
    drawAffine(g, mtape, macroAt(0, 0), [0, 1], [-1, 0], true);
    // falling chips: straight down under gravity, a little drift, tumbling as they go
    for (const c of mchips) {
      if (t < c.go) continue;
      const d = t - c.go, y = c.y + .5 * GRAVITY * d * d;
      if (y > H) continue;
      const x = c.x + c.drift * d, turn = Math.floor(d / c.spin) % 4;
      const b = turn === 0 ? mchipFlat : turn === 2 ? mchip : mchipEdge;
      g.drawImage(b, R(x + (12 - b.width) / 2), R(y + (7 - b.height) / 2));
    }
    // the tube's walls and near rim, in front of whatever falls in
    for (const x of [MOUTH.x0 - 6, MOUTH.x1]) {
      g.fillStyle = '#384543'; g.fillRect(x, MOUTH.y, 6, H - MOUTH.y);
      g.fillStyle = '#5d6865'; g.fillRect(x + 1, MOUTH.y + 2, 1, H - MOUTH.y);
    }
    rim(0, Math.PI, '#8c9690');
    // the peeled cover tape: clear film, folded back at the peel line and pulled away to the
    // right; only as long as what has been peeled, its free end the strip's end of the cover
    const peeled = ML - edge;
    if (peeled > 0) {
      const a = macroAt(edge, (M.cover[0] + M.cover[1]) / 2), b: Pt = [a[0] + 200, a[1] + 70], c: Pt = [a[0] + 2, a[1] + 34];
      const half = (M.cover[1] - M.cover[0]) / 2;
      const path: Pt[] = [];
      let run = 0;
      for (let k = 0; k <= 1.001; k += .01) {
        const p: Pt = [(1 - k) * (1 - k) * a[0] + 2 * (1 - k) * k * c[0] + k * k * b[0], (1 - k) * (1 - k) * a[1] + 2 * (1 - k) * k * c[1] + k * k * b[1]];
        if (path.length) {
          const q = path[path.length - 1], step = Math.hypot(p[0] - q[0], p[1] - q[1]);
          if (run + step > peeled) { const f = (peeled - run) / step; path.push([q[0] + (p[0] - q[0]) * f, q[1] + (p[1] - q[1]) * f]); break; }
          run += step;
        }
        path.push(p);
      }
      if (path.length > 1) {
        const left: Pt[] = [], right: Pt[] = [];
        // its edges either side of the path, square to it, so the free end is cut square
        path.forEach((p, i) => {
          const q = path[Math.min(i + 1, path.length - 1)], o = path[Math.max(i - 1, 0)];
          const dx = q[0] - o[0], dy = q[1] - o[1], d = Math.hypot(dx, dy) || 1;
          const w = half * (1 - .3 * run / 230 * i / (path.length - 1)), nx = -dy / d * w, ny = dx / d * w;
          left.push([R(p[0] - nx), R(p[1] - ny)]); right.push([R(p[0] + nx), R(p[1] + ny)]);
        });
        // clear film: a faint even tint, crisp edges, the fold at the peel line and the free end
        g.globalAlpha = .08; fillPoly(g, [...left, ...[...right].reverse()], C.bone); g.globalAlpha = 1;
        for (let k = 1; k < left.length; k++) { line(g, left[k - 1], left[k], C.bone); line(g, right[k - 1], right[k], C.paper2); }
        line(g, left[0], right[0], C.bone);
        line(g, left[left.length - 1], right[right.length - 1], C.bone);
      }
    }
  }

  // 5. Close-up on the printer, from above and in front: the label comes out over the base's
  //    face on its liner as it prints. The liner is bent down just behind the label's front
  //    edge, so the stiffer label stands off it; then it is lifted and carried off.
  const PA = P.PRINTER_ANGLED, paX = R((W - PA.w) / 2), paY = -6, slotY = paY + PA.slot + 2;
  const LINER_W = labelBig.width + 12, LEAD = 6, FEED = LEAD + labelBig.height + 4, TIP = 20;
  function shotPrint(t: number) {
    camX = 0;
    const p0 = PRINT[0];
    const out = R(seg(t, p0 + 300, p0 + 1700) * FEED);
    const bend = easeInOut(seg(t, p0 + 1850, p0 + 2250));
    const lift = easeInOut(seg(t, p0 + 2350, p0 + 2800)), away = easeIn(seg(t, p0 + 3050, p0 + 3300));
    g.drawImage(printerAngled, paX, paY);
    const printing = t > p0 + 300 && t < p0 + 1700;
    g.fillStyle = printing && Math.floor(t / 150) % 2 === 0 ? C.focus : printing ? C.accent : C.active;
    g.fillRect(paX + PA.led[0], paY + PA.led[1], 6, 2);
    if (out <= 0) return;
    const lx = R(W / 2 - LINER_W / 2), lbx = R(W / 2 - labelBig.width / 2);
    const end = slotY + out, front = end - LEAD, top = front - labelBig.height, fold = front - TIP;
    g.save(); g.beginPath(); g.rect(0, slotY, W, H); g.clip();
    // the liner: flat up to the fold; beyond it bent down (an upright face: shorter, darker)
    const flatTo = bend > 0 ? fold : end;
    g.fillStyle = P.LINER; g.fillRect(lx, slotY, LINER_W, flatTo - slotY);
    g.fillStyle = '#b9b79a'; g.fillRect(lx, slotY, 1, flatTo - slotY); g.fillRect(lx + LINER_W - 1, slotY, 1, flatTo - slotY);
    if (bend > 0) {
      const h = R((end - fold) * lerp(1, .55, bend));
      g.fillStyle = bend < .5 ? '#c3c1a2' : '#a3a189'; g.fillRect(lx, fold, LINER_W, h);
      g.fillStyle = '#7f7e6a'; g.fillRect(lx, fold + h - 1, LINER_W, 1);
    }
    // the label, still on the liner; once the liner bends its front stands off it
    if (lift === 0) {
      // the free front stands off the bent liner: its edge shows, and it casts a shadow
      if (bend > 0) {
        g.fillStyle = C.shadow; g.fillRect(lbx + 3, fold + 3, labelBig.width - 4, TIP + R(bend * 2));
        g.fillStyle = C.paper2; g.fillRect(lbx + 5, front, labelBig.width - 10, R(bend * 2));
      }
      g.drawImage(labelBig, lbx, top);
    } else {
      // lifted: its shadow stays on the liner below it
      g.fillStyle = C.shadow; g.globalAlpha = .7;
      g.drawImage(labelShadow, lbx + 2, top + 2);
      g.globalAlpha = 1;
    }
    g.restore();
    if (lift > 0) g.drawImage(labelBig, R(lbx - away * 260), R(top - lift * 12 - away * 30));
  }

  // 6. The rack, R1. The cursor checks the slots in the app's fill order (A1..A5, B1..) and
  //    stops on the first free one; the tube comes down into it. Then the end card.
  const ORDER = ['A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'B2', 'B3'];
  const WALK = 28600, STEP = 180, AT_B3 = WALK + (ORDER.length - 1) * STEP, DROP = [30500, 31200], SETTLE = 120;
  // The camera centres the rack and the slot's name beside it, as one group.
  const TAG_X = 22, CAM_RACK = R(RACK.x + Math.max(rackFull.width, (slotTop['B3']?.[0] ?? 60) + TAG_X + measure('bold', P.PART.slot) + 6) / 2 - W / 2);
  // each slot's ring: the outline of its cap, as the full rack draws it
  const rings: Record<string, number[][]> = {};
  for (const [tag, cells] of Object.entries(rackTags)) {
    const set = new Set(cells.map(([x, y]) => x + ',' + y));
    rings[tag.replace('slot-1', '')] = cells.filter(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !set.has((x + dx) + ',' + (y + dy))));
  }
  const ring = (slot: string, color: string) => {
    g.fillStyle = color;
    for (const [x, y] of rings[slot] ?? []) g.fillRect(R(RACK.x + x - camX), R(RACK.y + y), 1, 1);
  };
  // 2x pixel numerals for the end card, the way the lockup's letters are drawn on a 2x grid
  const numeral = (str: string, x: number, baseline: number, color: string) => {
    const w = measure('big', str) + 2, [c, cg] = bitmap(w, 20);
    text(cg, 'big', str, 0, 15, color);
    g.drawImage(c, 0, 0, w, 20, x, baseline - 30, w * 2, 40);
    return w * 2;
  };

  // The cursor is the lockup's prompt mark: five squares, here turned to point down.
  const PROMPT: Pt[] = [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]];
  // the mark's › as five squares of size `size`, turned by `turn` (0 = ›, 1 = pointing down)
  const chevron = (cx: number, cy: number, size: number, turn: number, color: string | string[]) => {
    const a = turn * Math.PI / 2;
    g.fillStyle = typeof color === 'string' ? color : '';
    for (const [i, [px, py]] of PROMPT.entries()) {
      if (typeof color !== 'string') g.fillStyle = color[i];
      const dx = px - 1, dy = py - 2;                                // about the middle of the mark
      const x = dx * Math.cos(a) - dy * Math.sin(a), y = dx * Math.sin(a) + dy * Math.cos(a);
      g.fillRect(R(cx + x * size - size / 2), R(cy + y * size - size / 2), size, size);
    }
  };

  // Where the cursor is (rack clock): hopping slot to slot in fill order, bobbing on the free
  // one, stepping aside while the tube comes down, then back over its cap until the sign-off.
  const CURSOR = 3, ASIDE = -18;
  const cursorAt = (t: number): Pt | null => {
    if (t <= WALK) return null;
    const step = Math.min(ORDER.length - 1, Math.floor((t - WALK) / STEP));
    const [cx, cy] = slotTop[ORDER[step]] ?? [0, 0];
    const bob = ORDER[step] === 'B3' ? Math.floor((t - AT_B3) / 250) % 2 : 0;
    const aside = ASIDE * (easeInOut(seg(t, DROP[0] - 300, DROP[0])) - easeInOut(seg(t, DROP[1] + 100, DROP[1] + 400)));
    return [R(RACK.x + cx + aside - camX), R(RACK.y + cy - 11 + (t < DROP[0] ? bob : 0))];
  };
  const cursor = (p: Pt, size = CURSOR, turn = 1) => {
    chevron(p[0] + 1, p[1] + 1, size, turn, C.shadow);
    chevron(p[0], p[1], size, turn, C.accent);
  };

  function shotRack(t: number, withCursor = true) {
    camX = CAM_RACK;
    const placed = t >= DROP[1] + SETTLE;
    draw(placed ? rackFull : rackEmpty, RACK.x, RACK.y);
    const [bx, by] = slotTop['B3'] ?? [60, 40];
    // the walk: a ring on each taken slot as the cursor passes it, then the free one
    const step = Math.min(ORDER.length - 1, Math.floor((t - WALK) / STEP));
    if (t > WALK && t < DROP[1]) ring(ORDER[step], C.accent);
    // the tube comes down into B3 and settles
    if (t > DROP[0] - 300 && !placed) {
      // lowered in, slowing as it meets the slot; it sinks the last pixel as it seats
      const k = easeInOut(seg(t, DROP[0], DROP[1])), seat = t >= DROP[1] ? 1 : 0;
      g.save(); g.beginPath(); g.rect(0, 0, W, RACK.y + b3Rim); g.clip();
      g.drawImage(rackTube, R(RACK.x - camX), R(RACK.y - lerp(RACK.y + by + 10, 1, k)) + seat);
      g.restore();
    }
    if (placed && t < DROP[1] + SETTLE + 500 && Math.floor((t - DROP[1] - SETTLE) / 120) % 2 === 0) ring('B3', C.focus);
    // the slot's name, pinned beside it on a leader
    if (t > AT_B3 && t < SIGN + 450) {
      const tx = R(RACK.x + bx + TAG_X - camX), ty = R(RACK.y + by - 14);
      g.fillStyle = C.focus;
      for (let x = R(RACK.x + bx + 6 - camX); x < tx; x += 2) g.fillRect(x, ty + 6, 1, 1);
      const w = measure('bold', P.PART.slot) + 6;
      g.fillStyle = C.shadow; g.fillRect(tx + 1, ty + 1, w, 12);
      g.fillStyle = C.focus; g.fillRect(tx, ty, w, 12);
      text(g, 'bold', P.PART.slot, tx + 3, ty + 10, C.ink);
    }
    if (withCursor) { const p = cursorAt(t); if (p) cursor(p); }
  }


  // ---------- 7. Sign-off: the ›iNVENTATORY lockup, put together from the film ----------
  // Straight after the drop the camera tilts up off the rack; the B3 cursor stays with it, turns
  // back into the prompt and grows to the lockup's pixel, taking the lockup's colours, in the
  // middle of the picture. The i's stem drops in beside it like the tube, and the word is typed
  // with the caret, as in the site's hero (no dot over the i here); the line keeps itself
  // centred as it grows, so the › leads it into place. Then the lockup moves up and what it
  // took counts in.
  const LK = getLockup('teal'), UNIT = 3 / CELL_W;                 // a character cell is 3 px wide
  const LW = R(LK.width * UNIT), LX = R((W - LW) / 2), LY = 46;
  const PX = R(CELL_H * UNIT);                                       // one letter pixel: 6 px
  const SH: Pt = [R(shadowOffset.x * UNIT), R(shadowOffset.y * UNIT)];
  const cells = LK.rects.map(r => ({ ...r, x: LX + R(r.x * UNIT), y: LY + R(r.y * UNIT), w: Math.max(1, R(r.width * UNIT)), h: Math.max(1, R(r.height * UNIT)) }));
  const letterAt = (k: number) => SIGN + 1450 + k * 105 + (k === 4 ? 90 : 0) + ((k * 37) % 5) * 12;
  const letterLeft = (k: number) => Math.min(...cells.filter(c => c.letter === k).map(c => c.x));
  // timings (sign clock): the tilt, the cursor's flight, the stem's fall and landing
  const TILT = [0, 800], FLY = [100, 900], FALL = [700, 1100], LAND = FALL[1];
  // The line's right edge as each part arrives (the prompt, the stem, the ten letters), and its
  // shift: half of what is still to come, so the typed part stays centred. Each arrival glides.
  const rightOf = (pick: (c: typeof cells[number]) => boolean) => Math.max(...cells.filter(pick).map(c => c.x + c.w));
  const RIGHTS = [rightOf(c => c.part === 'prompt'), rightOf(c => c.part === 'stem'), ...Array.from({ length: 10 }, (_, k) => rightOf(c => c.letter === k))];
  const GLIDE = 260;
  const shiftAt = (t: number) => {
    const arrivals = [SIGN + LAND, ...Array.from({ length: 10 }, (_, k) => letterAt(k))];
    let right = RIGHTS[0];
    arrivals.forEach((at, i) => { right += easeOut(seg(t, at, at + GLIDE)) * (RIGHTS[i + 1] - RIGHTS[i]); });
    return R((RIGHTS[RIGHTS.length - 1] - right) / 2);
  };
  // the prompt's five squares (in the mark's order), for the cursor to take on
  const PROMPT_LOOK = PROMPT.map((_, i) => cells.find(c => c.part === 'prompt' && c.order === i)!);
  const mixHex = (a: string, b: string, k: number) => '#' + [1, 3, 5].map(i => R(lerp(parseInt(a.slice(i, i + 2), 16), parseInt(b.slice(i, i + 2), 16), k)).toString(16).padStart(2, '0')).join('');
  const CARET = { y: LY + (4 - TOP_ROW) * PX, w: 3 * PX, end: LX + LW + PX };
  const TAGLINE = hero.title.join(' ');
  const TAG_Y = LY + 7 * PX + 26, LIFT = Math.min(...cells.map(c => c.y)) - 14;
  function shotSign(t: number) {
    const L = t - SIGN;
    camX = CAM_RACK;
    // the camera tilts up off the rack, all but the cursor that found the slot
    if (L < TILT[1]) {
      g.save(); g.translate(0, R(easeInOut(seg(L, TILT[0], TILT[1])) * (DESK + 10)));
      shotRack(SIGN + 399, false);
      g.restore();
    }
    const prompt = cells.filter(c => c.part === 'prompt');
    const px0 = Math.min(...prompt.map(c => c.x)), py0 = Math.min(...prompt.map(c => c.y));
    const home: Pt = [px0 + PX * 1.5, py0 + PX * 2.5];              // the prompt's middle, where the flight ends
    const shade = (c: typeof cells[number], dx = 0, dy = 0) => {
      g.fillStyle = c.shadow; g.fillRect(c.x + SH[0] + dx, c.y + SH[1] + dy, c.w, c.h);
    };
    // after it is complete, the lockup (and its line) moves up to make room for the numbers
    const up = R(easeInOut(seg(t, RESULT, RESULT + 600)) * LIFT), shift = shiftAt(t);
    g.save(); g.translate(shift, -up);
    // 1. the cursor's flight: from above B3 to the middle, turning back into ›, growing in
    //    whole-pixel steps and taking on the lockup's colours and shadow
    if (L < FLY[1]) {
      const from = cursorAt(SIGN + 399) ?? home;
      const k = easeInOut(seg(L, FLY[0], FLY[1]));
      const size = Math.max(CURSOR, R(lerp(CURSOR, PX, k)));
      const x = lerp(from[0] - shift, home[0], k), y = lerp(from[1], home[1], k) - Math.sin(k * Math.PI) * 12;
      const sx = R(lerp(1, SH[0], k)), sy = R(lerp(1, SH[1], k));
      // it turns early and quickly, while still small (half way it is an L), then grows as ›
      const turn = 1 - easeInOut(seg(L, FLY[0], FLY[0] + 300));
      chevron(x + sx, y + sy, size, turn, PROMPT_LOOK.map(c => mixHex(C.shadow, c.shadow, k)));
      chevron(x, y, size, turn, PROMPT_LOOK.map(c => mixHex(C.accent, c.fill, k)));
    } else {
      for (const c of prompt) shade(c);
      for (const c of prompt) { g.fillStyle = c.fill; g.fillRect(c.x, c.y, c.w, c.h); }
    }
    // 2. the i drops in like the tube, and settles with a bounce and a puff
    if (L > FALL[0]) {
      const fall = easeIn(seg(L, FALL[0], FALL[1])), bounce = L > LAND && L < LAND + 150 ? -R(Math.sin(seg(L, LAND, LAND + 150) * Math.PI) * 4) : 0;
      const dy = R(lerp(-90, 0, fall)) + bounce;
      const stem = cells.filter(c => c.part === 'stem');
      for (const c of stem) shade(c, 0, dy);
      for (const c of stem) { g.fillStyle = c.fill; g.fillRect(c.x, c.y + dy, c.w, c.h); }
      if (L > LAND && L < LAND + 350) {
        const k = seg(L, LAND, LAND + 350), base = Math.max(...stem.map(c => c.y + c.h)), sx = Math.min(...stem.map(c => c.x)), sw = 2 * 3 * 2;
        g.fillStyle = C.muted; g.globalAlpha = 1 - k;
        for (const d of [1, 2, 3]) { g.fillRect(R(sx - 2 - k * 8 * d / 2), base - 1 - d, 1, 1); g.fillRect(R(sx + sw + 1 + k * 8 * d / 2), base - 1 - d, 1, 1); }
        g.globalAlpha = 1;
      }
    }
    // 4. the word, typed: each letter lands bright, then takes its colour
    const word = cells.filter(c => c.part === 'word');
    for (const c of word) { if (t >= letterAt(c.letter)) shade(c); }
    for (const c of word) {
      const at = letterAt(c.letter);
      if (t < at) continue;
      g.fillStyle = t < at + 160 ? C.bone : c.fill; g.fillRect(c.x, c.y, c.w, c.h);
    }
    // the caret: after the stem, then after each letter; solid while typing, then blinking
    if (L > LAND + 50) {
      let x = letterLeft(0);
      for (let k = 0; k < 10; k++) if (t >= letterAt(k)) x = k < 9 ? letterLeft(k + 1) : CARET.end;
      const typing = t < letterAt(9) + 500;
      if (typing || Math.floor((t - letterAt(9)) / 530) % 2 === 1) { g.fillStyle = C.focus; g.fillRect(x, CARET.y, CARET.w, PX); }
    }
    g.restore();
    // 5. the line underneath
    if (L > 3200) {
      const shown = R(seg(L, 3200, 3200 + TAGLINE.length * 22) * TAGLINE.length);
      text(g, 'sans', TAGLINE.slice(0, shown), R((W - measure('sans', TAGLINE)) / 2), TAG_Y - up, C.muted);
    }
    // 6. what it took, under the lockup: each number counts up, its words typed beneath it
    const rows: Array<[number, string, string]> = [[1, 'key pressed', C.text], [FILLED, 'fields filled in', C.text], [0, 'typed by hand', C.accent]];
    rows.forEach(([n, label, color], i) => {
      const at = RESULT + 650 + i * 350;
      if (t < at) return;
      const shown = n ? Math.max(1, Math.min(n, Math.ceil(seg(t, at, at + 400) * n))) : 0;
      const cx = W / 2 + (i - 1) * 112, base = TAG_Y - LIFT + 44;
      numeral(String(shown), R(cx - (measure('big', String(n)) + 2)), base, color);
      const typed = R(seg(t, at + 150, at + 150 + label.length * 30) * label.length);
      text(g, 'bold', label.slice(0, typed), R(cx - measure('bold', label) / 2), base + 16, C.muted);
    });
  }

  function render(time: number) {
    const t = ((time % LOOP) + LOOP) % LOOP;
    g.clearRect(0, 0, W, H);
    const u = t - LATER_SHIFT;
    if (t < SCAN_END) shotScan(t);
    else if (t < FACE_END) shotFace(t - FACE_SHIFT);
    else if (u < 20000) shotPc(u);
    else if (u >= MACRO[0] && u < MACRO[1]) shotMacro(u);
    else if (u >= PRINT[0] && u < PRINT[1]) shotPrint(u);
    else if (u < BENCH_END) shotBench(u);
    else if (u - BENCH_EXTRA < SIGN) shotRack(u - BENCH_EXTRA);
    else if (u - BENCH_EXTRA < SIGN_END) shotSign(u - BENCH_EXTRA);
    // dissolves between shots, and into and out of the loop
    const cuts: Array<[number, number, number]> = [[0, 500, -1], [SCAN_END - 400, SCAN_END, 1], [SCAN_END, SCAN_END + 300, -1],
      [FACE_END - 300, FACE_END, 1], [FACE_END, FACE_END + 300, -1],
      ...([[19600, 20000, 1], [20000, 20300, -1], [MACRO[0] - 300, MACRO[0], 1], [MACRO[0], MACRO[0] + 300, -1], [MACRO[1] - 300, MACRO[1], 1], [MACRO[1], MACRO[1] + 300, -1],
        [PRINT[0] - 300, PRINT[0], 1], [PRINT[0], PRINT[0] + 300, -1],
        [PRINT[1] - 300, PRINT[1], 1], [PRINT[1], PRINT[1] + 300, -1], [BENCH_END - 300, BENCH_END, 1], [BENCH_END, BENCH_END + 300, -1], [SIGN_END - 600 + BENCH_EXTRA, SIGN_END + BENCH_EXTRA, 1]] as Array<[number, number, number]>)
        .map(([a, b, d]): [number, number, number] => [later(a), later(b), d])];
    for (const [a, b, dir] of cuts) if (t >= a && t < b) dither(g, dir > 0 ? seg(t, a, b) : 1 - seg(t, a, b), DESK);
    bar();
    caption(t);
  }

  return { render };
}
