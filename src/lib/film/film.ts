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
import { bitmap, fromCodes, text, measure, dither, fillPoly, hull, line, drawAffine, C, type Bitmap } from './gfx';
import * as P from './props';
import { getLockup, shadowOffset, CELL_W, CELL_H, TOP_ROW } from '../lockup';
import { hero } from '../../data/home';
import { say, SAY_X, SAY_BASE, SAY_FONT } from './say';

// The picture ends at the desk: the canvas is cut there, and the page's scrubber runs under it.
const DESK = 166;
export const W = 384, H = DESK;
// Each shot keeps its own clock. The scan runs on t; the close-up on t - FACE_SHIFT; the
// shots after it on t - LATER_SHIFT.
// The close-up's clock starts at 4800 and the later shots' at 11900, so trimming one shot
// moves everything after it.
const SCAN_END = 6400, FACE_SHIFT = SCAN_END - 4800, FACE_HOLD = 600, FACE_END = FACE_SHIFT + 12400 - FACE_HOLD, LATER_SHIFT = FACE_END - 11900;
const later = (u: number) => u + LATER_SHIFT;
/** The later shots' clock at film time t. */
const unlater = (t: number) => t - LATER_SHIFT;
// The bench (u 20000..BENCH_END) is one take; each beat is timed from the one before, and the
// rack runs on u - BENCH_EXTRA.
const OPEN = [20300, 20700], PULL = [20700, 21700], AWAY = [21100, 22700], HOIST = [21800, 22700];
const ZIN = [HOIST[1] + 200, HOIST[1] + 1400], PEEL = [ZIN[1] + 300, ZIN[1] + 2100];   // in to the macro
const TOSS = [PEEL[1] + 800, PEEL[1] + 2500], ZOUT = [TOSS[0] + 250, TOSS[0] + 1350];  // tape away, out
const CAPON = [ZOUT[1] - 150, ZOUT[1] + 1000];
const PAN = [CAPON[1] + 150, CAPON[1] + 1050], FEED = [PAN[1] - 200, PAN[1] + 1200];  // to the printer
const UNPEEL = [FEED[1] + 400, FEED[1] + 1900], PICK = [UNPEEL[1], UNPEEL[1] + 1150];   // peeled by a corner; lifted, turned over
const BACK = [PICK[1] + 1900, PICK[1] + 2900], WRAP = [BACK[1] + 50, BACK[1] + 550];  // read, then on
const BENCH_END = WRAP[1] + 1100, BENCH_EXTRA = BENCH_END - 28200;
// The rack (its own clock, from 28200): the cursor walks the slots in fill order to the free
// one, its name is pinned; the cursor sinks into it, the tube comes and is lowered in.
const ORDER = ['A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'B2', 'B3'];
const WALK = 28700, STEP = 240, HOP = 150, AT_B3 = WALK + (ORDER.length - 1) * STEP;
const TAG_AT = AT_B3 + HOP, SINK = [AT_B3 + 1200, AT_B3 + 1450];
const COME = [SINK[0] + 100, SINK[0] + 800], HOVER = 160, LOWER = [COME[1] + HOVER, COME[1] + HOVER + 650];
const SEATED = LOWER[1] + 70, RISE = [SEATED + 350, SEATED + 600];
// After the end card (rack clock), the sign-off: the lockup assembles from the film's motifs.
// The lockup first, then what it took (RESULT: the lockup moves up, the numbers come in).
const SIGN = RISE[1] + 1100, RESULT = SIGN + 5000, SIGN_END = SIGN + 9600, PAUSE = 1000;   // then a blank second
export const LOOP = later(SIGN_END + BENCH_EXTRA) + PAUSE;
// In the reel the sign-off comes at the end of the finale (finale.ts); here, from SIGN, comes the
// question instead: the slot's tag closes, the camera tilts up off the rack, and the cursor that
// found the slot flies to the middle, turns into the prompt and types the question the finale
// answers. The reel dissolves from it into the finale.
const TAG_CLOSE = [120, 300], ASK_TILT = [450, 1250], ASK_FLY = [550, 1350], ASK_TYPE = 1650, DESK_LEN = 5400;
export const QUESTION = 'But why is this useful?';
/** Where the reel leaves this film, for the finale. */
export const CUT = later(SIGN + DESK_LEN + BENCH_EXTRA);
/** The frame to show still (reduced motion): the finished lockup. */
export const POSTER = later(SIGN_END + BENCH_EXTRA) - 900;
/** Chapter starts, for the scrubber. */
export const CHAPTERS = [0, SCAN_END, FACE_END, ...[20000, PAN[0], BENCH_END, SIGN + BENCH_EXTRA, RESULT + BENCH_EXTRA].map(later)];
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
  const screenG = canvas.getContext('2d')!;
  screenG.imageSmoothingEnabled = false;
  // what the shots draw on: the canvas, or (for the bench take) the buffer it is scaled from
  let g = screenG;

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
  const labelTiny = P.labelTiny();
  const band = P.tubeBand();
  const bands = new Map<number, Bitmap>();
  const bandOf = (w: number) => { let b = bands.get(w); if (!b) { b = P.tubeBand(w); bands.set(w, b); } return b; };
  const monitor = P.monitor();
  const vendor = P.vendor();
  // The bag label's QTY box, which the close-up marks (P.bag layout).
  const BL = P.BAG.label;
  const QTY_BOX = { x: BL.x + 70, y: BL.y + 40, w: 31, h: 23 };
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
    const w = u;
    if (u > 8400) u += FACE_HOLD;
    const down = easeInOut(seg(u, 9000, 9600)), up = easeInOut(seg(u, 10500, 11100));
    const fx = R((W - face.width) / 2) + 44, fy = -R(lerp(16, lerp(40, 16, up), down));
    g.drawImage(face, fx, fy);
    // The recording: New part arrives at u 5800 and is held (cursor still blinking) while the
    // label link is shown; A at u 9900; the wait for the PC's answer is cut short.
    let rec = u < 6800 ? u - 1900 : u < 9100 ? 3950 + (u - 6800 + 950) % 1200 : u - 3900;
    if (rec > 7000) rec += 1800;
    g.drawImage(lcdGlass(lcdFrameAt('intake', clamp(rec, 0, 12000))), fx + faceLcd[0], fy + faceLcd[1]);
    // Where the quantity came from (w: the clock before the held screen is cut). The bag slides
    // in beside the screen, the scanner's brackets close on the label's QTY box (the one thing
    // read from it), a line runs from it to the field, and the value types itself in.
    const qy = fy + faceLcd[1] + 44, gl = fx + gx0 - 2;
    const fx0 = fx + faceLcd[0] + 75, fy0 = fy + faceLcd[1] + 37;       // the field's corner on the glass
    const typed = R(seg(w, 7550, 8000) * 3);
    if (typed < 3) {                                                    // the field is empty until the value lands
      g.fillStyle = '#a9b6a4'; g.fillRect(fx0 + 2 + typed * 7, fy0 - 1, 31 - typed * 7, 16);
    }
    const slide = easeOut(seg(w, 6100, 6600)) * (1 - easeIn(seg(w, 8100, 8350)));
    if (slide > 0) {
      const bx0 = R(lerp(-bag.art.width, -9, slide)), by0 = R(qy - (BL.y + 40 + QTY_BOX.h / 2));
      g.drawImage(bag.art, bx0, by0);
      const bx = bx0 + BL.x + 70, by = by0 + BL.y + 40;                 // the QTY box on the label
      if (w > 6700 && w < 8100) {
        // decode: the box flashes twice, then brackets hold it, like the code in the first shot
        if (w < 7000 && Math.floor((w - 6700) / 80) % 2 === 0) {
          g.globalCompositeOperation = 'lighten'; g.fillStyle = C.accent; g.fillRect(bx, by, QTY_BOX.w, QTY_BOX.h); g.globalCompositeOperation = 'source-over';
        }
        const a = 2, L = 5, x1 = bx + QTY_BOX.w - 1, y1 = by + QTY_BOX.h - 1;
        for (const [px, py, sx, sy] of [[bx - a, by - a, 1, 1], [x1 + a, by - a, -1, 1], [x1 + a, y1 + a, -1, -1], [bx - a, y1 + a, 1, -1]]) {
          line(g, [px, py], [px + sx * L, py], C.accent); line(g, [px, py], [px, py + sy * L], C.accent);
        }
      }
      // the line from the box to the screen's edge, drawn out and drawn back
      const from = bx + QTY_BOX.w + 4, run = easeInOut(seg(w, 7000, 7550)) * (1 - seg(w, 8100, 8350));
      if (gl > from && run > 0) { g.fillStyle = C.accent; g.fillRect(from, qy, R((gl - from) * run), 1); }
    }
    // the field's brackets, once the value is in
    if (w > 7550 && w < 8350 && (w > 7750 || Math.floor((w - 7550) / 150) % 2 === 0)) {
      const x0 = fx0, y0 = fy0, x1 = x0 + 25, y1 = y0 + 14, L = 4;
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

  // 4. The bench: one take, no cuts. The bag alone; the cut tape is pulled out of it, the bag
  //    going one way and the tape the other, the bag on out of the picture as the tube comes in
  //    from the right; the tape is lifted to hang over it. The camera closes in on the tape's
  //    end: the cover peels, the chips drop into the tube; it pulls back as the empty tape is
  //    thrown away, and the cap goes on. It moves on to the printer: the label comes out on its
  //    liner, is peeled off and held up to the camera to be read, and is wrapped round the tube.
  //
  //    The camera is a world point c in the picture's middle and a zoom z. The bench is drawn at
  //    its own scale and scaled up whole, so zoomed in it is the same pixel art, bigger: one
  //    picture all the way, nothing swapped in. Only the label is drawn at the size it is on
  //    screen (P.labelAt), so it sharpens as it comes closer and can be read.
  const TL = P.tapeLength, FILL = 1, HALF: Pt = [W / 2, DESK / 2];
  const T = { x: 300, y: DESK - P.TUBE_BODY.h };
  const BAG0 = 14, BAG_Y = DESK - P.BAG.h, TAPE_Y = BAG_Y + 46;
  const HANG: Pt = [T.x + 9, T.y - 8 - TL];                  // the held end, the strip over the mouth
  const ZM = 3;                                              // in on the tape's end: the whole peel and the tube's mouth in frame
  const TAG_W = labelTiny.width, TAG_H = labelTiny.height, ZL = 128 / TAG_W;   // read at 128 px wide
  const printer = P.printerTop();
  // the printer stands right of the tube, out of the picture until the camera moves on
  const PR: Pt = [T.x + 8 + 240, R(DESK - 1 - printer.base)];   // its liner too
  const SLOT: Pt = [PR[0] + printer.slot.o[0], PR[1] + printer.slot.o[1]];
  const LABEL_AT: Pt = [T.x + 8 + 160, 40];                  // held up to the camera (its top left)
  const LABEL_ON: Pt = [Math.floor(T.x + 8 - 19), T.y + 8];   // on the tube, flat (TUBE_LABEL_W wide)
  type Cam = { c: Pt; z: number };
  const CAMS = {
    bag: { c: [BAG0 + P.BAG.w / 2, HALF[1]] as Pt, z: 1 },
    tube: { c: [T.x + 8, HALF[1]] as Pt, z: 1 },
    // the tape's last pockets and the tube's mouth under them
    macro: { c: [T.x + 8, T.y - 20] as Pt, z: ZM },
    print: { c: [PR[0] + printer.art.width / 2 - 40, HALF[1]] as Pt, z: 1 },
    peel: { c: [0, 0] as Pt, z: 3.2 },                       // in on the liner (set below)
  };
  // From one framing to another, keeping still on screen the one world point both share: the
  // zoom moves in equal ratios, the centre by how much of the view's width has gone.
  const zoom = (a: Cam, b: Cam, k: number): Cam => {
    if (a.z === b.z) return { c: [lerp(a.c[0], b.c[0], k), lerp(a.c[1], b.c[1], k)], z: a.z };
    const z = Math.exp(lerp(Math.log(a.z), Math.log(b.z), k)), w = (1 / a.z - 1 / z) / (1 / a.z - 1 / b.z);
    return { c: [lerp(a.c[0], b.c[0], w), lerp(a.c[1], b.c[1], w)], z };
  };
  // Picked up, the label is followed: the camera keeps it in the middle as it closes in, and
  // as it pulls back with the label to the tube, handing over to the tube's framing.
  const follow = (u: number): Cam => {
    const { o, ax, ay } = labelPose(u), w = TAG_W / 2, h = TAG_H / 2;
    const mid: Pt = [o[0] + ax[0] * w + ay[0] * h, o[1] + ax[1] * w + ay[1] * h];
    if (u < BACK[0]) {
      const k = easeInOut(seg(u, PICK[0], PICK[0] + 300));
      return { c: [lerp(CAMS.peel.c[0], mid[0], k), lerp(CAMS.peel.c[1], mid[1], k)], z: Math.exp(lerp(Math.log(CAMS.peel.z), Math.log(ZL), easeInOut(seg(u, PICK[0], PICK[1])))) };
    }
    const k = easeInOut(seg(u, BACK[0] + .35 * (BACK[1] - BACK[0]), BACK[1]));
    return { c: [lerp(mid[0], CAMS.tube.c[0], k), lerp(mid[1], CAMS.tube.c[1], k)], z: Math.exp(lerp(Math.log(ZL), 0, easeInOut(seg(u, BACK[0], BACK[1])))) };
  };
  const camAt = (u: number): Cam =>
    u < ZIN[0] ? zoom(CAMS.bag, CAMS.tube, easeInOut(seg(u, AWAY[0], AWAY[1])))
      : u < ZOUT[0] ? zoom(CAMS.tube, CAMS.macro, easeInOut(seg(u, ZIN[0], ZIN[1])))
        : u < PAN[0] ? zoom(CAMS.macro, CAMS.tube, easeInOut(seg(u, ZOUT[0], ZOUT[1])))
          : u < FEED[1] ? zoom(CAMS.tube, CAMS.print, easeInOut(seg(u, PAN[0], PAN[1])))
            : u < PICK[0] ? zoom(CAMS.print, CAMS.peel, easeInOut(seg(u, FEED[1], UNPEEL[0] + 100)))
              : follow(u);

  // The bag: pulled one way while the tape is pulled the other, and on out of the picture.
  const bagX = (u: number) => BAG0 - 90 * easeInOut(seg(u, PULL[0], AWAY[1]));
  // The tape, by its held (right) end: out of the zip, then lifted so the strip swings down to
  // hang from it, its free end staying at the desk's height while it can (sin dir = rise /
  // length), until it hangs straight over the mouth. Emptied, it is drawn away: straight up,
  // gathering speed, out of the picture.
  const tapePose = (u: number): { held: Pt; dir: number } => {
    if (u >= TOSS[0]) return { held: [HANG[0], HANG[1] - 180 * seg(u, TOSS[0], TOSS[0] + 900) ** 2], dir: Math.PI / 2 };
    const held: Pt = [lerp(BAG0 + P.BAG.zip, HANG[0], easeInOut(seg(u, PULL[0], HOIST[1]))), lerp(TAPE_Y, HANG[1], easeInOut(seg(u, HOIST[0], HOIST[1])))];
    const settle = seg(u, HOIST[0] + 300, HOIST[1]), hang = settle * settle * (3 - 2 * settle) * Math.PI / 2;
    return { held, dir: Math.PI - Math.max(Math.asin(clamp((TAPE_Y - held[1]) / TL, 0, 1)), hang) };
  };
  // The peel, at the tape's own scale: the cover comes off from the free end, up past the last
  // six pockets; each chip drops once its pocket is open (its cover peeled past it), and falls
  // into the tube.
  const PEEL_PX = 34, CHIPS = 6, GRAVITY = .00038;             // px per ms², the desk's scale
  const peelPx = (u: number) => R(PEEL_PX * seg(u, PEEL[0], PEEL[1]));
  const dropAt = (k: number) => PEEL[0] + (PEEL[1] - PEEL[0]) * (5 * k + 7) / PEEL_PX;
  const goneAt = (u: number) => Array.from({ length: CHIPS }, (_, k) => k).filter(k => u >= dropAt(k)).length;
  const PILE_Y = T.y + P.TUBE_BODY.h - 9;                     // where the chips land on the heap
  const landed = dropAt(CHIPS - 1) + Math.sqrt(2 * (PILE_Y - (HANG[1] + 78 - 5 * (CHIPS - 1))) / GRAVITY);
  // a few degrees off flat or upright only shows as a stray step: snap those
  const tapeTurn = (dir: number) => {
    const a = dir - Math.PI;
    return Math.abs(a) < 3 * Math.PI / 180 ? 0 : Math.abs(a + Math.PI / 2) < 2.5 * Math.PI / 180 ? -Math.PI / 2 : a;
  };
  // Hanging straight, the tape is drawn over the scaled bench at its size on screen
  // (tapeOnScreen); turned, it is the desk-scale art turned whole.
  const upright = (u: number) => u > PULL[0] && u < TOSS[1] && tapeTurn(tapePose(u).dir) === -Math.PI / 2;
  const drawTape = (u: number) => {
    const { held, dir } = tapePose(u), a = tapeTurn(dir);
    P.carrierTurned(g, held[0] - camX + Math.cos(a + Math.PI) * TL / 2, held[1] + Math.sin(a + Math.PI) * TL / 2, a);
  };

  // The chips on their way down, at their size on screen: 1.6 x 0.8 mm, tumbling as they
  // fall, gone from sight into the tube's mouth.
  const chipsOnScreen = (u: number, S: (p: Pt) => Pt, z: number) => {
    const mm = P.TAPE_PX_MM * z, mouth = S([0, T.y + 1])[1];
    g.save(); g.beginPath(); g.rect(0, 0, W, mouth); g.clip();
    for (let k = 0; k < CHIPS; k++) {
      const d = u - dropAt(k);
      if (d < 0) continue;
      const y = HANG[1] + 78 - 5 * k + .5 * GRAVITY * d * d;
      if (y > PILE_Y) continue;
      const [cx, cy] = S([HANG[0] - 1.5 + ((k * 5) % 7 - 3) * .004 * d, y]);
      const th = d / 110 * (k % 2 ? 1 : -1), co = Math.cos(th), si = Math.sin(th);
      const part = (x0: number, x1: number, color: string) => fillPoly(g, ([[x0, -.4], [x1, -.4], [x1, .4], [x0, .4]] as Pt[])
        .map(([x, v]): Pt => [cx + (x * co - v * si) * mm, cy + (x * si + v * co) * mm]), color);
      // in the light, falling: the top a dark grey and the tin bright, or a black chip is lost
      // against the dark
      part(-.8, .8, '#56625d');
      if (mm >= 2.5) { part(-.8, -.5, C.paper2); part(.5, .8, C.paper2); }
    }
    g.restore();
  };
  // The hanging tape at its size on screen: the strip (and its shadow), its cover peeled off.
  const hung = new Map<string, [Bitmap, Bitmap]>();
  const tapeOnScreen = (u: number, S: (p: Pt) => Pt, z: number) => {
    const { held } = tapePose(u), peel = peelPx(u), mm = P.TAPE_PX_MM * z;
    const key = mm.toFixed(3) + ':' + peel + ':' + goneAt(u);
    let t = hung.get(key);
    if (!t) {
      if (hung.size > 64) hung.clear();
      const art = P.hanging(P.carrier(mm, peel / P.TAPE_PX_MM, goneAt(u))), [c, cg] = bitmap(art.width, art.height);
      cg.drawImage(art, 0, 0); cg.globalCompositeOperation = 'source-in'; cg.fillStyle = C.shadow; cg.fillRect(0, 0, c.width, c.height);
      t = [art, c]; hung.set(key, t);
    }
    const [x, y] = S([held[0] - P.TAPE_MM.w * P.TAPE_PX_MM / 2, held[1]]), off = Math.max(1, R(z));
    g.drawImage(t[1], R(x) + off, R(y) + off);
    g.drawImage(t[0], R(x), R(y));
  };
  // The cover tape, peeled off toward the camera: a clear ribbon as wide as the cover, lifted at
  // the peel line, falling back down in front of the pockets already open and curving away to
  // the left. It is clear, so a faint tint with bright edges; the chips fall out behind it.
  const filmOnScreen = (u: number, S: (p: Pt) => Pt) => {
    const { held } = tapePose(u), len = peelPx(u);
    if (len <= 0) return;
    const cx = -1.56, y0 = TL - len, edgeL: Pt[] = [], edgeR: Pt[] = [];
    let x = cx, y = y0;
    for (let d = 0; d <= len; d += .5) {
      const k = d / len, phi = .55 * Math.pow(Math.max(0, (k - .25) / .75), 1.3), w = 3.06 * (1 + .3 * k);
      edgeL.push(S([held[0] + x - Math.cos(phi) * w, held[1] + y - Math.sin(phi) * w]));
      edgeR.push(S([held[0] + x + Math.cos(phi) * w, held[1] + y + Math.sin(phi) * w]));
      x -= Math.sin(phi) * .5; y += Math.cos(phi) * .5;
    }
    g.globalAlpha = .3; fillPoly(g, [...edgeL, ...[...edgeR].reverse()], C.focus); g.globalAlpha = 1;
    for (let i = 1; i < edgeL.length; i++) { line(g, edgeL[i - 1], edgeL[i], C.bone); line(g, edgeR[i - 1], edgeR[i], C.paper2); }
    line(g, edgeL[edgeL.length - 1], edgeR[edgeR.length - 1], C.bone);
  };
  // The cap: brought in from above, over the tube, and pressed on: it snaps (a pixel too far
  // as it clicks home, back up as it seats), with a few sparks off the rim for the click.
  const cap = P.cap(0), SNAP = CAPON[0] + 740;
  const capAt = (u: number): Pt | null => {
    if (u < CAPON[0]) return null;
    const k = easeInOut(seg(u, CAPON[0], CAPON[0] + 600)), over: Pt = [T.x - 1, T.y - 18];
    if (k < 1) return [lerp(T.x + 70, over[0], k), lerp(T.y - 170, over[1], k) - Math.sin(Math.PI * k) * 8];
    return [over[0], lerp(over[1], T.y - 5, easeIn(seg(u, CAPON[0] + 600, SNAP))) - easeOut(seg(u, SNAP, SNAP + 120))];
  };
  // The click: short ticks fly off each side of the rim, then a second, fainter ring further out.
  const clickAt = (u: number, lift: number) => {
    const d = u - SNAP;
    if (d < 0 || d > 260) return;
    const cx = T.x - 1 - camX, rim = T.y - 6 + cap.height - 3 - lift, w = cap.width;
    const ring = d < 130 ? 0 : 1, a = ring ? 7 : 3, len = ring ? 2 : 3;
    g.fillStyle = ring ? C.paper2 : C.bone;
    const mid = rim - 2;                                                // the cap's middle height
    for (const [side, x0] of [[-1, cx - 1], [1, cx + w]] as Array<[number, number]>) {
      for (let i = 0; i < len; i++) g.fillRect(x0 + side * (a + i), mid, 1, 1);                 // level
      for (let i = 0; i < len - 1; i++) for (const v of [-1, 1]) g.fillRect(x0 + side * (a + i), mid + v * (2 + i), 1, 1);   // up and down, fanning out
    }
  };
  // The label: out of the printer's slot on its liner, which hangs down over the front (as the
  // real stock droops out of it), peeled off from the bottom, picked up and held to the camera,
  // then carried to the tube and wrapped round it. As on the real roll its text runs across the
  // liner and it comes out bottom first, header last. At the printer's own scale the real label
  // (about 44 x 36 mm) is the desk-sized label itself, so it faces the camera the whole way and
  // only moves and grows: the same proportions hanging, peeled, held up and on the tube. Its
  // pose: the top left, and one label pixel across and down, in world pixels.
  const LEAD = 3, FEED_LEN = LEAD + TAG_H + 3, LINER_W = TAG_W + 4;
  // a point on the hanging liner: `a` pixels across from the slot's middle, `b` down out of it
  const at = (o: Pt, a: number, b: number): Pt => [o[0] + a, o[1] + 1 + b];
  // the label on its liner in the middle, the printer's front beside it
  const LABEL_MID = at(SLOT, 0, FEED_LEN - LEAD - TAG_H / 2);
  CAMS.peel.c = [LABEL_MID[0] - 6, LABEL_MID[1] - 1];
  const outAt = (u: number) => R(seg(u, FEED[0], FEED[1]) * FEED_LEN);
  // Off the liner the label is lifted and turned over while the camera closes in on it: it keeps
  // its size and only turns about its vertical axis, from the back (the peel folded it over, so
  // it starts K of its width, tilted) through edge-on to its face.
  const K = .62, YAW0 = Math.acos(K);
  const yaw = (u: number) => lerp(YAW0, Math.PI, easeInOut(seg(u, PICK[0], PICK[1])));
  /** Which face is to the camera once peeled: its back until the turn passes edge-on. */
  const showsBack = (u: number) => Math.cos(yaw(u)) > 0;
  // On the tube the label is 3/4 of its height (the real label is 44 x 36 mm), so it grows to
  // that as it is carried over, while the camera pulls out.
  const TUBE_LABEL_W = P.TUBE_LABEL_W, TUBE_LABEL_H = P.labelAt(TUBE_LABEL_W).height;
  const labelPose = (u: number): { o: Pt; ax: Pt; ay: Pt } => {
    const hung = at(SLOT, -TAG_W / 2, outAt(u) - LEAD - TAG_H);   // its top left (header), at the slot
    if (u < PICK[0]) return { o: hung, ax: [1, 0], ay: [0, 1] };
    if (u < BACK[0]) {
      const k = easeInOut(seg(u, PICK[0], PICK[1])), c = Math.cos(yaw(u)), wd = Math.abs(c);
      // its middle, from where the peel left it (left of the liner, K wide) to the reading spot
      const cx = lerp(hung[0] - TAG_W * K / 2, LABEL_AT[0] + TAG_W / 2, k), cy = lerp(hung[1] + TAG_H / 2, LABEL_AT[1] + TAG_H / 2, k) - Math.sin(Math.PI * k) * 10;
      return { o: [cx - wd * TAG_W / 2, cy - TAG_H / 2], ax: [wd, 0], ay: [0, 1] };
    }
    const b = easeInOut(seg(u, BACK[0], BACK[1])), sc = lerp(1, TUBE_LABEL_W / TAG_W, b);
    const cx = lerp(LABEL_AT[0] + TAG_W / 2, LABEL_ON[0] + TUBE_LABEL_W / 2, b), cy = lerp(LABEL_AT[1] + TAG_H / 2, LABEL_ON[1] + TUBE_LABEL_H / 2, b) - Math.sin(Math.PI * b) * 8;
    return { o: [cx - sc * TAG_W / 2, cy - sc * TAG_H / 2], ax: [sc, 0], ay: [0, sc] };
  };
  // rows a..b (of the desk-sized label) of the label drawn n px wide
  const rowCache = new Map<string, Bitmap>();
  const rows = (n: number, a: number, b: number) => {
    const src = P.labelAt(n), ky = TAG_H / src.height, r0 = R(a / ky), r1 = Math.max(r0 + 1, R(b / ky)), key = n + ':' + r0 + ':' + r1;
    let c = rowCache.get(key);
    if (!c) { const [r, rg] = bitmap(src.width, r1 - r0); rg.drawImage(src, 0, r0, src.width, r1 - r0, 0, 0, src.width, r1 - r0); c = r; rowCache.set(key, c); }
    return c;
  };

  function benchWorld(u: number) {
    const lift = R(easeIn(seg(u, BENCH_END - 450, BENCH_END)) * 120);    // picked up, off to the rack
    // the printer, its button lit while it prints; the liner out of the slot
    draw(printer.art, PR[0], PR[1]);
    const printing = u > FEED[0] && u < FEED[1];
    g.fillStyle = printing && Math.floor(u / 150) % 2 === 0 ? C.focus : printing ? C.accent : C.active;
    g.fillRect(R(PR[0] + printer.led[0] - camX), PR[1] + printer.led[1], 2, 1);
    const out = outAt(u), w = (p: Pt): Pt => [p[0] - camX, p[1]];
    if (out > 0) {
      const l0 = at(SLOT, -LINER_W / 2, 0), l1 = at(SLOT, LINER_W / 2, 0), l2 = at(SLOT, LINER_W / 2, out), l3 = at(SLOT, -LINER_W / 2, out);
      // its hard shadow on the printer's front, so it hangs in front of it
      fillPoly(g, [l0, l1, l2, l3].map(p => w([p[0] + 1, p[1] + 1])), C.shadow);
      fillPoly(g, [l0, l1, l2, l3].map(w), P.LINER);
      line(g, w(l1), w(l2), '#b9b79a'); line(g, w(l2), w(l3), '#b9b79a');
    }
    // the slot's mouth, the liner coming out of it
    if (u > FEED[0] - 300) {
      const m = w(at(SLOT, -LINER_W / 2 - 1, -1));
      g.fillStyle = C.ink; g.fillRect(R(m[0]), R(m[1]), LINER_W + 2, 1);
    }
    // the tube, filled once the chips are in, labelled once the label is round it; the chips
    // on their way into it
    draw(tubeOf(u >= landed ? FILL : 0, u >= WRAP[1]), T.x, T.y - lift);
    // wrapping: the label's sides turn away round the tube, evenly; what faces you stays put
    if (u >= WRAP[0] && u < WRAP[1]) {
      const bw = R(lerp(TUBE_LABEL_W, 14, easeInOut(seg(u, WRAP[0], WRAP[1]))));
      g.drawImage(bw < TUBE_LABEL_W ? bandOf(bw) : P.labelAt(TUBE_LABEL_W), Math.floor(T.x + 8 - bw / 2) - camX, LABEL_ON[1] - lift);
    }
    const cp = capAt(u);
    if (cp) {
      const held = u >= CAPON[0] + 600 ? lift : 0;
      draw(cap, R(cp[0]), R(cp[1]) - held);
      clickAt(u, held);
    }
    // the bag: opened at the zip, the tape coming out between its front and back
    if (u < AWAY[1]) {
      const bx = R(bagX(u) - camX), open = easeOut(seg(u, OPEN[0], OPEN[1]));
      for (let d = bag.back.length; d >= 1; d--) g.drawImage(bag.back[d - 1], R(bx + .8 * d), R(BAG_Y - .8 * d));
      bagOpenBack(bx, BAG_Y, open);
      if (u > PULL[0] && !upright(u)) drawTape(u);
      bagOpenFront(bx, BAG_Y, open);
    } else if (u < TOSS[1] && !upright(u)) drawTape(u);
  }

  // The label, drawn at the size it is on screen: coming out on the liner, peeled by a corner,
  // lifted off with its back to the camera, then turned over to be read.
  const BACK_TONE = [0xea, 0xe6, 0xd6], FOLD_TONE = [0xc4, 0xc0, 0xa4], LINER_TONE = [0xa3, 0xa1, 0x89];
  const srcData = new Map<number, ImageData>();
  const peelBuf = bitmap(4, 4);
  /** The corner peel, one pixel at a time (a clip or a rotation would blur it). The label's lower
   *  right corner lifts and folds back over itself along a crease that starts diagonal and
   *  straightens as it sweeps across; the folded part shows the label's back and is foreshortened
   *  to K of its length, as a part lifted toward the camera is; it throws a hard shadow on what
   *  is still stuck. Where it has come off, the liner shows in its shade. At the end the whole
   *  label has been turned over to the left of where it was: the lift's first pose. */
  function peelOnScreen(u: number, toScreen: (p: Pt) => Pt, z: number) {
    const { o } = labelPose(u), n = Math.max(4, R(TAG_W * z)), src = P.labelAt(n), h = src.height;
    let img = srcData.get(n);
    if (!img) { img = src.getContext('2d')!.getImageData(0, 0, n, h); srcData.set(n, img); }
    const e = .5 - .5 * Math.cos(Math.PI * seg(u, UNPEEL[0], UNPEEL[1])), sm = clamp(e / .8), th = .62 * (1 - sm * sm * (3 - 2 * sm));
    const cs = Math.cos(th), sn = Math.sin(th), s = e * n, M = Math.ceil(K * n) + 3, cw = n + 2 * M, ch = h + 2 * M;
    if (peelBuf[0].width !== cw || peelBuf[0].height !== ch) { peelBuf[0].width = cw; peelBuf[0].height = ch; }
    const bg = peelBuf[0].getContext('2d')!, out = bg.createImageData(cw, ch), px = out.data;
    // the folded part at q (on screen, label-local), or null: [source x, source y, distance past the crease]
    const flapAt = (qx: number, qy: number): [number, number, number] | null => {
      const tq = (n - qx) * cs + (h - qy) * sn;
      if (tq < s) return null;
      const d = tq - s, tp = s - d / K;
      if (tp < 0) return null;
      const sx = qx + (tq - tp) * cs, sy = qy + (tq - tp) * sn;
      return sx >= 0 && sx < n && sy >= 0 && sy < h ? [sx, sy, d] : null;
    };
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const qx = x - M + .5, qy = y - M + .5, i = (y * cw + x) * 4, inside = qx > 0 && qx < n && qy > 0 && qy < h;
      let c: number[] | null = null;
      const f = flapAt(qx, qy);
      if (f) {
        const [sx, sy, d] = f, edge = sx < 1.2 || sy < 1.2 || sx > n - 1.2 || sy > h - 1.2;
        c = d < 2.5 ? FOLD_TONE : edge ? [0xff, 0xfd, 0xf2] : BACK_TONE;
      } else if (inside) {
        const tq = (n - qx) * cs + (h - qy) * sn;
        if (tq < s) c = LINER_TONE;
        else {
          const k = (Math.floor(qy) * n + Math.floor(qx)) * 4;
          c = [img.data[k], img.data[k + 1], img.data[k + 2]];
          // the fold's hard shadow, two pixels down and right, in a checker
          if (flapAt(qx - 2, qy - 2) && (x + y) % 2 === 0) c = [c[0] * .55, c[1] * .55, c[2] * .55];
        }
      }
      if (c) { px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255; }
    }
    bg.putImageData(out, 0, 0);
    const [ox, oy] = toScreen(o);
    g.drawImage(peelBuf[0], R(ox) - M, R(oy) - M);
  }
  function labelOnScreen(u: number, toScreen: (p: Pt) => Pt, z: number) {
    const { o, ax, ay } = labelPose(u);
    const n = Math.max(4, R(Math.hypot(ax[0], ax[1]) * z * TAG_W)), src = P.labelAt(n), kx = TAG_W / n, ky = TAG_H / src.height;
    const sx = (v: Pt): Pt => [v[0] * z * kx, v[1] * z * kx], sy = (v: Pt): Pt => [v[0] * z * ky, v[1] * z * ky];
    const row = (r: number): Pt => [o[0] + ay[0] * r, o[1] + ay[1] * r];      // the start of row r
    if (u < UNPEEL[0]) {
      // the rows out of the slot so far: the bottom ones
      const r0 = clamp(TAG_H - (outAt(u) - LEAD), 0, TAG_H);
      if (r0 < TAG_H) drawAffine(g, rows(n, r0, TAG_H), toScreen(row(r0)), sx(ax), sy(ay));
    } else if (u < PICK[0]) peelOnScreen(u, toScreen, z);
    else if (showsBack(u)) {
      // the back, flat and plain: a card with a hard shadow
      const wd = R(ax[0] * TAG_W * z), ht = R(TAG_H * z), [x0, y0] = toScreen(o).map(Math.round);
      if (wd > 0) {
        g.fillStyle = C.shadow; g.fillRect(x0 + 1, y0 + 1, wd, ht);
        g.fillStyle = `rgb(${BACK_TONE})`; g.fillRect(x0, y0, wd, ht);
      }
    } else drawAffine(g, src, toScreen(o), sx(ax), sy(ay));
  }

  // The frame: the bench scaled whole round the camera, the label over it at its own size.
  const [benchBuf, benchG] = bitmap(W + 4, DESK);
  function shotTake(u: number) {
    const cam = camAt(u), z = cam.z, c: Pt = z === 1 ? [R(cam.c[0]), R(cam.c[1])] : cam.c;
    const screen = g, ox = Math.floor(c[0]) - HALF[0] - 2;
    g = benchG; camX = ox;
    g.clearRect(0, 0, benchBuf.width, benchBuf.height);
    benchWorld(u);
    g = screen;
    g.drawImage(benchBuf, c[0] - HALF[0] / z - ox, c[1] - HALF[1] / z, W / z, DESK / z, 0, 0, W, DESK);
    const S = (p: Pt): Pt => [(p[0] - c[0]) * z + HALF[0], (p[1] - c[1]) * z + HALF[1]];
    if (upright(u)) tapeOnScreen(u, S, z);
    if (u >= PEEL[0] && u < landed + 100) chipsOnScreen(u, S, z);
    if (upright(u)) filmOnScreen(u, S);
    if (u > FEED[0] && u < WRAP[0]) labelOnScreen(u, p => [(p[0] - c[0]) * z + HALF[0], (p[1] - c[1]) * z + HALF[1]], z);
  }

  // 6. The rack, R1. The cursor checks the slots in the app's fill order (A1..A5, B1..) and
  //    stops on the first free one; the slot's name is pinned beside it. The cursor sinks into
  //    the slot, the tube is brought over it and lowered in (depth-tested against the rack, so
  //    the caps in front hide it), and the cursor comes back up out of the new cap.
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
  // The B3 tube and the rack without it, with depth (scripts/pixel-art): the tube is drawn pixel
  // by pixel, each kept only where nothing of the rack is nearer the camera.
  const RD = art.buildRack as unknown as { z0: number; pxPerMm: number; el: number; b3Out: string[]; tubes: Record<string, SpriteData & { x: number; y: number; depth: string[] }> };
  const zOf = (s: string, i: number) => s[2 * i] === '.' ? null : (parseInt(s.slice(2 * i, 2 * i + 2), 36) + RD.z0) / 2;
  const rackZ = RD.b3Out.map(r => Array.from({ length: r.length / 2 }, (_, i) => zOf(r, i)));
  const B3T = RD.tubes['B3'];
  const b3Pixels = (() => {
    const art = fromCodes(B3T), img = art.getContext('2d')!.getImageData(0, 0, art.width, art.height).data;
    const out: Array<[number, number, string, number]> = [];
    B3T.depth.forEach((row, y) => { for (let x = 0; x < B3T.width; x++) { const z = zOf(row, x); if (z === null) continue; const k = (y * art.width + x) * 4; out.push([B3T.x + x, B3T.y + y, `rgb(${img[k]},${img[k + 1]},${img[k + 2]})`, z]); } });
    return out;
  })();
  const MM_PER_PX = 1 / (RD.pxPerMm * Math.cos(RD.el * Math.PI / 180)), DZ = Math.sin(RD.el * Math.PI / 180);
  // the tube's foot is 30 mm down in the hole: it hovers with its foot just clear of the rim
  const IN_PX = Math.ceil(30 / MM_PER_PX), HOVER_PX = IN_PX + 4, FROM_PX = RACK.y + Math.max(...b3Pixels.map(p => p[1])) + 2;
  const drawB3 = (n: number) => {
    const L = n * MM_PER_PX;
    for (const [x, y, color, z] of b3Pixels) {
      const sy = y - n;
      if (RACK.y + sy < 0) continue;
      const behind = sy >= 0 && sy < rackZ.length ? rackZ[sy][x] : null;
      if (behind !== null && behind > z + L * DZ + .25) continue;
      g.fillStyle = color; g.fillRect(R(RACK.x + x - camX), RACK.y + sy, 1, 1);
    }
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

  // Where the cursor is (rack clock), and its square size: gliding slot to slot in fill order
  // with a little hop, bobbing over the free one; it shrinks down into the slot while the tube
  // goes in, and grows back up out of the cap, where it stays until the sign-off.
  const CURSOR = 3, ABOVE = 11;
  const cursorAt = (t: number): { p: Pt; size: number } | null => {
    if (t <= WALK) return null;
    const i = Math.min(ORDER.length - 1, Math.floor((t - WALK) / STEP));
    const k = i === 0 ? 1 : easeInOut(seg(t - WALK - i * STEP, 0, HOP));
    const [ax, ay] = slotTop[ORDER[Math.max(0, i - 1)]] ?? [0, 0], [bx, by] = slotTop[ORDER[i]] ?? [0, 0];
    const bob = t > TAG_AT && t < SINK[0] ? Math.floor((t - TAG_AT) / 350) % 2 : 0;
    // into the slot and back out: down to the cap's middle, a square at a time
    const sink = easeIn(seg(t, SINK[0], SINK[1])) * (1 - easeOut(seg(t, RISE[0], RISE[1])));
    if (sink >= 1) return null;
    const size = Math.max(1, R(lerp(CURSOR, 0, sink)));
    const x = lerp(ax, bx, k), y = lerp(ay, by, k) - ABOVE - Math.sin(Math.PI * k) * 3 + bob + sink * (ABOVE + 3);
    return { p: [R(RACK.x + x - camX), R(RACK.y + y)], size };
  };
  const cursor = (p: Pt, size = CURSOR, turn = 1) => {
    chevron(p[0] + 1, p[1] + 1, size, turn, C.shadow);
    chevron(p[0], p[1], size, turn, C.accent);
  };

  // The rack's label plate (props.ts rackPlate), hung on its front. The front runs down to the
  // right along the view's slope (.4), so the plate is sheared to sit on it.
  /** Rack n's plate; (x, y) is the rack sprite's top left on screen, z the sprite's scale. */
  const drawPlate = (x: number, y: number, n: number, z = 1, hot = false, ctx = g) => {
    drawAffine(ctx, P.rackPlate(n, hot), [x + 24 * z, y + 57 * z], [z, .4 * z], [0, z]);
  };

  function shotRack(t: number, withCursor = true) {
    camX = CAM_RACK;
    const placed = t >= SEATED;
    draw(placed ? rackFull : rackEmpty, RACK.x, RACK.y);
    drawPlate(RACK.x - camX, RACK.y, 1);
    const [bx, by] = slotTop['B3'] ?? [60, 40];
    // the walk: a ring on each taken slot once the cursor is over it; on the free one, the ring
    // stays (the app's 700 ms blink) until the tube is in, then flashes
    const step = Math.min(ORDER.length - 1, Math.floor((t - WALK) / STEP));
    const over = t - WALK - step * STEP >= HOP * .6 || step === 0;
    if (t > WALK && step < ORDER.length - 1 && over) ring(ORDER[step], C.accent);
    if (t >= TAG_AT && !placed && (t < SINK[1] || Math.floor((t - SINK[1]) / 350) % 2 === 0)) ring('B3', C.focus);
    // the tube: brought over the slot (slowing as it arrives), a moment's hover, lowered in; it
    // sinks the last pixel as it seats
    if (t > COME[0] && !placed) {
      const n = t < COME[1] ? lerp(FROM_PX, HOVER_PX, easeOut(seg(t, COME[0], COME[1])))
        : t < LOWER[0] ? HOVER_PX : t < LOWER[1] ? lerp(HOVER_PX, 1, easeInOut(seg(t, LOWER[0], LOWER[1]))) : 0;
      drawB3(R(n));
    }
    if (placed && t < SEATED + 600 && Math.floor((t - SEATED) / 150) % 2 === 0) ring('B3', C.focus);
    // the slot's name, pinned beside it: the leader draws out from the cursor, then the tag
    // after the hold it closes the way it opened, backwards: the tag to its middle, the leader in
    if (t > TAG_AT && t < SIGN + TAG_CLOSE[1]) {
      const tx = R(RACK.x + bx + TAG_X - camX), ty = R(RACK.y + by - 14), x0 = R(RACK.x + bx + 6 - camX);
      const reach = R(lerp(x0, tx, easeOut(seg(t, TAG_AT, TAG_AT + 200)) * (1 - easeIn(seg(t, SIGN + TAG_CLOSE[0], SIGN + TAG_CLOSE[1])))));
      g.fillStyle = C.focus;
      for (let x = x0; x < reach; x += 2) g.fillRect(x, ty + 6, 1, 1);
      const shut = easeIn(seg(t, SIGN, SIGN + TAG_CLOSE[0]));
      if (reach >= tx && shut < 1) {
        const w = measure('bold', P.PART.slot) + 6, k = easeOut(seg(t, TAG_AT + 200, TAG_AT + 320)) * (1 - shut), h = Math.max(2, R(12 * k)), y = ty + R((12 - h) / 2);
        g.fillStyle = C.shadow; g.fillRect(tx + 1, y + 1, w, h);
        g.fillStyle = C.focus; g.fillRect(tx, y, w, h);
        if (k >= 1 && shut === 0) text(g, 'bold', P.PART.slot, tx + 3, ty + 10, C.ink);
      }
    }
    if (withCursor) { const c = cursorAt(t); if (c) cursor(c.p, c.size); }
  }


  // The racks' projection, for the finale's drawer to stand on the same desk.
  const rackPose = art.filmRackFull as unknown as Pose;

  // ---------- 6b'. The question ----------
  // The cursor stays where it was as the rack goes (it is not on the desk: it is Inventatory);
  // it lands exactly where the typed line's prompt is drawn (say.ts), so the hand-over is seamless.
  const ASK_W = 3 * 3 + 7 + measure(SAY_FONT, QUESTION) + 11;
  const ASK_DX = R((W - ASK_W) / 2) - SAY_X, ASK_DY = R(DESK / 2 - 4) - SAY_BASE;
  const ASK_AT: Pt = [SAY_X + 4.5 + ASK_DX, SAY_BASE - 12 + 7.5 + ASK_DY];      // the prompt's middle
  function shotAsk(s: number) {
    camX = CAM_RACK;
    g.save(); g.translate(0, R(easeInOut(seg(s, ASK_TILT[0], ASK_TILT[1])) * (DESK + 10)));
    shotRack(SIGN + Math.min(s, TAG_CLOSE[1]), false);
    g.restore();
    const from = cursorAt(SIGN - 1)?.p ?? ASK_AT;
    if (s < ASK_FLY[1]) {
      // up and over, turning from pointing down to the prompt early, while it is still rising
      const k = easeInOut(seg(s, ASK_FLY[0], ASK_FLY[1])), turn = 1 - easeInOut(seg(s, ASK_FLY[0], ASK_FLY[0] + 300));
      cursor([lerp(from[0], ASK_AT[0], k), lerp(from[1], ASK_AT[1], k) - Math.sin(k * Math.PI) * 10], CURSOR, turn);   // (chevron() snaps it)
      return;
    }
    // it waits a moment as the prompt, then types
    if (s < ASK_TYPE) { cursor(ASK_AT, CURSOR, 0); return; }
    g.save(); g.translate(ASK_DX, ASK_DY);
    say(g, [{ text: QUESTION, at: ASK_TYPE, until: Infinity }], s);
    g.restore();
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
  /** `scene`: the picture the camera tilts up off (the rack, here); `from`: where the cursor is as
   *  it starts; `tally`: whether the numbers come in under the lockup. */
  function shotSign(t: number, scene = () => shotRack(SIGN + 399, false), from0?: Pt, tally = true) {
    const L = t - SIGN;
    camX = CAM_RACK;
    // the camera tilts up off the rack, all but the cursor that found the slot
    if (L < TILT[1]) {
      g.save(); g.translate(0, R(easeInOut(seg(L, TILT[0], TILT[1])) * (DESK + 10)));
      scene();
      g.restore();
    }
    const prompt = cells.filter(c => c.part === 'prompt');
    const px0 = Math.min(...prompt.map(c => c.x)), py0 = Math.min(...prompt.map(c => c.y));
    const home: Pt = [px0 + PX * 1.5, py0 + PX * 2.5];              // the prompt's middle, where the flight ends
    const shade = (c: typeof cells[number], dx = 0, dy = 0) => {
      g.fillStyle = c.shadow; g.fillRect(c.x + SH[0] + dx, c.y + SH[1] + dy, c.w, c.h);
    };
    // after it is complete, the lockup (and its line) moves up to make room for the numbers
    const up = tally ? R(easeInOut(seg(t, RESULT, RESULT + 600)) * LIFT) : 0, shift = shiftAt(t);
    g.save(); g.translate(shift, -up);
    // 1. the cursor's flight: from above B3 to the middle, turning back into ›, growing in
    //    whole-pixel steps and taking on the lockup's colours and shadow
    if (L < FLY[1]) {
      const from = from0 ?? cursorAt(SIGN + 399)?.p ?? home;
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
    if (tally) rows.forEach(([n, label, color], i) => {
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
    const t = time;                                   // the reel owns the loop: this film runs as long as the reel needs it
    g.clearRect(0, 0, W, H);
    const u = unlater(t);
    if (t < SCAN_END) shotScan(t);
    else if (t < FACE_END) shotFace(t - FACE_SHIFT);
    else if (u < 20000) shotPc(u);
    else if (u < BENCH_END) shotTake(u);
    else if (u - BENCH_EXTRA < SIGN) shotRack(u - BENCH_EXTRA);
    else if (u - BENCH_EXTRA < SIGN + DESK_LEN) shotAsk(u - BENCH_EXTRA - SIGN);
    else if (u - BENCH_EXTRA < SIGN_END) shotSign(u - BENCH_EXTRA);
    // dissolves between shots, and into and out of the loop
    const cuts: Array<[number, number, number]> = [[0, 500, -1], [SCAN_END - 400, SCAN_END, 1], [SCAN_END, SCAN_END + 300, -1],
      [FACE_END - 300, FACE_END, 1], [FACE_END, FACE_END + 300, -1],
      ...([[19600, 20000, 1], [20000, 20300, -1], [BENCH_END - 300, BENCH_END, 1], [BENCH_END, BENCH_END + 300, -1], [SIGN_END - 600 + BENCH_EXTRA, SIGN_END + BENCH_EXTRA, 1]] as Array<[number, number, number]>)
        .map(([a, b, d]): [number, number, number] => [later(a), later(b), d])];
    for (const [a, b, dir] of cuts) if (t >= a && t < b) dither(g, dir > 0 ? seg(t, a, b) : 1 - seg(t, a, b));
  }

  // What the finale (finale.ts) borrows: the rack's plate, the CAD projection, the cursor, and
  // the sign-off.
  const kit = {
    plate: drawPlate,
    axis: (v: V3) => linear(rackPose, v),
    chevron: (cx: number, cy: number, size: number, turn: number, color: string) => chevron(cx, cy, size, turn, color),
    sign: (L: number, scene: () => void, from: Pt) => { g = screenG; camX = CAM_RACK; shotSign(SIGN + L, scene, from, false); },
  };
  return { render, kit };
}
