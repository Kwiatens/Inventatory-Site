// "Find it": the reel's ending. A board's BOM goes in, and the film shows what the exact place
// of every part is for. The art is the real thing: the racks and tubes from the CAD
// (scripts/pixel-art), the comparator board, its BOM as KiCad exports it.
//
// The BOM sheet, once printed, stays pinned top right; the desk scrolls under it, left to right:
// the board, then a drawer, then rack R1. Beats: 1 the board and its BOM; 2 the usual answer
// ("Drawer 12" on every line, all of them into one drawer, where the cursor cannot find anything),
// then Inventatory's (each line retyped to its own slot in R1); 3 the pick; 4 the kit, held; 5 the
// cursor becomes the lockup's ›. (Beat 0, the racks on the desk, is the intake film's last shot.)
import art from '../../data/pixel-art.json';
import { bitmap, fromCodes, text, measure, fillPoly, line, drawAffine, dither, C, type Bitmap } from './gfx';
import { type SpriteData } from '../pixel';

const DESK = 166;
export const W = 384, H = DESK;
const R = Math.round;

// ---------- timeline (ms, the finale's own clock; the reel starts it on a dissolve) ----------
// 1. The board, alone in the middle; it moves aside and its BOM prints out beside it.
const IN = 300, BOARD_GO = [1100, 1700], PRINT = [1800, 2800];
// 2a. The desk scrolls: the board goes, a drawer comes. The sheet gets a Where column, and the
//     usual answer is typed into it, line by line, each line pointing into the same drawer.
const PAN1 = [4100, 5100], HEAD_AT = 5300, ROW_AT = (k: number) => 5600 + k * 220, POINT_MS = 180;
// 2b. The pointers go into the drawer; the cursor comes, and goes from bag to bag without finding
//     anything: a pause on each (`dwell`), lifting two to look under, going back to one it has
//     already seen. Then it shakes its head (the mark tilts one way and the other about its
//     middle, each swing a little smaller) and gives up: up out of the drawer, a square smaller
//     at a time.
const POINTS_IN = [8100, 8400], CUR_IN = [8300, 8550], HUNT_AT = 8650, HOP = 360, CHECK_UP = 12;
const STOPS: Array<{ bag: number; dwell: number; check?: boolean }> = [
  { bag: 11, dwell: 380 }, { bag: 6, dwell: 260 }, { bag: 10, dwell: 760, check: true }, { bag: 3, dwell: 220 },
  { bag: 7, dwell: 300 }, { bag: 11, dwell: 760, check: true }, { bag: 4, dwell: 240 },
];
const HUNT_END = HUNT_AT + STOPS.reduce((n, s) => n + HOP + s.dwell, 0);
// (it shakes it up in the clear, over the drawer's back wall, where it can be seen)
// The cursor pointing down, its five squares about its middle: upright, and its head tilted (one
// arm flatter, the point moved over) to the right; to the left it is mirrored.
const TILTED = [
  [[-2, -1], [-1, 0], [0, 1], [1, 0], [2, -1]],
  [[-2, -2], [-1, -1], [0, 0], [1, 0], [2, -1]],
];
const TILTS = [1, -1, 1, -1, 1, -1, 0], TILT_MS = 105, RISE = [HUNT_END + 100, HUNT_END + 500];
const SHAKE = [RISE[1] + 150, RISE[1] + 150 + TILTS.length * TILT_MS], CUR_OUT = [SHAKE[1] + 250, SHAKE[1] + 650];
// 2c. The usual answers are erased; the desk scrolls on to R1; the cursor comes over it, and each
//     line is retyped to its own slot, its pointer going to that slot, which lights. The cursor,
//     which was lost in the drawer, now goes straight to each slot as its line points there,
//     then comes back over the rack and nods: this is better.
const ERASE = [CUR_OUT[1] + 250, CUR_OUT[1] + 550], PAN2 = [ERASE[1] + 100, ERASE[1] + 1100], CUR_IN2 = [PAN2[1] + 100, PAN2[1] + 350];
const ROW2_AT = (k: number) => CUR_IN2[1] + 150 + k * 350;
const HOME2 = [ROW2_AT(7) + 450, ROW2_AT(7) + 750], NOD = [HOME2[1] + 100, HOME2[1] + 600], BEAT2_END = NOD[1] + 1100;
// 3. The pick, one tube at a time, in PICKS order: the line lights and points to its slot, the
//    cursor goes there, the tube comes up out of the rack (the cursor riding its cap) and is set
//    down under the sheet, in the line's place; the line is ticked. The first is the 10K, the
//    part the first half put away: it waits in the air while its slot's tag opens, as it did then.
const P3 = BEAT2_END, UNPOINT = [P3, P3 + 300];
type Pick = { hop: number[]; lift: number[]; hold: number[]; carry: number[] };
const PICK3: Pick[] = (() => {
  let at = UNPOINT[1] + 150;
  return Array.from({ length: 6 }, (_, i) => {                            // one per tube in PICKS
    const hero = i === 0, hop = [at, at + (hero ? 320 : 280)], lift = [hop[1] + (hero ? 150 : 60), hop[1] + (hero ? 800 : 460)];
    const hold = [lift[1], lift[1] + (hero ? 1100 : 0)], carry = [hold[1], hold[1] + (hero ? 1050 : 800)];
    at = carry[1] + (hero ? 300 : 120);
    return { hop, lift, hold, carry };
  });
})();
const LAST = PICK3[PICK3.length - 1];
// 4. The kit: every rack line ticked, the tubes in a row, R1 with six holes; the cursor goes back
//    over the rack, and the picture is held.
const HOME3 = [LAST.carry[1] + 250, LAST.carry[1] + 700], KIT_END = HOME3[1] + 2200;
// 5. The sign-off (film.ts): the camera tilts up off the kit, and the cursor that picked the
//    tubes flies up, turns back into the › and grows into the lockup's, which is typed out with
//    its line under it; it is held, and dissolves out.
const SIGN_HELD = 5600, SIGN_OUT = 600, END = KIT_END + SIGN_HELD + SIGN_OUT;
/** Where the finale's picture ends (the reel's pause follows it). */
export const RUN = END;
/** The frame to show still (reduced motion): the kit. */
export const POSTER = KIT_END - 300;
/** Chapter starts, for the arrow keys. */
export const CHAPTERS = [0, PAN1[0], ERASE[0], P3, KIT_END];
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeInOut = (k: number) => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const easeIn = (k: number) => k * k * k;
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
type Pt = [number, number];
type V3 = [number, number, number];

export interface Kit {
  plate: (x: number, y: number, n: number, z?: number, hot?: boolean, ctx?: CanvasRenderingContext2D) => void;
  axis: (v: V3) => Pt;
  chevron: (cx: number, cy: number, size: number, turn: number, color: string) => void;
  sign: (L: number, scene: () => void, from: Pt) => void;
}

// The board's BOM as KiCad exports it (grouped by value, in reference order), and where each line's
// part is: a slot in rack R1 (the six build.py's PICKS empties), or, for the parts that are not
// kept in tubes, the place typed in for them (the app's free-text location).
const BOM: Array<[ref: string, value: string, pkg: string, where: string]> = [
  ['C1', '100nF', '0603', 'C1'],
  ['D1', 'LED', '0603', 'C2'],
  ['J1', 'Conn_01x03', '1x03', 'Drawer 2'],
  ['R1,R2', '10K', '0603', 'B3'],
  ['R3', '100K', '0603', 'B4'],
  ['R4', '4.7K', '0603', 'B2'],
  ['R5', '1K', '0603', 'B1'],
  ['U1', 'LM393', 'SOIC-8', 'Drawer 2'],
];
const inRack = (k: number) => BOM[k][3].length === 2;
const exact = (k: number) => inRack(k) ? 'R1-' + BOM[k][3] : BOM[k][3];
const USUAL = 'Drawer 12';
// The order the tubes come out (buildRack's patches are cumulative in this order): the 10K
// first, the part the first half put away, then the rest in the BOM's order.
const PICKS = ['B3', 'C1', 'C2', 'B4', 'B2', 'B1'];
/** `str` typed from `at`, a key every `per` ms. */
const typed = (str: string, t: number, at: number, per: number) => str.slice(0, clamp(Math.floor((t - at) / per) + 1, 0, str.length));

export function createFinale(canvas: HTMLCanvasElement, kit: Kit) {
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  /** A dotted pointer from a to b, drawn over [from, to] of its length (0..1). */
  const dotted = (a: Pt, b: Pt, color: string, from = 0, to = 1) => {
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    g.fillStyle = color;
    for (let i = 0; i <= n; i += 2) if (i >= from * n && i <= to * n) g.fillRect(R(a[0] + (b[0] - a[0]) * i / n), R(a[1] + (b[1] - a[1]) * i / n), 1, 1);
  };
  /** The film's cursor, pointing down, `size` px squares (it comes and goes a square at a time). */
  const cursor = (cx: number, cy: number, size = 3, tilt = 0) => {
    if (size <= 0) return;
    if (tilt === 0) { kit.chevron(R(cx) + 1, R(cy) + 1, size, 1, C.shadow); kit.chevron(R(cx), R(cy), size, 1, C.accent); return; }
    // its head tilted: drawn poses, not the mark turned, so the squares stay corner to corner
    const pose = TILTED[Math.min(1, Math.abs(tilt))].map(([x, y]) => [x * Math.sign(tilt), y]);
    for (const [dx, color] of [[1, C.shadow], [0, C.accent]] as Array<[number, string]>) {
      g.fillStyle = color;
      for (const [x, y] of pose) g.fillRect(R(cx + x * size - size / 2) + dx, R(cy + y * size - size / 2) + dx, size, size);
    }
  };

  // ---------- the BOM, printed: paper, a folded corner, four columns in the 5 px mono ----------
  const COL = [6, 36, 92, 128], ROW0 = 27, PITCH = 9, SW = 180, SH = ROW0 + (BOM.length - 1) * PITCH + 8;
  const SX = W - SW - 12, SY = 3;                                         // pinned, top right
  /** Row k's baseline in the sheet. */
  const rowY = (k: number) => ROW0 + k * PITCH;
  /** Where a row's pointer leaves the sheet (its left edge, at the row's middle). */
  const rowEnd = (k: number): Pt => [SX - 3, SY + rowY(k) - 3];
  const bases = new Map<number, Bitmap>();
  /** The sheet with the first `head` letters of the Where column's heading. */
  const base = (head: number): Bitmap => {
    let c = bases.get(head);
    if (c) return c;
    const [b, cg] = bitmap(SW + 1, SH + 1);
    cg.fillStyle = C.shadow; cg.fillRect(1, 1, SW, SH);
    cg.fillStyle = C.bone; cg.fillRect(0, 0, SW, SH);
    // the folded corner
    cg.clearRect(SW - 7, 0, 7, 7); cg.fillStyle = C.shadow; cg.fillRect(SW - 6, 1, 6, 6);
    cg.fillStyle = C.paper2; for (let i = 0; i < 7; i++) cg.fillRect(SW - 7, i, i + 1, 1);
    ['Ref', 'Value', 'Pkg', 'Where'.slice(0, head)].forEach((h, i) => text(cg, 'mono', h, COL[i], 12, C.steel));
    cg.fillStyle = C.paper2; cg.fillRect(4, 16, SW - 8, 1);
    BOM.forEach((row, k) => row.slice(0, 3).forEach((s, i) => text(cg, 'mono', s, COL[i], rowY(k), C.ink)));
    bases.set(head, b);
    return b;
  };
  type Sheet = { head: number; where?: (k: number) => string; hi?: number; done?: number[] };
  const drawSheet = ({ head, where, hi, done }: Sheet) => {
    g.drawImage(base(head), SX, SY);
    if (hi !== undefined) {
      g.fillStyle = C.focus; g.fillRect(SX + 2, SY + rowY(hi) - 7, SW - 4, 9);
      BOM[hi].slice(0, 3).forEach((s, i) => text(g, 'mono', s, SX + COL[i], SY + rowY(hi), C.ink));
    }
    BOM.forEach((_, k) => {
      const w = where?.(k);
      if (!w) return;
      const ok = done?.includes(k), y = SY + rowY(k);
      text(g, 'mono', w, SX + COL[3], y, ok ? C.active : C.ink);
      if (ok) {                                                       // a tick after it
        g.fillStyle = C.active;
        const x = SX + COL[3] + measure('mono', w) + 4;
        [[0, 2], [1, 3], [2, 4], [3, 3], [4, 2], [5, 1], [6, 0]].forEach(([dx, dy]) => g.fillRect(x + dx, y - 6 + dy, 1, 2));
      }
    });
  };

  // ---------- the comparator board, flat on the desk ----------
  const board = boardArt();

  // ---------- the drawer: a parts cabinet's drawer pulled out onto the desk, full of bags ----------
  // Drawn in the racks' own projection (kit.axis), so it stands on the same desk; polygons, so it
  // scrolls and is lit pixel-exact.
  const ex = kit.axis([1, 0, 0]), ey = kit.axis([0, 1, 0]), ez = kit.axis([0, 0, 1]);
  // the desk's two directions on screen: `along` runs to the right (the racks' fronts), `back` away
  const [along, back] = Math.abs(ex[1] / ex[0]) < Math.abs(ey[1] / ey[0]) ? [ex, ey] : [ey, ex];
  const sgn = (v: Pt, want: number, axis: 0 | 1): Pt => Math.sign(v[axis]) === want ? v : [-v[0], -v[1]];
  const AL = sgn(along, 1, 0), BK = sgn(back, -1, 1), UP = sgn(ez, -1, 1);
  const DR = { w: 118, d: 150, h: 42 }, DZ0 = .8;                         // mm: a deep cabinet drawer; its scale
  // the bags: a heap of the same anti-static bags, all alike: u, v, lift (mm), turn, tone, half
  // width and half length (mm)
  type Bag = [number, number, number, number, number, number, number];
  const BAGS: Bag[] = [
    [30, 118, 0, .3, 0, 21, 31], [80, 112, 2, -.5, 1, 22, 32], [52, 92, 5, .1, 2, 20, 30], [28, 70, 3, -.2, 1, 22, 31], [86, 74, 6, .4, 0, 21, 33],
    [58, 50, 4, -.4, 2, 22, 32], [30, 34, 8, .2, 0, 20, 31], [84, 36, 7, -.1, 1, 21, 30], [56, 112, 10, -.8, 1, 22, 32], [48, 68, 12, .6, 0, 21, 31],
    [70, 88, 14, -.3, 2, 20, 32], [36, 96, 16, .5, 1, 22, 31],
  ];
  // light anti-static film: metallic grey, a sheen across it, heat seals at both ends, the zip
  // below the top seal, and the vendor's white label over most of its face (as in the first half)
  const TONES = [['#5d6865', '#7d8985', '#3d4a47', '#6f7b77'], ['#536060', '#6f7b77', '#384543', '#65706d'], ['#65706d', '#8c9690', '#465350', '#7d8985']];
  const hunt = (() => {
    let at = HUNT_AT;
    return STOPS.map(st => { const s = { ...st, arrive: at + HOP, leave: at + HOP + st.dwell }; at = s.leave; return s; });
  })();
  /** Drawer geometry and art at origin o (screen px of its front left foot), scale z. `order`: the
   *  bags' draw order (a bag looked under goes back on top); `held`: a bag lifted `up` mm. */
  const drawerAt = (o: Pt, z: number) => (u: number, v: number, w: number): Pt =>
    [o[0] + (u * AL[0] + v * BK[0] + w * UP[0]) * z, o[1] + (u * AL[1] + v * BK[1] + w * UP[1]) * z];
  function drawer(o: Pt, z: number, order: number[], held = -1, up = 0) {
    const P = drawerAt(o, z);
    const quad = (pts: Pt[], color: string) => fillPoly(g, pts, color);
    const { w: Wd, d: D, h: Hd } = DR, T = 3;
    // inside: the floor, the far walls' inner faces
    quad([P(0, 0, 0), P(Wd, 0, 0), P(Wd, D, 0), P(0, D, 0)], '#1a201f');
    quad([P(0, D, 0), P(Wd, D, 0), P(Wd, D, Hd), P(0, D, Hd)], '#2b3533');      // back wall, inside
    const leftSeen = (AL[0] * BK[1] - AL[1] * BK[0]) < 0;                     // which side wall shows its inside
    const farU = leftSeen ? 0 : Wd;
    quad([P(farU, 0, 0), P(farU, D, 0), P(farU, D, Hd), P(farU, 0, Hd)], '#232b29');
    for (const i of order) {
      const [u, v, lift, a, tone, hw, hd] = BAGS[i], lifted = i === held ? up : 0;
      const corner = (du: number, dv: number): Pt => P(u + du * Math.cos(a) - dv * Math.sin(a), v + du * Math.sin(a) + dv * Math.cos(a), lift + lifted);
      const [body, sheen, edge, seal] = TONES[tone];
      // the outline, its corners cut: a filled bag is a pillow
      const outline = [corner(-hw + 3, -hd), corner(hw - 3, -hd), corner(hw, -hd + 3), corner(hw, hd - 3), corner(hw - 3, hd), corner(-hw + 3, hd), corner(-hw, hd - 3), corner(-hw, -hd + 3)];
      // lifted, it leaves its shadow on the pile: half the pixels, ordered, as the film's shadows are
      if (lifted) fillPoly(g, outline.map(([x, y]): Pt => [x + 2, y - lifted * UP[1] * z + 2]), C.shadow, 8);
      quad(outline, body);
      quad([corner(-hw, 4), corner(-hw, 16), corner(hw, -6), corner(hw, -18)], sheen);
      quad([corner(-hw + 1, -hd + 1), corner(hw - 1, -hd + 1), corner(hw - 1, -hd + 4), corner(-hw + 1, -hd + 4)], seal);
      quad([corner(-hw + 1, hd - 4), corner(hw - 1, hd - 4), corner(hw - 1, hd - 1), corner(-hw + 1, hd - 1)], seal);
      quad([corner(-hw, -hd + 7), corner(hw, -hd + 7), corner(hw, -hd + 9), corner(-hw, -hd + 9)], edge);   // the zip
      for (let k = 0; k < outline.length; k++) line(g, outline[k], outline[(k + 1) % outline.length], '#27312f');
      quad([corner(-13, -12), corner(13, -12), corner(13, 16), corner(-13, 16)], C.bone);              // the label
      quad([corner(-10, -9), corner(9, -9), corner(9, -6.5), corner(-10, -6.5)], C.ink);
      quad([corner(-10, -3), corner(3, -3), corner(3, -1.5), corner(-10, -1.5)], C.steel);
      quad([corner(-10, 4), corner(-1, 4), corner(-1, 13), corner(-10, 13)], C.ink);
    }
    // outside: the near side wall, the front, the rims on top
    const nearU = leftSeen ? Wd : 0;
    quad([P(nearU, 0, 0), P(nearU, D, 0), P(nearU, D, Hd), P(nearU, 0, Hd)], '#3d4a47');
    quad([P(0, 0, 0), P(Wd, 0, 0), P(Wd, 0, Hd + 4), P(0, 0, Hd + 4)], '#5d6865');                  // the front, a lip higher
    quad([P(0, 0, Hd + 4), P(Wd, 0, Hd + 4), P(Wd, T, Hd + 4), P(0, T, Hd + 4)], '#8c9690');
    quad([P(nearU, T, Hd), P(nearU, D, Hd), P(nearU + (leftSeen ? -T : T), D, Hd), P(nearU + (leftSeen ? -T : T), T, Hd)], '#5d6865');
    quad([P(0, D, Hd), P(Wd, D, Hd), P(Wd, D - T, Hd), P(0, D - T, Hd)], '#4a5754');
    // the pull, a slot under the lip, and the label holder with the drawer's number
    quad([P(Wd / 2 - 18, 0, Hd + 1), P(Wd / 2 + 18, 0, Hd + 1), P(Wd / 2 + 18, 0, Hd - 5), P(Wd / 2 - 18, 0, Hd - 5)], '#27312f');
    // (24 x 12 label pixels on a 26 x 13 mm card, under the pull)
    drawAffine(g, drawerLabel, P(Wd / 2 - 13, 0, Hd - 12), [AL[0] * z * 26 / 24, AL[1] * z * 26 / 24], [-UP[0] * z * 13 / 12, -UP[1] * z * 13 / 12]);
  }
  const drawerLabel = (() => {
    const [lc, lg] = bitmap(24, 12);
    lg.fillStyle = C.bone; lg.fillRect(0, 0, 24, 12);
    text(lg, 'bold', '12', 12 - measure('bold', '12') / 2, 11, C.ink);
    return lc;
  })();

  // ---------- rack R1 up close (the CAD's depth-tested picks) ----------
  type Tube = SpriteData & { x: number; y: number; depth: string[] };
  const RD = art.buildRack as unknown as { z0: number; pxPerMm: number; el: number; depth: string[]; gone: Array<Array<[number, number, string, string]>>; tubes: Record<string, Tube> };
  const fullData = art.filmRackFull as unknown as SpriteData & { tags: Record<string, number[][]> };
  const zOf = (s: string, i: number) => s[2 * i] === '.' ? null : (parseInt(s.slice(2 * i, 2 * i + 2), 36) + RD.z0) / 2;
  const variants = [-1, ...PICKS.map((_, k) => k)].map(k => {
    const rows = fullData.rows.map(r => [...r]);
    const depth = RD.depth.map(r => Array.from({ length: r.length / 2 }, (_, i) => zOf(r, i)));
    if (k >= 0) for (const [x, y, code, z] of RD.gone[k]) { rows[y][x] = code; depth[y][x] = zOf(z, 0); }
    return { art: fromCodes({ width: fullData.width, height: fullData.height, rows: rows.map(r => r.join('')) } as SpriteData), depth };
  });
  const tubes = Object.fromEntries(PICKS.map(s => {
    const d = RD.tubes[s];
    return [s, { ...d, art: fromCodes(d), z: d.depth.map(r => Array.from({ length: r.length / 2 }, (_, i) => zOf(r, i))) }];
  }));
  const tubePixels = (s: string) => {
    const tb = tubes[s], img = tb.art.getContext('2d')!.getImageData(0, 0, tb.art.width, tb.art.height).data;
    const out: Array<[number, number, string, number]> = [];
    for (let y = 0; y < tb.height; y++) for (let x = 0; x < tb.width; x++) {
      const z = tb.z[y][x]; if (z === null) continue;
      const k = (y * tb.art.width + x) * 4; out.push([x, y, `rgb(${img[k]},${img[k + 1]},${img[k + 2]})`, z]);
    }
    return out;
  };
  const MM_PER_PX = 1 / (RD.pxPerMm * Math.cos(RD.el * Math.PI / 180)), DZ = Math.sin(RD.el * Math.PI / 180);
  const rings: Record<string, number[][]> = {};
  for (const [tag, cells] of Object.entries(fullData.tags)) {
    const set = new Set(cells.map(([x, y]) => x + ',' + y));
    rings[tag.replace('slot-1', '')] = cells.filter(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !set.has((x + dx) + ',' + (y + dy))));
  }
  const capTop = (slot: string): Pt => {
    const cells = fullData.tags['slot-1' + slot];
    const top = Math.min(...cells.map(([, y]) => y));
    const xs = cells.filter(([, y]) => y <= top + 1).map(([x]) => x);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, top];
  };
  const rack1 = (x: number, y: number, out: string[], lit: string[] = []) => {
    const v = variants[PICKS.filter(s => out.includes(s)).length];      // buildRack's patches go in PICKS order
    g.drawImage(v.art, x, y);
    kit.plate(x, y, 1, 1, false, g);
    g.fillStyle = C.focus;
    for (const s of lit) if (!out.includes(s)) for (const [px, py] of fullData.tags['slot-1' + s] ?? []) g.fillRect(x + px, y + py, 1, 1);
    g.fillStyle = C.accent;
    for (const s of lit) if (!out.includes(s)) for (const [px, py] of rings[s] ?? []) g.fillRect(x + px, y + py, 1, 1);
    return v;
  };
  const lifted = (s: string, n: number, x: number, y: number, depth: (number | null)[][]) => {
    const tb = tubes[s], L = n * MM_PER_PX;
    for (const [px, py, color, z] of tubePixels(s)) {
      const sx = tb.x + px, sy = tb.y + py - n;
      const behind = sy >= 0 && sy < depth.length ? depth[sy][sx] : null;
      if (behind !== null && behind > z + L * DZ + .25) continue;
      g.fillStyle = color; g.fillRect(x + sx, y + sy, 1, 1);
    }
  };
  const RACK_ROWS = BOM.map((_, k) => k).filter(inRack);

  // ---------- the film ----------
  const RX = 16, RY = DESK - 118;                                         // R1 up close, on the desk line
  // The desk scrolls under the pinned sheet: the camera's x (the desk moves right as it grows).
  const PAN_STEP = 400, DRAWER_O: Pt = [24, 124];
  const cam = (t: number) => PAN_STEP * (easeInOut(seg(t, PAN1[0], PAN1[1])) + easeInOut(seg(t, PAN2[0], PAN2[1])));
  const boardAt = (t: number): Pt => {
    const k = easeInOut(seg(t, BOARD_GO[0], BOARD_GO[1]));
    return [R(lerp((W - board.width) / 2, 8, k)), R(lerp((H - board.height) / 2, DESK - board.height - 8, k))];
  };
  const drawerO = (t: number): Pt => [R(DRAWER_O[0] - PAN_STEP + cam(t)), DRAWER_O[1]];
  const rackX = (t: number) => R(RX - 2 * PAN_STEP + cam(t));
  // the pile's order as the search leaves it: a bag looked under goes back on top
  const pileAt = (t: number) => {
    const order = BAGS.map((_, i) => i);
    for (const s of hunt) if (s.check && t >= s.leave) { order.splice(order.indexOf(s.bag), 1); order.push(s.bag); }
    return order;
  };
  /** The top of bag i's label, where the cursor looks, `up` mm lifted. */
  const bagTop = (o: Pt, i: number, up = 0): Pt => { const [u, v, lift] = BAGS[i]; return drawerAt(o, DZ0)(u, v, lift + up + 2); };
  /** The cursor in the drawer at t: [x, y, size, tilt], or null. */
  const huntCursor = (t: number, o: Pt): [number, number, number, number?] | null => {
    if (t < CUR_IN[0] || t >= CUR_OUT[1]) return null;
    const ABOVE = 14;
    const first = bagTop(o, hunt[0].bag);
    if (t < HUNT_AT) {
      // it comes in a square at a time, high over the pile
      return [first[0], first[1] - ABOVE - 10, R(lerp(0, 3, seg(t, CUR_IN[0], CUR_IN[1])))];
    }
    let p: Pt = [first[0], first[1] - ABOVE - 10];
    for (const s of hunt) {
      const up = s.check ? CHECK_UP * easeInOut(seg(t, s.arrive + 60, s.arrive + 260)) * (1 - easeInOut(seg(t, s.leave - 260, s.leave - 60))) : 0;
      const top = bagTop(o, s.bag, up), to: Pt = [top[0], top[1] - ABOVE];
      if (t < s.arrive) {
        const k = easeInOut(seg(t, s.arrive - HOP, s.arrive));
        return [lerp(p[0], to[0], k), lerp(p[1], to[1], k) - Math.sin(Math.PI * k) * 5, 3];
      }
      if (t < s.leave) return [to[0], to[1], 3];
      p = to;
    }
    // up out of the pile, then "no": the head swings, and sways a pixel with it
    const back = drawerAt(o, DZ0)(DR.w / 2, DR.d, DR.h + 26), j = easeInOut(seg(t, RISE[0], RISE[1]));
    const q: Pt = [lerp(p[0], back[0], j), lerp(p[1], back[1], j)];
    if (t < SHAKE[0]) return [q[0], q[1], 3];
    if (t < SHAKE[1]) { const a = TILTS[Math.floor((t - SHAKE[0]) / TILT_MS)]; return [q[0] + 2 * a, q[1], 3, a]; }
    const k = easeIn(seg(t, CUR_OUT[0], CUR_OUT[1]));
    return [q[0], q[1] - k * 12, R(lerp(3, 0, k))];
  };
  /** The bag the cursor holds up at t, and how far. */
  const heldAt = (t: number): [number, number] => {
    for (const s of hunt) if (s.check && t >= s.arrive && t < s.leave)
      return [s.bag, CHECK_UP * easeInOut(seg(t, s.arrive + 60, s.arrive + 260)) * (1 - easeInOut(seg(t, s.leave - 260, s.leave - 60)))];
    return [-1, 0];
  };

  // At R1 the cursor knows: it goes straight to each slot, a quick hop timed with that line's
  // pointer, and when the last is lit it comes back over the rack and nods twice.
  const HOP2 = POINT_MS;
  const rackCursor = (t: number, rx: number): [number, number, number] => {
    const home: Pt = [rx + 60, RY - 14];
    if (t < CUR_IN2[1]) return [home[0], home[1], R(lerp(0, 3, seg(t, CUR_IN2[0], CUR_IN2[1])))];
    let p = home;
    for (const k of RACK_ROWS) {
      const [cx, cy] = capTop(BOM[k][3]), to: Pt = [rx + cx, RY + cy - OVER], at = ROW2_AT(k) + 140;
      if (t < at) break;
      const j = easeInOut(seg(t, at, at + HOP2));
      if (j < 1) return [lerp(p[0], to[0], j), lerp(p[1], to[1], j) - Math.sin(Math.PI * j) * 4, 3];
      p = to;
    }
    if (t < HOME2[0]) return [p[0], p[1], 3];
    const j = easeInOut(seg(t, HOME2[0], HOME2[1]));
    if (j < 1) return [lerp(p[0], home[0], j), lerp(p[1], home[1], j) - Math.sin(Math.PI * j) * 4, 3];
    // "yes": down and up, twice
    const nod = t >= NOD[0] && t < NOD[1] ? [0, 2, 3, 1, 0, 2, 3, 1, 0, 0][Math.floor((t - NOD[0]) / 50)] : 0;
    return [home[0], home[1] + nod, 3];
  };

  // ---------- 3. the pick ----------
  const rowOf = (slot: string) => BOM.findIndex(r => r[3] === slot);
  const lineup = (slot: string) => SX + 8 + RACK_ROWS.indexOf(rowOf(slot)) * 28;   // under the sheet, in the line's place
  // how far each tube must rise to be clear of the rack (no pixel of it behind the rack any more),
  // but no higher than the top of the picture
  const clearOf = PICKS.map((s, i) => {
    const tb = tubes[s], depth = variants[i + 1].depth;
    for (let n = 0; n < 90; n++) {
      const L = n * MM_PER_PX;
      const hidden = tubePixels(s).some(([px, py, , z]) => {
        const sy = tb.y + py - n, behind = sy >= 0 && sy < depth.length ? depth[sy][tb.x + px] : null;
        return behind !== null && behind > z + L * DZ + .25;
      });
      if (!hidden) return Math.min(n + 2, RY + tb.y - 2);
    }
    return RY + tb.y - 2;
  });
  const OVER3 = 6;                                                        // the cursor over a tube's cap it is carrying
  const GAP_X = 158;                                                      // between R1 (to x 136) and the sheet (from 192)
  /** Where tube i is at t (its sprite's top left), and whether it is still in the rack. */
  const tubeAt = (i: number, t: number, rx: number): { p: Pt; inRack: boolean; n: number } | null => {
    const pk = PICK3[i], s = PICKS[i], tb = tubes[s];
    if (t < pk.lift[0]) return null;
    if (t < pk.carry[0]) { const n = R(easeInOut(seg(t, pk.lift[0], pk.lift[1])) * clearOf[i]); return { p: [rx + tb.x, RY + tb.y - n], inRack: true, n }; }
    // carried: out over the gap between the rack and the sheet, down to the desk there, and along
    // it to its place, so it passes neither through the rack nor across the sheet (the moves overlap)
    const k = seg(t, pk.carry[0], pk.carry[1]), from: Pt = [rx + tb.x, RY + tb.y - clearOf[i]], home: Pt = [lineup(s), DESK - tb.height - 1];
    const x = from[0] + (GAP_X - from[0]) * easeInOut(seg(k, 0, .45)) + (home[0] - GAP_X) * easeInOut(seg(k, .35, 1));
    const y = lerp(from[1], home[1], easeInOut(seg(k, .2, .75)));
    const dip = t >= pk.carry[1] && t < pk.carry[1] + 90 ? 1 : 0;      // it is set down: a pixel too far, then back
    return { p: [R(x), R(y) + dip], inRack: false, n: clearOf[i] };
  };
  const pickCursor = (t: number, rx: number): Pt => {
    const home: Pt = [rx + 60, RY - 14];
    let p = home;
    for (let i = 0; i < PICKS.length; i++) {
      const pk = PICK3[i], [cx, cy] = capTop(PICKS[i]), over: Pt = [rx + cx, RY + cy - OVER];
      if (t < pk.hop[0]) return p;
      if (t < pk.hop[1]) { const j = easeInOut(seg(t, pk.hop[0], pk.hop[1])); return [lerp(p[0], over[0], j), lerp(p[1], over[1], j) - Math.sin(Math.PI * j) * 6]; }
      const tb = tubes[PICKS[i]], at = tubeAt(i, t, rx);
      if (!at) return over;
      // riding the cap: over it as it rises, then just above it
      const ride = at.inRack ? OVER : lerp(OVER, OVER3, seg(t, pk.carry[0], pk.carry[0] + 200));
      p = [at.p[0] + (cx - tb.x), at.p[1] + (cy - tb.y) - ride];
    }
    const j = easeInOut(seg(t, HOME3[0], HOME3[1]));
    if (j <= 0) return p;
    return [lerp(p[0], home[0], j), lerp(p[1], home[1], j) - Math.sin(Math.PI * j) * 8 + (j >= 1 ? Math.floor((t - HOME3[1]) / 350) % 2 : 0)];
  };
  const OVER = 11;
  // the slot's tag, as the first half pinned it beside B3: a leader out from the cap, then the tag
  // opening from its middle; closed the same way, backwards
  const slotTag = (x0: number, y: number, open: number, label: string) => {
    const tx = x0 + 18, w = measure('bold', label) + 6;
    const reach = R(lerp(x0, tx, seg(open, 0, .6)));
    g.fillStyle = C.focus;
    for (let x = x0; x < reach; x += 2) g.fillRect(x, y + 6, 1, 1);
    const k = easeOut(seg(open, .6, 1));
    if (k <= 0) return;
    const h = Math.max(2, R(12 * k)), yy = y + R((12 - h) / 2);
    g.fillStyle = C.shadow; g.fillRect(tx + 1, yy + 1, w, h);
    g.fillStyle = C.focus; g.fillRect(tx, yy, w, h);
    if (k >= 1) text(g, 'bold', label, tx + 3, y + 10, C.ink);
  };

  /** Everything on the desk and the sheet at t; the cursor too unless `bare`. */
  function scene(t: number, bare = false) {
    const c = cam(t);
    // the desk, under the sheet: the board, the drawer, the rack, whichever are in frame
    const [bx, by] = boardAt(t);
    if (bx + c < W) g.drawImage(board, R(bx + c), by);
    const o = drawerO(t);
    if (o[0] > -200 && o[0] < W) {
      // a bag being looked under is off the pile, so it is drawn last
      const [held, up] = heldAt(t), order = pileAt(t).filter(i => i !== held);
      drawer(o, DZ0, held >= 0 ? [...order, held] : order, held, up);
    }
    const rx = rackX(t);
    // a slot stays lit until its tube is taken (the app's Find in racks blinks it until then)
    const out = PICKS.filter((_, i) => t >= PICK3[i].lift[0]);
    const lit = PICKS.filter(s => t >= ROW2_AT(rowOf(s)) + 140 + POINT_MS && !out.includes(s));
    const rack = rx > -130 ? rack1(rx, RY, out, lit) : null;
    // the sheet: printed, then the Where column, the usual answers, erased, the exact ones
    if (t >= PRINT[0]) {
      if (t < PRINT[1]) {
        // it prints out from its top edge, a pixel row at a time
        const h = R(seg(t, PRINT[0], PRINT[1]) * SH);
        g.drawImage(base(0), 0, 0, SW + 1, h, SX, SY, SW + 1, h);
        g.fillStyle = C.shadow; g.fillRect(SX + 1, SY + h, SW, 1);
      } else {
        const head = clamp(Math.floor((t - HEAD_AT) / 40) + 1, 0, 5);
        const usual = (k: number) => t < ERASE[0] ? typed(USUAL, t, ROW_AT(k), 18)
          : USUAL.slice(0, USUAL.length - Math.floor(seg(t, ERASE[0], ERASE[1]) * USUAL.length));
        const where = (k: number) => t < ERASE[1] ? (t >= ROW_AT(k) ? usual(k) : '') : t >= ROW2_AT(k) ? typed(exact(k), t, ROW2_AT(k), 28) : '';
        // in the pick, the line being picked is lit, and each is ticked as its tube is set down
        const cur = PICK3.findIndex(pk => t >= pk.hop[0] && t < pk.carry[1]);
        const done = PICKS.filter((_, i) => t >= PICK3[i].carry[1]).map(rowOf);
        drawSheet({ head, where, hi: cur >= 0 ? rowOf(PICKS[cur]) : undefined, done });
      }
    }
    // the usual answer's pointers: each line into the drawer, then all of them in, gone
    if (t >= ROW_AT(0) && t < POINTS_IN[1]) {
      const into = (k: number): Pt => { const P = drawerAt(o, DZ0); const p = P(DR.w / 2 + (k - 3.5) * 5, DR.d / 2, DR.h); return [R(p[0]), R(p[1])]; };
      BOM.forEach((_, k) => {
        const drawn = seg(t, ROW_AT(k) + 170, ROW_AT(k) + 170 + POINT_MS);
        if (drawn > 0) dotted(rowEnd(k), into(k), C.focus, easeInOut(seg(t, POINTS_IN[0], POINTS_IN[1])), drawn);
      });
    }
    const hc = huntCursor(t, o);
    if (hc) cursor(hc[0], hc[1], hc[2], hc[3]);
    // Inventatory's answer: each rack line's pointer to its slot; the cursor goes to each, then
    // nods; then all the pointers are taken back into the lines for the pick
    if (t >= CUR_IN2[0] && t < UNPOINT[1]) {
      const back = easeInOut(seg(t, UNPOINT[0], UNPOINT[1]));
      RACK_ROWS.forEach(k => {
        const drawn = seg(t, ROW2_AT(k) + 140, ROW2_AT(k) + 140 + POINT_MS);
        const [cx, cy] = capTop(BOM[k][3]);
        if (drawn > 0) dotted(rowEnd(k), [rx + cx, RY + cy + 3], C.focus, 0, drawn * (1 - back));
      });
    }
    // the pick: the tubes, rising out of the rack (depth-tested), carried, standing in a row
    if (t >= P3 && rack) {
      PICKS.forEach((s, i) => {
        const at = tubeAt(i, t, rx), pk = PICK3[i], tb = tubes[s];
        if (!at) return;
        if (at.inRack) lifted(s, at.n, rx, RY, rack.depth);
        else g.drawImage(tb.art, at.p[0], at.p[1]);
        // the line's pointer to the slot, out as the cursor goes there, back in as the tube rises
        const [cx, cy] = capTop(s);
        const drawn = seg(t, pk.hop[0], pk.hop[0] + 200), gone = easeInOut(seg(t, pk.lift[0], pk.lift[0] + 220));
        if (drawn > 0 && gone < 1) dotted(rowEnd(rowOf(s)), [rx + cx, RY + cy + 3], C.focus, 0, drawn * (1 - gone));
        // its slot, over it, once the cursor has gone on
        const next = PICK3[i + 1]?.hop[0] ?? HOME3[0];
        if (t >= next) text(g, 'tiny', typed(s, t, next, 60), at.p[0] + R((tb.width - measure('tiny', s)) / 2), at.p[1] - 3, C.accent);
        // the 10K: its tag, beside it in the air
        if (i === 0 && t >= pk.hold[0] && t < pk.hold[1]) {
          const open = seg(t, pk.hold[0] + 100, pk.hold[0] + 420) * (1 - seg(t, pk.hold[1] - 300, pk.hold[1] - 20));
          slotTag(rx + cx + 6, RY + cy - at.n - 8, open, 'R1-' + s);
        }
      });
    }
    if (t >= CUR_IN2[0] && !bare) {
      if (t < P3) { const [x, y, size] = rackCursor(t, rx); cursor(x, y, size); }
      else { const [x, y] = pickCursor(t, rx); cursor(x, y); }
    }
  }
  function render(t: number) {
    g.clearRect(0, 0, W, H);
    if (t < KIT_END) scene(t);
    else {
      // the sign-off picks the cursor up where the kit left it
      const L = t - KIT_END, held = KIT_END - 1;
      kit.sign(L, () => scene(held, true), pickCursor(held, rackX(held)));
      if (L >= SIGN_HELD) dither(g, seg(L, SIGN_HELD, SIGN_HELD + SIGN_OUT));
    }
    if (t < IN) dither(g, 1 - seg(t, 0, IN));
  }

  return { render };
}

// ---------- the comparator board: the LM393 comparator with hysteresis, its front copper routed
// from the schematic's nets, KiCad's silkscreen ----------
type Kind = 'mlcc' | 'res' | 'led' | 'soic' | 'hdr';
interface Fp { ref: string; kind: Kind; x: number; y: number }
const BOARD = { w: 92, h: 44 };
const FOOTPRINTS: Fp[] = [
  { ref: 'J1', kind: 'hdr', x: 8, y: 12 },
  { ref: 'R1', kind: 'res', x: 22, y: 6 }, { ref: 'R2', kind: 'res', x: 22, y: 34 }, { ref: 'R3', kind: 'res', x: 32, y: 14 },
  { ref: 'U1', kind: 'soic', x: 44, y: 14 },
  { ref: 'C1', kind: 'mlcc', x: 64, y: 10 }, { ref: 'R4', kind: 'res', x: 68, y: 18 },
  { ref: 'D1', kind: 'led', x: 66, y: 28 }, { ref: 'R5', kind: 'res', x: 76, y: 28 },
];
const fp = (ref: string) => FOOTPRINTS.find(f => f.ref === ref)!;
type Rect = [number, number, number, number];
function pads(f: Fp): Rect[] {
  switch (f.kind) {
    case 'mlcc': case 'res': case 'led': return [[f.x, f.y, 2, 2], [f.x + 3, f.y, 2, 2]];
    case 'hdr': return [0, 1, 2].map((i): Rect => [f.x - 2, f.y - 2 + i * 8, 5, 5]);
    case 'soic': return [0, 1, 2, 3].flatMap((i): Rect[] => [[f.x - 5, f.y + 2 + i * 4, 4, 2], [f.x + 13, f.y + 2 + i * 4, 4, 2]]);
  }
}
const COPPER: Pt[][] = [
  [[8, 12], [8, 3], [84, 3]], [[23, 7], [23, 3]], [[59, 17], [62, 17], [62, 3]], [[65, 11], [65, 3]], [[72, 19], [75, 16], [75, 3]], [[80, 29], [84, 25], [84, 3]],
  [[8, 28], [8, 41], [84, 41]], [[26, 35], [26, 41]], [[41, 29], [38, 32], [38, 41]], [[68, 11], [70, 13]],
  [[26, 7], [30, 11], [30, 25], [41, 25]], [[23, 35], [23, 32], [30, 25]], [[30, 15], [33, 15]],
  [[8, 20], [9, 21], [28, 21]], [[33, 21], [41, 21]],
  [[36, 15], [38, 17], [41, 17]], [[38, 17], [38, 13]], [[64, 23], [68, 19], [69, 19]], [[67, 29], [64, 26], [64, 23]], [[70, 29], [77, 29]],
];
const VIAS: Pt[] = [[28, 21], [33, 21], [38, 13], [64, 23], [70, 13]];
function boardArt(): Bitmap {
  const S = 3;
  const MASK = '#1f3a33', MASK_CU = '#285046', EDGE_LIT = '#33594f', EDGE_SIDE = '#10201c', GOLD = '#d8b56b', GOLD_DARK = '#9c8150', SILK = '#dfe2dc';
  const [c, cg] = bitmap(BOARD.w * S + 3, BOARD.h * S + 3);
  const b = (x: number, y: number, w: number, h: number, color: string) => { cg.fillStyle = color; cg.fillRect(x, y, w, h); };
  const bw = BOARD.w * S, bh = BOARD.h * S;
  b(3, 3, bw, bh, C.shadow);
  b(0, 0, bw, bh, EDGE_SIDE);
  b(0, 0, bw - 2, bh - 2, MASK);
  b(0, 0, bw - 2, 1, EDGE_LIT); b(0, 0, 1, bh - 2, EDGE_LIT);
  for (const [x, y] of [[0, 0], [bw - 1, 0], [0, bh - 1], [bw - 1, bh - 1]]) cg.clearRect(x, y, 1, 1);
  for (const route of COPPER) for (let i = 1; i < route.length; i++) {
    const [a, q] = [route[i - 1], route[i]], n = Math.max(Math.abs(q[0] - a[0]), Math.abs(q[1] - a[1])) * S;
    for (let j = 0; j <= n; j++) b(R(a[0] * S + (q[0] - a[0]) * S * j / n), R(a[1] * S + (q[1] - a[1]) * S * j / n), 2, 2, MASK_CU);
  }
  for (const [x, y] of VIAS) { b(x * S - 2, y * S - 2, 5, 5, GOLD_DARK); b(x * S - 1, y * S - 1, 3, 3, GOLD); b(x * S, y * S, 1, 1, C.ink); }
  for (const [x, y] of [[4, 4], [BOARD.w - 5, BOARD.h - 5]]) { b(x * S - 3, y * S - 3, 7, 7, GOLD_DARK); b(x * S - 2, y * S - 2, 5, 5, GOLD); b(x * S - 1, y * S - 1, 3, 3, C.ink); }
  const u = fp('U1');
  b(u.x * S - 1, u.y * S - 1, 12 * S + 2, 1, SILK); b(u.x * S - 1, (u.y + 16) * S, 12 * S + 2, 1, SILK);
  b(u.x * S + 2, u.y * S + 2, 2, 2, SILK);
  const j = fp('J1');
  b(j.x * S - 9, j.y * S - 9, 1, 24 * S - 4, SILK); b(j.x * S + 9, j.y * S - 9, 1, 24 * S - 4, SILK);
  text(cg, 'tiny', '+5V', j.x * S + 13, j.y * S + 3, SILK); text(cg, 'tiny', 'IN', j.x * S + 13, j.y * S + 27, SILK); text(cg, 'tiny', 'GND', j.x * S + 13, j.y * S + 51, SILK);
  for (const f of FOOTPRINTS) if (f.kind !== 'hdr' && f.kind !== 'soic') text(cg, 'tiny', f.ref, f.x * S + 1, f.y * S + 14, SILK);
  text(cg, 'tiny', 'U1', u.x * S + 14, u.y * S + 56, SILK);
  text(cg, 'tiny', 'COMPARATOR', 52 * S, 38 * S, SILK);
  text(cg, 'tiny', 'REV A', 52 * S, 38 * S + 7, SILK);
  for (const f of FOOTPRINTS) pads(f).forEach(([x, y, w, h], i) => {
    if (f.kind === 'hdr') {
      const cx = x * S + w * S / 2, cy = y * S + h * S / 2, r = 6.5;
      for (let yy = -7; yy <= 7; yy++) for (let xx = -7; xx <= 7; xx++) if (i === 0 ? Math.max(Math.abs(xx), Math.abs(yy)) <= 6 : xx * xx + yy * yy <= r * r) b(R(cx + xx), R(cy + yy), 1, 1, xx + yy > 4 ? GOLD_DARK : GOLD);
      for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) if (xx * xx + yy * yy <= 10) b(R(cx + xx), R(cy + yy), 1, 1, C.ink);
      return;
    }
    b(x * S, y * S, w * S, h * S, GOLD_DARK); b(x * S, y * S, w * S - 1, h * S - 1, GOLD);
  });
  return c;
}
