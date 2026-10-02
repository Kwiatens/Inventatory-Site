// Concept: "Build" — the second film. A board is laid out in KiCad and its BOM exported;
// Inventatory matches every line to stock; Find in racks lights the slots to open; the tubes
// come out of rack R1 in pick order; the parts go on the board; one key takes them out of
// stock. Same canvas, palette and rules as the intake film (film.ts): render(t) draws any
// moment, motion is smooth but lands on whole pixels, shots change with a dither dissolve.
//
// Accuracy: the BOM is the KiCad "Fabrication Outputs > BOM" export the desktop app's own
// tests use (project "Astro Arrow"). The comparison, the Find in racks screen (the rack's
// title in the app's block letters, the 5 x 5 grid, slots pulsing at 700 ms, the pick list,
// the next stop) and the end prompt follow BomProjectPageRender.cpp. The rack and its tubes
// are the CAD renders (scripts/pixel-art); a lifted tube is depth-tested against the rack.
import art from '../../data/pixel-art.json';
import { bitmap, fromCodes, text, measure, dither, C, type Bitmap } from './gfx';
import * as P from './props';
import { type SpriteData } from '../pixel';

export const W = 384, H = 192;
const DESK = 166;

// ---------- timeline (ms) ----------
// The PC shot runs KiCad, then Inventatory on the same screen; then the Find in racks
// close-up, the rack, the board, and the PC again for the stock.
const SWITCH = 4900, FIND = 9700, RACK_IN = 15200, BOARD_IN = 22200, DONE = 27200, END = DONE + 4600, PAUSE = 1000;
export const LOOP = END + PAUSE;
/** The frame to show still (reduced motion): Find in racks, its slots lit. */
export const POSTER = 14000;
/** Chapter starts, for the scrubber. */
export const CHAPTERS = [0, SWITCH, FIND, RACK_IN, BOARD_IN, DONE];
const CAPTIONS: Array<[number, number, string]> = [
  [300, SWITCH - 100, 'Lay out the board in KiCad; export its BOM.'],
  [SWITCH + 100, FIND - 300, 'Inventatory checks every line against stock.'],
  [FIND + 200, RACK_IN - 200, 'Find in racks: which tubes to take...'],
  [RACK_IN + 200, BOARD_IN - 200, '...and exactly where they are.'],
  [BOARD_IN + 200, DONE - 200, 'Everything the board needs, in hand.'],
  [DONE + 200, END - 700, 'One key takes it out of stock.'],
];

// ---------- timing helpers ----------
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeInOut = (k: number) => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const easeIn = (k: number) => k * k * k;
const R = Math.round;
type Pt = [number, number];

// ---------- the project: the BOM, as the app matches it ----------
// Where each line lives: rack R1 for the passives (one stop), a drawer for the module and the
// connector (the "Not in a rack" stop). Have = stock before the build.
interface Line { part: string; pkg: string; where: string; need: number; have: number; refs: string[] }
const LINES: Line[] = [
  { part: '1UF', pkg: '0603', where: 'R1-A2', need: 6, have: 40, refs: ['C1', 'C15', 'C16', 'C22', 'C23', 'C25'] },
  { part: '100NF', pkg: '0603', where: 'R1-C1', need: 2, have: 25, refs: ['C2', 'C4'] },
  { part: '0.01UF', pkg: '0603', where: 'R1-A4', need: 1, have: 12, refs: ['C9'] },
  { part: '100UF', pkg: 'RADIAL', where: 'R1-D1', need: 2, have: 8, refs: ['C19', 'C30'] },
  { part: '10K', pkg: '0603', where: 'R1-B3', need: 1, have: 100, refs: ['R1'] },
  { part: 'EPAPER', pkg: 'JST-PH', where: 'DRAWER 2', need: 1, have: 3, refs: ['U2'] },
  { part: 'ESP32-S3', pkg: 'MODULE', where: 'DRAWER 2', need: 1, have: 2, refs: ['U3'] },
];
const PIECES = LINES.reduce((n, l) => n + l.need, 0);
// Find in racks, stop 1: rack R1, its picks in the app's slot order.
const PICKS = ['A2', 'A4', 'B3', 'C1', 'D1'];
const lineAt = (slot: string) => LINES.find(l => l.where === 'R1-' + slot)!;
// What else rack R1 holds (the intake film's rack, filled A1..C3 and D1).
const RACK_R1: Record<string, [string, number]> = {
  A1: ['4.7UF', 18], A2: ['1UF', 40], A3: ['22PF', 30], A4: ['0.01UF', 12], A5: ['10UF', 15],
  B1: ['1K', 60], B2: ['4.7K', 45], B3: ['10K', 100], B4: ['100K', 52],
  C1: ['100NF', 25], C2: ['LED RED', 20], C3: ['BAT54', 10], D1: ['100UF', 8],
};

// ---------- the board, in KiCad pixels (one per screen pixel in the editor; x2 on the desk) ----------
type Kind = 'mlcc' | 'res' | 'elec' | 'module' | 'jst' | 'tp';
interface Fp { ref: string; kind: Kind; x: number; y: number }
const BOARD = { w: 128, h: 72 };
const MODULE = { x: 4, y: 4, w: 30, h: 44, antenna: 10 };
const FOOTPRINTS: Fp[] = [
  { ref: 'U3', kind: 'module', x: MODULE.x, y: MODULE.y },
  { ref: 'C1', kind: 'mlcc', x: 42, y: 10 }, { ref: 'C15', kind: 'mlcc', x: 42, y: 16 }, { ref: 'C16', kind: 'mlcc', x: 42, y: 22 },
  { ref: 'C22', kind: 'mlcc', x: 50, y: 10 }, { ref: 'C23', kind: 'mlcc', x: 50, y: 16 }, { ref: 'C25', kind: 'mlcc', x: 50, y: 22 },
  { ref: 'C2', kind: 'mlcc', x: 42, y: 28 }, { ref: 'C4', kind: 'mlcc', x: 50, y: 28 },
  { ref: 'C9', kind: 'mlcc', x: 42, y: 34 }, { ref: 'R1', kind: 'res', x: 50, y: 34 },
  { ref: 'C19', kind: 'elec', x: 67, y: 16 }, { ref: 'C30', kind: 'elec', x: 67, y: 34 },
  { ref: 'U2', kind: 'jst', x: 80, y: 56 },
  // REF** test points: on the board, left out of the BOM as non-orderable
  { ref: 'TP1', kind: 'tp', x: 84, y: 10 }, { ref: 'TP2', kind: 'tp', x: 92, y: 10 },
  { ref: 'TP3', kind: 'tp', x: 84, y: 18 }, { ref: 'TP4', kind: 'tp', x: 92, y: 18 },
];
const fp = (ref: string) => FOOTPRINTS.find(f => f.ref === ref)!;
// Pads (x, y, w, h), in KiCad pixels.
type Rect = [number, number, number, number];
function pads(f: Fp): Rect[] {
  switch (f.kind) {
    case 'mlcc': case 'res': return [[f.x, f.y, 2, 2], [f.x + 3, f.y, 2, 2]];
    case 'elec': return [[f.x - 3, f.y - 1, 2, 3], [f.x + 2, f.y - 1, 2, 3]];
    case 'tp': return [[f.x - 1, f.y - 1, 3, 3]];
    case 'jst': return Array.from({ length: 8 }, (_, i): Rect => [f.x + 1 + i * 4, f.y + 2, 2, 3]);
    case 'module': {
      const r: Rect[] = [];
      for (let i = 0; i < 13; i++) { const y = f.y + MODULE.antenna + 6 + i * 2; r.push([f.x, y, 2, 1], [f.x + MODULE.w - 2, y, 2, 1]); }
      for (let i = 0; i < 8; i++) r.push([f.x + 4 + i * 3, f.y + MODULE.h - 2, 1, 2]);
      return r;
    }
  }
}
// Copper, front (red) and back (blue): 45-degree routes between pads. Drawn in order while the
// board is being routed.
const F_CU: Pt[][] = [
  [[34, 20], [37, 20], [40, 17], [41, 17]], [[34, 22], [36, 22], [37, 23], [41, 23]], [[34, 28], [41, 28]], [[34, 34], [41, 34]],
  [[34, 26], [37, 26], [38, 25], [38, 11], [41, 11]],
  [[47, 11], [49, 11]], [[47, 17], [49, 17]], [[47, 23], [49, 23]], [[47, 29], [49, 29]],
  [[55, 11], [58, 11], [61, 14], [61, 16], [63, 16]], [[55, 35], [58, 35], [60, 33], [63, 33]], [[72, 16], [76, 16], [80, 12], [82, 12]],
  ...[0, 1, 2, 3].map((k): Pt[] => { const x = 8 + k * 3, y = 54 - 2 * k, pin = 81 + k * 4; return [[x, 48], [x, y], [pin, y], [pin, 57]]; }),
];
const B_CU: Pt[][] = [
  [[60, 44], [70, 44], [74, 48], [74, 51]], [[86, 14], [90, 14]], [[96, 18], [104, 18], [108, 22], [120, 22], [120, 46], [116, 50]],
];
const VIAS: Pt[] = [[60, 44], [74, 51], [96, 18], [116, 50]];

// The order the parts go on: the pick list's order, then the drawer.
const PLACE_GROUPS: Array<{ tag: string; label: string; refs: string[] }> = [
  ...PICKS.map(s => ({ tag: 'R1-' + s, label: lineAt(s).part + ' X' + lineAt(s).need, refs: lineAt(s).refs })),
  { tag: 'DRAWER 2', label: 'MODULE, JST', refs: ['U3', 'U2'] },
];

// The app's success and link colours (AppSettings.h), which the film palette has no use for.
const OK = '#a5c9a5', LINK = '#8fcbc5';
// KiCad's default colours for the layers shown.
const K = {
  bg: '#001023', fcu: '#c83434', bcu: '#4d7fc4', silk: '#f2eda1', edge: '#d0d2cd', via: '#c2c2c2',
  chrome: '#c9cdca', chromeDark: '#aeb3b0', chromeText: '#262c2b', select: '#3d7cc9',
};

export function createBuildFilm(canvas: HTMLCanvasElement) {
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;

  const monitor = P.monitor();
  const pcX = R((W - monitor.width) / 2), pcY = R((DESK - monitor.height) / 2);
  const SX = pcX + P.SCREEN.x, SY = pcY + P.SCREEN.y, SW = P.SCREEN.w, SH = P.SCREEN.h;

  // ---------- caption bar ----------
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
  const box = (x: number, y: number, w: number, h: number, color: string) => { g.fillStyle = color; g.fillRect(x, y, w, h); };
  const right = (font: 'tiny' | 'mono', str: string, x: number, y: number, color: string) => text(g, font, str, x - measure(font, str), y, color);

  // ---------- 1. KiCad: the board is routed, then File > Fabrication Outputs > BOM... ----------
  const ED = { x: SX + 8, y: SY + 9, w: SW - 8 - 26, h: SH - 9 - 6 };          // the editor's canvas
  const BX = ED.x + R((ED.w - BOARD.w) / 2), BY = ED.y + R((ED.h - BOARD.h) / 2);
  const ROUTE: Pt = [500, 2200];
  const routeLength = [...F_CU, ...B_CU].reduce((n, r) => n + r.length - 1, 0);
  const runs = (route: Pt[]) => route.slice(1).map((q, i) => [route[i], q] as [Pt, Pt]);
  // draw a route on whole pixels; `upto` = how many of its segments (fractional) are drawn
  const path = (route: Pt[], ox: number, oy: number, s: number, upto: number, color: string, wpx = 1) => {
    g.fillStyle = color;
    runs(route).forEach(([a, b], i) => {
      if (i >= upto) return;
      const k = Math.min(1, upto - i);
      const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) * s;
      for (let j = 0; j <= R(n * k); j++) {
        const x = a[0] * s + (b[0] - a[0]) * s * j / Math.max(1, n), y = a[1] * s + (b[1] - a[1]) * s * j / Math.max(1, n);
        g.fillRect(ox + R(x), oy + R(y), wpx, wpx);
      }
    });
  };
  const kicadBoard = (t: number) => {
    // edge cuts, cut corners
    g.fillStyle = K.edge;
    g.fillRect(BX + 1, BY, BOARD.w - 2, 1); g.fillRect(BX + 1, BY + BOARD.h - 1, BOARD.w - 2, 1);
    g.fillRect(BX, BY + 1, 1, BOARD.h - 2); g.fillRect(BX + BOARD.w - 1, BY + 1, 1, BOARD.h - 2);
    // copper, revealed segment by segment while it is routed
    let budget = seg(t, ROUTE[0], ROUTE[1]) * routeLength;
    for (const [routes, color] of [[F_CU, K.fcu], [B_CU, K.bcu]] as Array<[Pt[][], string]>) for (const r of routes) {
      const n = r.length - 1;
      path(r, BX, BY, 1, Math.min(n, budget), color);
      budget -= n;
    }
    if (t > ROUTE[1]) for (const [x, y] of VIAS) { box(BX + x - 1, BY + y - 1, 3, 3, K.via); box(BX + x, BY + y, 1, 1, K.bg); }
    // silkscreen: the module's outline and antenna keep-out, the capacitors' rings, the header
    g.fillStyle = K.silk;
    const m = MODULE;
    g.fillRect(BX + m.x + 2, BY + m.y, m.w - 4, 1); g.fillRect(BX + m.x + 2, BY + m.y + m.h - 1, m.w - 4, 1);
    g.fillRect(BX + m.x + 2, BY + m.y, 1, m.h); g.fillRect(BX + m.x + m.w - 3, BY + m.y, 1, m.h);
    for (let x = 3; x < m.w - 4; x += 2) g.fillRect(BX + m.x + x, BY + m.y + m.antenna, 1, 1);
    text(g, 'tiny', 'U3', BX + m.x + 12, BY + m.y + 28, K.silk);
    for (const f of FOOTPRINTS.filter(f => f.kind === 'elec')) {
      for (let a = 0; a < 40; a++) { const q = a / 40 * Math.PI * 2; g.fillRect(BX + f.x + R(Math.cos(q) * 5.5), BY + f.y + R(Math.sin(q) * 5.5), 1, 1); }
      g.fillRect(BX + f.x - 6, BY + f.y - 6, 1, 3); g.fillRect(BX + f.x - 7, BY + f.y - 5, 3, 1);
    }
    const j = fp('U2');
    g.fillRect(BX + j.x - 2, BY + j.y, 36, 1); g.fillRect(BX + j.x - 2, BY + j.y + 7, 36, 1);
    g.fillRect(BX + j.x - 2, BY + j.y, 1, 8); g.fillRect(BX + j.x + 33, BY + j.y, 1, 8);
    text(g, 'tiny', 'ASTRO ARROW', BX + 76, BY + 34, K.silk);
    text(g, 'tiny', 'REV A', BX + 76, BY + 41, K.silk);
    // pads on top
    for (const f of FOOTPRINTS) for (const [x, y, w, h] of pads(f)) box(BX + x, BY + y, w, h, K.fcu);
  };
  // The window: menu bar, a tool strip, the layer list, the status line.
  const kicadChrome = () => {
    box(SX, SY, SW, 8, K.chrome);
    let x = SX + 3;
    for (const word of ['FILE', 'EDIT', 'VIEW', 'PLACE', 'ROUTE', 'INSPECT', 'TOOLS']) { text(g, 'tiny', word, x, SY + 6, K.chromeText); x += measure('tiny', word) + 5; }
    box(SX, SY + 8, 8, SH - 14, K.chromeDark);
    for (let i = 0; i < 8; i++) box(SX + 2, SY + 11 + i * 9, 4, 4, i === 1 ? K.select : '#6f7774');
    box(SX + SW - 26, SY + 8, 26, SH - 14, K.chrome);
    ([['F.CU', K.fcu], ['B.CU', K.bcu], ['SILK', K.silk], ['EDGE', K.edge]] as Array<[string, string]>).forEach(([name, color], i) => {
      box(SX + SW - 23, SY + 12 + i * 8, 4, 4, color);
      text(g, 'tiny', name, SX + SW - 17, SY + 16 + i * 8, K.chromeText);
    });
    box(SX, SY + SH - 6, SW, 6, K.chromeDark);
    text(g, 'tiny', 'Z 2.4  X 64.0  Y 36.0', SX + 3, SY + SH - 1, K.chromeText);
    box(ED.x, ED.y - 1, ED.w, ED.h + 1, K.bg);
  };
  // The menu, the dialog and the pointer, each on its own clock.
  const MENU: Pt = [2750, 3600], SUB: Pt = [3150, 3600], DIALOG: Pt = [3650, 4300], OUT: Pt = [4350, 5300];
  const FILE_ITEMS = ['NEW', 'OPEN...', 'SAVE', 'PLOT...', 'FABRICATION OUTPUTS'], SUB_ITEMS = ['GERBERS...', 'DRILL FILES...', 'PLACEMENT...', 'BOM...'];
  const menuX = SX + 3, menuY = SY + 8, menuW = 88, subX = menuX + menuW - 2, subW = 62;
  const itemY = (i: number) => menuY + 2 + i * 8;
  const DLG = { x: SX + 30, y: SY + 34, w: 112, h: 40 };
  const FILENAME = 'astro-arrow-bom.csv';
  // the pointer's path: (time, x, y) keys, eased between them; clicks at the keys marked
  const PTR: Array<[number, number, number, boolean?]> = [
    [2200, SX + 120, SY + 70], [2700, menuX + 6, SY + 5], [2750, menuX + 6, SY + 5, true],
    [3050, menuX + 30, itemY(4) + 4], [3250, subX + 20, itemY(4) + 4], [3500, subX + 18, itemY(7) + 4], [3550, subX + 18, itemY(7) + 4, true],
    [3950, DLG.x + 70, DLG.y + 22], [4200, DLG.x + DLG.w - 18, DLG.y + DLG.h - 7], [4250, DLG.x + DLG.w - 18, DLG.y + DLG.h - 7, true],
    [4600, DLG.x + DLG.w + 30, DLG.y + DLG.h + 6],
  ];
  const pointerAt = (t: number): [Pt, boolean] | null => {
    if (t < PTR[0][0] || t > SWITCH - 200) return null;
    let i = PTR.findIndex(k => k[0] > t);
    if (i < 0) i = PTR.length;
    const a = PTR[Math.max(0, i - 1)], b = PTR[Math.min(PTR.length - 1, i)];
    const k = a === b ? 1 : easeInOut(seg(t, a[0], b[0]));
    const down = PTR.some(p => p[3] && t >= p[0] && t < p[0] + 120);
    return [[R(lerp(a[1], b[1], k)), R(lerp(a[2], b[2], k))], down];
  };
  const ARROW = ['#', '##', '#.#', '#..#', '#...#', '#....#', '#..###', '#.#', '##'];
  const pointer = (p: Pt, down: boolean) => {
    ARROW.forEach((row, j) => [...row].forEach((ch, i) => {
      box(p[0] + i, p[1] + j, 1, 1, ch === '#' ? C.ink : down ? C.focus : C.bone);
    }));
  };
  const menus = (t: number) => {
    if (t >= MENU[0] && t < MENU[1]) {
      box(menuX + 1, menuY + 1, menuW, FILE_ITEMS.length * 8 + 3, C.shadow);
      box(menuX, menuY, menuW, FILE_ITEMS.length * 8 + 3, K.chrome);
      box(menuX, SY, 18, 8, K.select); text(g, 'tiny', 'FILE', menuX, SY + 6, C.bone);
      FILE_ITEMS.forEach((item, i) => {
        const on = i === 4 && t >= 3050;
        if (on) box(menuX + 1, itemY(i) - 1, menuW - 2, 8, K.select);
        text(g, 'tiny', item, menuX + 4, itemY(i) + 5, on ? C.bone : K.chromeText);
      });
      text(g, 'tiny', '>', menuX + menuW - 6, itemY(4) + 5, t >= 3050 ? C.bone : K.chromeText);
    }
    if (t >= SUB[0] && t < SUB[1]) {
      const y0 = itemY(4) - 2;
      box(subX + 1, y0 + 1, subW, SUB_ITEMS.length * 8 + 3, C.shadow);
      box(subX, y0, subW, SUB_ITEMS.length * 8 + 3, K.chrome);
      SUB_ITEMS.forEach((item, i) => {
        const on = i === 3 && t >= 3450;
        if (on) box(subX + 1, y0 + 1 + i * 8, subW - 2, 8, K.select);
        text(g, 'tiny', item, subX + 4, y0 + 7 + i * 8, on ? C.bone : K.chromeText);
      });
    }
    if (t >= DIALOG[0] && t < DIALOG[1]) {
      const d = DLG;
      box(d.x + 2, d.y + 2, d.w, d.h, C.shadow);
      box(d.x, d.y, d.w, d.h, K.chrome); box(d.x, d.y, d.w, 8, K.chromeDark);
      text(g, 'tiny', 'SAVE BOM', d.x + 4, d.y + 6, K.chromeText);
      box(d.x + 4, d.y + 13, d.w - 8, 9, '#f4f5f3');
      const typed = R(seg(t, DIALOG[0] + 50, DIALOG[0] + 350) * FILENAME.length);
      text(g, 'tiny', FILENAME.slice(0, typed).toUpperCase(), d.x + 6, d.y + 20, K.chromeText);
      const pressed = t >= 4250;
      box(d.x + d.w - 30, d.y + d.h - 12, 26, 9, pressed ? '#2c5f9e' : K.select);
      text(g, 'tiny', 'SAVE', d.x + d.w - 25, d.y + d.h - 5, C.bone);
    }
  };

  // The exported file: a sheet with a folded corner and CSV rows. It rises out of the screen,
  // waits above the monitor while the app comes up, and drops into it.
  const csv = (() => {
    const [c, cg] = bitmap(19, 23);
    cg.fillStyle = C.bone; cg.fillRect(0, 0, 18, 22);
    cg.clearRect(13, 0, 5, 5);
    cg.fillStyle = C.paper2; for (let i = 0; i < 5; i++) cg.fillRect(13, i, i + 1, 1);
    cg.fillStyle = C.steel; for (let r = 0; r < 4; r++) { cg.fillRect(3, 9 + r * 3, 5, 1); cg.fillRect(9, 9 + r * 3, 3, 1); cg.fillRect(13, 9 + r * 3, 2, 1); }
    cg.fillStyle = C.accent; cg.fillRect(2, 2, 9, 5);
    text(cg, 'tiny', 'CSV', 3, 7, C.ink);
    const [s, sg] = bitmap(20, 24);
    sg.fillStyle = C.shadow; sg.fillRect(1, 1, 18, 22); sg.drawImage(c, 0, 0);
    sg.clearRect(14, 1, 5, 4);
    return s;
  })();
  const FILE_REST: Pt = [pcX + monitor.width + 12, pcY + 8];
  const DROP: Pt = [5350, 5800];
  const filePos = (t: number): Pt | null => {
    const from: Pt = [DLG.x + DLG.w / 2 - 10, DLG.y + 10];
    if (t < OUT[0] || t >= DROP[1]) return null;
    if (t < DROP[0]) {
      const k = easeInOut(seg(t, OUT[0], OUT[0] + 650));
      const bob = t > OUT[0] + 650 ? (Math.floor((t - OUT[0]) / 300) % 2) : 0;
      return [R(lerp(from[0], FILE_REST[0], k)), R(lerp(from[1], FILE_REST[1], k) - Math.sin(k * Math.PI) * 14) + bob];
    }
    const k = easeIn(seg(t, DROP[0], DROP[1]));
    return [R(lerp(FILE_REST[0], SX + SW / 2 - 10, k)), R(lerp(FILE_REST[1], SY + 40, k) - Math.sin(k * Math.PI) * 12)];
  };

  // ---------- 2. Inventatory: the BOM against stock ----------
  // The app's header (as in the intake film), the project line, then the comparison table.
  const TABLE_AT = 5900, ROW_STEP = 330, SUMMARY = TABLE_AT + LINES.length * ROW_STEP + 150, PRESS = 9050;
  const appHeader = (state: string, stateColor: string) => {
    const x0 = SX + 6, y0 = SY;
    g.fillStyle = C.accent;
    [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]].forEach(([x, y]) => g.fillRect(x0 + x, y0 + 4 + y, 1, 1));
    g.fillRect(x0 + 4, y0 + 4, 1, 5);
    text(g, 'mono', 'INVENTATORY', x0 + 9, y0 + 10, C.text);
    right('tiny', state, x0 + SW - 12, y0 + 10, stateColor);
    box(x0, y0 + 13, SW - 12, 1, C.divider);
  };
  const COL = { part: 1, pkg: 38, where: 64, need: 98, status: 139 };
  const pad = (n: number, w: number) => String(n).padStart(w, '0');
  const needHave = (l: Line, have: number) => { const w = l.need > 99 || have > 99 ? 3 : 2; return pad(l.need, w) + '/' + pad(have, w); };
  // the table; `have(i)` gives each line's stock (it changes at the end), `fresh(i)` lights a count
  const table = (t: number, shownRows: number, have: (i: number) => number, fresh: (i: number) => boolean) => {
    const x0 = SX + 6, y0 = SY;
    text(g, 'mono', 'ASTRO ARROW', x0 + 1, y0 + 23, C.text);
    box(x0 + 62, y0 + 17, 32, 8, C.raised);
    text(g, 'tiny', '1 BOARD', x0 + 64, y0 + 23, C.focus);
    const cols: Array<[string, number]> = [['PART', COL.part], ['PKG', COL.pkg], ['WHERE', COL.where], ['NEED/HAVE', COL.need], ['STATUS', COL.status - 3]];
    box(x0, y0 + 27, SW - 12, 7, C.raised);
    for (const [name, x] of cols) text(g, 'tiny', name, x0 + x, y0 + 33, C.muted);
    if (shownRows > 0) text(g, 'tiny', 'IN STOCK', x0 + 1, y0 + 41, OK);
    LINES.forEach((l, i) => {
      if (i >= shownRows) return;
      const y = y0 + 49 + i * 7;
      // the 10K: the part the intake film put away
      if (l.where === 'R1-B3') box(x0, y - 6, SW - 12, 7, C.raised);
      text(g, 'tiny', l.part, x0 + COL.part + 3, y, C.text);
      text(g, 'tiny', l.pkg, x0 + COL.pkg, y, C.secondary);
      text(g, 'tiny', l.where, x0 + COL.where, y, l.where.startsWith('R1') ? C.accent : LINK);
      text(g, 'tiny', needHave(l, have(i)), x0 + COL.need, y, fresh(i) ? C.focus : OK);
      text(g, 'tiny', 'READY', x0 + COL.status, y, OK);
    });
  };
  const findButton = (t: number) => {
    const x0 = SX + 6, y = SY + SH - 11;
    if (t < SUMMARY) return;
    const pressed = t >= PRESS && t < PRESS + 220;
    const pulse = t < PRESS && Math.floor((t - SUMMARY) / 350) % 2 === 1;
    box(x0, y, 66, 9, pressed ? C.focus : pulse ? C.focus : C.accent);
    text(g, 'tiny', 'FIND IN RACKS', x0 + 3, y + 7, C.ink);
    text(g, 'tiny', 'F', x0 + 60, y + 7, C.ink);
    const summary = `${LINES.length} READY  0 MISSING`;
    const typed = R(seg(t, SUMMARY, SUMMARY + summary.length * 25) * summary.length);
    right('tiny', summary.slice(0, typed).padEnd(summary.length), x0 + SW - 12, y + 7, OK);
  };

  function shotPc(t: number) {
    g.drawImage(monitor, pcX, pcY);
    if (t < SWITCH + 150) {
      kicadChrome();
      g.save(); g.beginPath(); g.rect(ED.x, ED.y, ED.w, ED.h); g.clip();
      kicadBoard(t);
      g.restore();
      menus(t);
    } else {
      appHeader('PROJECTS', C.muted);
      table(t, Math.max(0, Math.min(LINES.length, Math.floor((t - TABLE_AT) / ROW_STEP) + 1)), i => LINES[i].have, i => {
        const at = TABLE_AT + i * ROW_STEP;
        return t >= at && t < at + 200;
      });
      findButton(t);
    }
    // KiCad gives way to Inventatory on the same screen
    if (t >= SWITCH - 200 && t < SWITCH + 300) {
      ditherRect(SX, SY, SW, SH, t < SWITCH + 50 ? seg(t, SWITCH - 200, SWITCH + 50) : 1 - seg(t, SWITCH + 50, SWITCH + 300));
    }
    const f = filePos(t);
    if (f) g.drawImage(csv, f[0], f[1]);
    // the file lands: a ring opens where it went in
    if (t >= DROP[1] && t < DROP[1] + 300) {
      const k = seg(t, DROP[1], DROP[1] + 300), r = R(4 + k * 16);
      g.fillStyle = C.focus; g.globalAlpha = 1 - k;
      for (let i = 0; i < 28; i++) g.fillRect(R(SX + SW / 2 + Math.cos(i / 28 * 6.283) * r), R(SY + 51 + Math.sin(i / 28 * 6.283) * r * .7), 1, 1);
      g.globalAlpha = 1;
    }
    const p = pointerAt(t);
    if (p) pointer(p[0], p[1]);
  }
  // erase `amount` of a rectangle with the film's ordered dither (a dissolve inside the screen)
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const ditherRect = (x: number, y: number, w: number, h: number, amount: number) => {
    const level = R(clamp(amount) * 16);
    if (!level) return;
    g.fillStyle = C.ink;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (BAYER[((y + j) % 4) * 4 + ((x + i) % 4)] < level) g.fillRect(x + i, y + j, 1, 1);
  };

  // ---------- 3. Find in racks, close up: the app's own screen ----------
  // Rack titles are drawn in the app's block letters (BomProjectPageRender: bomRackGlyph).
  const BLOCK: Record<string, [number, string[]]> = {
    R: [4, ['1110', '1001', '1110', '1010', '1001']], A: [4, ['0110', '1001', '1111', '1001', '1001']],
    C: [4, ['0111', '1000', '1000', '1000', '0111']], K: [4, ['1001', '1010', '1100', '1010', '1001']],
    '1': [4, ['0100', '1100', '0100', '0100', '1110']], ' ': [2, ['00', '00', '00', '00', '00']],
  };
  const blockTitle = (str: string, cx: number, y: number, px: number, color: string) => {
    const width = [...str].reduce((w, ch) => w + BLOCK[ch][0], 0) + str.length - 1;
    let x = R(cx - width * px / 2);
    g.fillStyle = color;
    for (const ch of str) {
      const [w, rows] = BLOCK[ch];
      rows.forEach((row, j) => [...row].forEach((v, i) => { if (v === '1') g.fillRect(x + i * px, y + j * px, px, px); }));
      x += (w + 1) * px;
    }
  };
  const FR = { x: 6, y: 4, w: W - 12, h: DESK - 10 };                   // the screen, close up
  const IN = { x: FR.x + 5, y: FR.y + 5, w: FR.w - 10, h: FR.h - 10 };
  const GRID = { x: IN.x + 2, y: IN.y + 17, cw: 44, ch: 25 };
  const SIDE = { x: GRID.x + 5 * 45 + 2, w: IN.x + IN.w - (GRID.x + 5 * 45 + 2) - 2 };
  const LIST_AT = FIND + 500, LIST_STEP = 260;
  const blinkOn = (t: number) => Math.floor(t / 700) % 2 === 0;           // uiBlinkOn(700)
  const pickRow = (s: string) => PICKS.indexOf(s);
  function findScreen(t: number, picked: number) {
    box(FR.x, FR.y, FR.w, FR.h, '#5d6865');
    box(FR.x + 3, FR.y + 3, FR.w - 6, FR.h - 6, C.raised);
    box(IN.x, IN.y, IN.w, IN.h, C.ink);
    // header: the project, then where the walk is
    text(g, 'mono', 'ASTRO ARROW', IN.x + 3, IN.y + 9, C.text);
    const where = `STOP 1 OF 2  ${picked} / ${PIECES} PIECES`;
    right('tiny', where, IN.x + IN.w - 3, IN.y + 9, C.secondary);
    box(IN.x, IN.y + 13, IN.w, 1, C.divider);
    // the rack: five by five, the slots this build needs pulsing together
    const blink = blinkOn(t - FIND);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const slot = 'ABCDE'[r] + (c + 1);
      const x = GRID.x + c * 45, y = GRID.y + r * 26;
      const item = RACK_R1[slot], lit = PICKS.includes(slot) && t >= FIND + 300;
      box(x, y, GRID.cw, GRID.ch, lit ? (blink ? C.active : C.surface) : C.canvas);
      const name = item ? item[0] : '[ EMPTY ]';
      const font = item ? 'mono' : 'tiny';
      text(g, font, name, x + R((GRID.cw - measure(font, name)) / 2), y + 13, item ? C.text : C.divider);
      if (item) text(g, 'tiny', 'QTY ' + item[1], x + 2, y + 23, lit && blink ? C.text : C.secondary);
      else text(g, 'tiny', 'FREE', x + 2, y + 23, C.divider);
      right('tiny', slot, x + GRID.cw - 2, y + 23, lit ? (blink ? C.text : OK) : item ? C.accent : C.muted);
      if (c < 4) box(x + GRID.cw, y, 1, GRID.ch, C.divider);
      if (r < 4) box(x, y + GRID.ch, GRID.cw + 1, 1, C.divider);
    }
    box(SIDE.x - 2, IN.y + 14, 1, IN.h - 14, C.divider);
    // the stop: the rack's name in block letters, then its picks
    box(SIDE.x, IN.y + 15, SIDE.w, 23, C.active);
    blockTitle('RACK 1', SIDE.x + SIDE.w / 2, IN.y + 19, 3, C.focus);
    box(SIDE.x, IN.y + 38, SIDE.w, 1, C.divider);
    box(SIDE.x, IN.y + 39, SIDE.w, 8, C.raised);
    ([['SLOT', 3], ['PART', 25], ['PACKAGE', 67]] as Array<[string, number]>).forEach(([n, x]) => text(g, 'tiny', n, SIDE.x + x, IN.y + 45, C.muted));
    right('tiny', 'NEED', SIDE.x + SIDE.w - 3, IN.y + 45, C.muted);
    PICKS.forEach((s, i) => {
      const at = LIST_AT + i * LIST_STEP;
      if (t < at) return;
      const l = lineAt(s), y = IN.y + 57 + i * 11;
      if (t < at + 160) box(SIDE.x, y - 8, SIDE.w, 10, C.hover);
      text(g, 'mono', s, SIDE.x + 3, y, C.accent);
      text(g, 'mono', l.part, SIDE.x + 25, y, C.text);
      text(g, 'mono', l.pkg, SIDE.x + 67, y, C.muted);
      right('mono', 'X' + l.need, SIDE.x + SIDE.w - 3, y, C.focus);
    });
    box(SIDE.x, IN.y + IN.h - 27, SIDE.w, 1, C.divider);
    text(g, 'tiny', 'NEXT: NOT IN A RACK  2 SLOTS', SIDE.x + 3, IN.y + IN.h - 18, C.muted);
    box(SIDE.x + 3, IN.y + IN.h - 12, 70, 9, C.accent);
    text(g, 'tiny', 'NEXT STOP  ENTER', SIDE.x + 6, IN.y + IN.h - 5, C.ink);
    box(SIDE.x + 76, IN.y + IN.h - 12, 44, 9, C.raised);
    text(g, 'tiny', 'BACK  BKSP', SIDE.x + 79, IN.y + IN.h - 5, C.secondary);
  }
  function shotFind(t: number) { findScreen(t, 0); }

  // ---------- 4. The rack: the same slots pulse, the tubes come out in pick order ----------
  type Tube = SpriteData & { x: number; y: number; depth: string[] };
  const RD = art.buildRack as unknown as { z0: number; pxPerMm: number; el: number; depth: string[]; gone: Array<Array<[number, number, string, string]>>; tubes: Record<string, Tube> };
  const fullData = art.filmRackFull as unknown as SpriteData & { tags: Record<string, number[][]> };
  const zOf = (s: string, i: number) => s[2 * i] === '.' ? null : (parseInt(s.slice(2 * i, 2 * i + 2), 36) + RD.z0) / 2;
  // the rack as each tube leaves: codes and depth, with the cumulative patches applied
  const variants = [-1, ...PICKS.map((_, k) => k)].map(k => {
    const rows = fullData.rows.map(r => [...r]);
    const depth = RD.depth.map(r => Array.from({ length: r.length / 2 }, (_, i) => zOf(r, i)));
    if (k >= 0) for (const [x, y, code, z] of RD.gone[k]) { rows[y][x] = code; depth[y][x] = zOf(z, 0); }
    return { art: fromCodes({ width: fullData.width, height: fullData.height, rows: rows.map(r => r.join('')) } as SpriteData), depth };
  });
  const tubes = PICKS.map(s => {
    const d = RD.tubes[s];
    return { ...d, art: fromCodes(d), z: d.depth.map(r => Array.from({ length: r.length / 2 }, (_, i) => zOf(r, i))) };
  });
  // each tube's pixels, for the depth test (drawn one by one while it is in the rack)
  const tubePixels = tubes.map(tb => {
    const ctx = tb.art.getContext('2d')!, img = ctx.getImageData(0, 0, tb.art.width, tb.art.height).data;
    const out: Array<[number, number, string, number]> = [];
    for (let y = 0; y < tb.height; y++) for (let x = 0; x < tb.width; x++) {
      const z = tb.z[y][x];
      if (z === null) continue;
      const k = (y * tb.art.width + x) * 4;
      out.push([x, y, `rgb(${img[k]},${img[k + 1]},${img[k + 2]})`, z]);
    }
    return out;
  });
  const RX = 44, RY = DESK - 118;                                     // the rack, on the desk line
  // each tube rises clear of its neighbours, but stays in the picture (the back row is near the top)
  const LIFT_MAX = 62, MM_PER_PX = 1 / (RD.pxPerMm * Math.cos(RD.el * Math.PI / 180)), DZ = Math.sin(RD.el * Math.PI / 180);
  const PICK_AT = (i: number) => RACK_IN + 900 + i * 1050;
  const LIFT = 480, CARRY = 520;
  const lineupX = (i: number) => 214 + i * 28;
  const liftPx = (i: number) => Math.min(LIFT_MAX, RY + tubes[i].y - 3);
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
  // the film's cursor: the lockup's prompt, turned to point down, in 3 px squares
  const chevron = (cx: number, cy: number, color: string) => {
    g.fillStyle = color;
    for (const [i, j] of [[0, 0], [1, 1], [2, 2], [3, 1], [4, 0]]) g.fillRect(R(cx - 7.5) + i * 3, R(cy - 4.5) + j * 3, 3, 3);
  };
  const cursorOver = (slot: string, t: number, y0: number) => {
    const [cx, cy] = capTop(slot);
    const bob = Math.floor(t / 250) % 2;
    chevron(RX + cx + 1, RY + cy - 9 + bob + 1 + y0, C.shadow);
    chevron(RX + cx, RY + cy - 9 + bob + y0, C.accent);
  };
  // a tube on its way: lifted n pixels straight up (depth-tested against the rack while it is in
  // it), or carried to the desk (drawn whole)
  const drawLifted = (i: number, n: number, rack: { depth: (number | null)[][] }) => {
    const tb = tubes[i], L = n * MM_PER_PX;
    for (const [x, y, color, z] of tubePixels[i]) {
      const sx = tb.x + x, sy = tb.y + y - n;
      const behind = sy >= 0 && sy < rack.depth.length ? rack.depth[sy][sx] : null;
      if (behind !== null && behind > z + L * DZ + .25) continue;
      g.fillStyle = color; g.fillRect(RX + sx, RY + sy, 1, 1);
    }
  };
  function shotRack(t: number) {
    // which tubes are out
    const out = PICKS.filter((_, i) => t >= PICK_AT(i)).length;
    const rack = variants[out];
    g.drawImage(rack.art, RX, RY);
    // the slots to open pulse with the app, until their tube is taken
    const blink = blinkOn(t - FIND);
    PICKS.forEach((s, i) => {
      if (t >= PICK_AT(i) || t < RACK_IN + 300 || !blink) return;
      g.fillStyle = C.focus;
      for (const [x, y] of rings[s] ?? []) g.fillRect(RX + x, RY + y, 1, 1);
    });
    // the tubes: lifted, carried, then standing on the desk with their slot over them
    PICKS.forEach((s, i) => {
      const at = PICK_AT(i), tb = tubes[i];
      if (t < at) return;
      const home: Pt = [lineupX(i), DESK - tb.height - 1];
      if (t < at + LIFT) { drawLifted(i, R(easeInOut(seg(t, at, at + LIFT)) * liftPx(i)), rack); return; }
      const k = easeInOut(seg(t, at + LIFT, at + LIFT + CARRY));
      const from: Pt = [RX + tb.x, RY + tb.y - liftPx(i)];
      const x = R(lerp(from[0], home[0], k)), y = R(lerp(from[1], home[1], k) - Math.sin(k * Math.PI) * 10);
      g.drawImage(tb.art, x, y);
      if (k >= 1) {
        const shown = R(seg(t, at + LIFT + CARRY, at + LIFT + CARRY + 200) * 2);
        text(g, 'tiny', s.slice(0, shown), x + R((tb.width - measure('tiny', s)) / 2), y - 4, C.accent);
      }
    });
    // the cursor goes to each slot in turn (over the tubes, which pass under it)
    const cur = PICKS.findIndex((_, i) => t < PICK_AT(i) + LIFT);
    if (cur >= 0 && t >= RACK_IN + 500) {
      const lift = t >= PICK_AT(cur) ? R(easeInOut(seg(t, PICK_AT(cur), PICK_AT(cur) + LIFT)) * liftPx(cur)) : 0;
      cursorOver(PICKS[cur], t, -lift);
    }
  }

  // ---------- 5. The board: the parts go on, a pick at a time ----------
  const S = 2, OBX = R((W - BOARD.w * S) / 2) + 26, OBY = R((DESK - BOARD.h * S) / 2);
  const PLACE_AT = BOARD_IN + 500, GROUP = 620, EACH = 70, DROP_MS = 220;
  const placedAt = (ref: string) => {
    const gi = PLACE_GROUPS.findIndex(gr => gr.refs.includes(ref));
    return PLACE_AT + gi * GROUP + PLACE_GROUPS[gi].refs.indexOf(ref) * EACH;
  };
  // a green solder mask (dark, toward the palette's teal), copper a shade lighter under it
const MASK = '#1f3a33', MASK_CU = '#285046', EDGE_LIT = '#33594f', EDGE_SIDE = '#10201c', GOLD = '#d8b56b', GOLD_DARK = '#9c8150', SILK = '#dfe2dc';
  const physicalBoard = (() => {
    const [c, cg] = bitmap(BOARD.w * S + 1, BOARD.h * S + 1);
    const b = (x: number, y: number, w: number, h: number, color: string) => { cg.fillStyle = color; cg.fillRect(x, y, w, h); };
    // the board's top, lit along its near edges, and its thickness below and to the right
    const bw = BOARD.w * S, bh = BOARD.h * S;
    b(2, 2, bw, bh, C.shadow);
    b(0, 0, bw, bh, EDGE_SIDE);
    b(0, 0, bw - 2, bh - 2, MASK);
    b(0, 0, bw - 2, 1, EDGE_LIT); b(0, 0, 1, bh - 2, EDGE_LIT);
    for (const [x, y] of [[0, 0], [bw - 1, 0], [0, bh - 1], [bw - 1, bh - 1]]) cg.clearRect(x, y, 1, 1);
    // copper under the mask: a shade lighter, both layers
    for (const route of [...F_CU, ...B_CU]) for (const [a, q] of runs(route)) {
      const n = Math.max(Math.abs(q[0] - a[0]), Math.abs(q[1] - a[1])) * S;
      for (let j = 0; j <= n; j++) b(R(a[0] * S + (q[0] - a[0]) * S * j / n), R(a[1] * S + (q[1] - a[1]) * S * j / n), 2, 2, MASK_CU);
    }
    for (const [x, y] of VIAS) { b(x * S - 2, y * S - 2, 5, 5, GOLD_DARK); b(x * S - 1, y * S - 1, 3, 3, GOLD); b(x * S, y * S, 1, 1, C.ink); }
    // silkscreen
    cg.fillStyle = SILK;
    // the module's corners, just outside its pads
    const m = MODULE, mx0 = m.x * S - 3, my0 = m.y * S - 3, mx1 = (m.x + m.w) * S + 2, my1 = (m.y + m.h) * S + 2;
    for (const [cx, cy, dx, dy] of [[mx0, my0, 1, 1], [mx1, my0, -1, 1], [mx0, my1, 1, -1], [mx1, my1, -1, -1]]) {
      cg.fillRect(Math.min(cx, cx + dx * 5), cy, 6, 1); cg.fillRect(cx, Math.min(cy, cy + dy * 5), 1, 6);
    }
    for (const f of FOOTPRINTS.filter(f => f.kind === 'elec')) {
      for (let a = 0; a < 90; a++) { const q = a / 90 * Math.PI * 2; cg.fillRect(f.x * S + R(Math.cos(q) * 12.5), f.y * S + R(Math.sin(q) * 12.5), 1, 1); }
      cg.fillRect(f.x * S - 13, f.y * S - 12, 1, 5); cg.fillRect(f.x * S - 15, f.y * S - 10, 5, 1);
    }
    text(cg, 'tiny', 'ASTRO ARROW', 76 * S, 34 * S, SILK);
    text(cg, 'tiny', 'REV A', 76 * S, 34 * S + 8, SILK);
    for (const f of FOOTPRINTS) {
      if (f.kind === 'module' || f.kind === 'tp') continue;
      const [x, y] = f.kind === 'jst' ? [f.x * S, f.y * S - 4] : f.kind === 'elec' ? [f.x * S + 10, f.y * S - 15] : [f.x * S + 11, f.y * S + 4];
      if (f.kind !== 'mlcc' && f.kind !== 'res') text(cg, 'tiny', f.ref, x, y, SILK);
    }
    // pads: gold, lit on top
    for (const f of FOOTPRINTS) for (const [x, y, w, h] of pads(f)) {
      b(x * S, y * S, w * S, h * S, GOLD_DARK); b(x * S, y * S, w * S - 1, h * S - 1, GOLD);
    }
    return c;
  })();
  // the parts, each drawn once
  const partArt = (f: Fp): Bitmap => {
    const draw = (w: number, h: number, paint: (b: (x: number, y: number, w: number, h: number, color: string) => void, cg: CanvasRenderingContext2D) => void) => {
      const [c, cg] = bitmap(w, h);
      paint((x, y, w2, h2, color) => { cg.fillStyle = color; cg.fillRect(x, y, w2, h2); }, cg);
      const [s, sg] = bitmap(w + 1, h + 1);
      sg.drawImage(c, 1, 1); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = C.shadow; sg.fillRect(0, 0, w + 1, h + 1);
      sg.globalCompositeOperation = 'source-over'; sg.drawImage(c, 0, 0);
      return s;
    };
    switch (f.kind) {
      case 'mlcc': return draw(10, 4, b => { b(0, 0, 10, 4, '#b8b2a6'); b(2, 0, 6, 4, '#a07e55'); b(2, 0, 6, 1, '#b8935f'); });
      case 'res': return draw(10, 4, b => { b(0, 0, 10, 4, '#b8b2a6'); b(2, 0, 6, 4, '#1b201f'); b(3, 1, 4, 1, '#58605d'); });
      case 'elec': return draw(23, 23, (b) => {
        for (let y = 0; y < 23; y++) for (let x = 0; x < 23; x++) {
          const d = Math.hypot(x - 11, y - 11);
          if (d > 11.3) continue;
          const shade = d > 9.8 ? '#7d8783' : (x + y < 20 ? '#d9ddd9' : '#b9c0bc');
          b(x, y, 1, 1, shade);
          if (x - 11 > 6 && d <= 11.3) b(x, y, 1, 1, '#2d3532');                       // the minus stripe, away from the +
        }
        b(6, 11, 11, 1, '#8c9690'); b(11, 6, 1, 11, '#8c9690');                         // vent cross
      });
      case 'jst': return draw(70, 14, b => {
        b(0, 0, 70, 14, '#e9e4d6'); b(0, 12, 70, 2, '#cbc5b3');
        for (let i = 0; i < 8; i++) { b(4 + i * 8, 3, 6, 6, '#bdb6a2'); b(6 + i * 8, 5, 2, 2, GOLD); }
      });
      case 'module': return draw(MODULE.w * S, MODULE.h * S, (b, cg) => {
        const w = MODULE.w * S, h = MODULE.h * S, a = MODULE.antenna * S;
        b(0, 0, w, h, '#1f2a28');
        // the antenna: a meander in gold on the module's own board
        for (let i = 0; i < 6; i++) { b(8 + i * 8, 6, 2, 10, '#b89a5c'); b(8 + i * 8, i % 2 ? 6 : 14, 10, 2, '#b89a5c'); }
        // the shield can
        b(3, a + 2, w - 6, h - a - 6, '#b9c0bc'); b(3, a + 2, w - 6, 1, '#dde1dd'); b(3, a + 2, 1, h - a - 6, '#dde1dd');
        b(w - 4, a + 2, 1, h - a - 6, '#8c9690'); b(3, h - 5, w - 6, 1, '#8c9690');
        text(cg, 'tiny', 'ESP32-S3', 12, a + 18, '#59625f');
        text(cg, 'tiny', 'WROOM-1', 14, a + 26, '#59625f');
        // castellations along the sides
        for (let i = 0; i < 13; i++) { const y = a + 12 + i * 4; b(0, y, 2, 2, GOLD); b(w - 2, y, 2, 2, GOLD); }
      });
      default: return bitmap(1, 1)[0];
    }
  };
  const partArts = new Map(FOOTPRINTS.filter(f => f.kind !== 'tp').map(f => [f.ref, partArt(f)]));
  const partXY = (f: Fp): Pt => {
    switch (f.kind) {
      case 'mlcc': case 'res': return [f.x * S, f.y * S];
      case 'elec': return [f.x * S - 11, f.y * S - 11];
      case 'jst': return [f.x * S - 3, f.y * S];
      case 'module': return [f.x * S, f.y * S];
      default: return [0, 0];
    }
  };
  const slotTag = (label: string, sub: string, x: number, y: number, k: number) => {
    const w = measure('bold', label) + 6;
    box(x + 1, y + 1, w, 12, C.shadow); box(x, y, w, 12, C.focus);
    text(g, 'bold', label, x + 3, y + 10, C.ink);
    const shown = R(k * sub.length);
    text(g, 'mono', sub.slice(0, shown), x, y + 22, C.secondary);
  };
  function shotBoard(t: number) {
    g.drawImage(physicalBoard, OBX, OBY);
    for (const f of FOOTPRINTS) {
      const a = partArts.get(f.ref);
      if (!a) continue;
      const at = placedAt(f.ref);
      if (t < at) continue;
      const k = easeIn(seg(t, at, at + DROP_MS));
      const [x, y] = partXY(f);
      const lift = R((1 - k) * 8);
      g.drawImage(a, OBX + x, OBY + y - lift);
      // seated: a one-frame glint along its top edge
      if (t >= at + DROP_MS && t < at + DROP_MS + 90) { g.fillStyle = C.focus; g.fillRect(OBX + x, OBY + y, a.width - 1, 1); }
    }
    // the pick being placed, as the app names it
    const gi = PLACE_GROUPS.findIndex((_, i) => t < PLACE_AT + (i + 1) * GROUP);
    const cur = gi < 0 ? PLACE_GROUPS.length - 1 : gi;
    if (t >= PLACE_AT - 200) {
      const gr = PLACE_GROUPS[cur];
      slotTag(gr.tag, gr.label, 10, 12, seg(t, PLACE_AT + cur * GROUP, PLACE_AT + cur * GROUP + 250));
    }
  }

  // ---------- 6. The PC again: build complete, subtract from stock ----------
  const YES = DONE + 1300, COUNT = YES + 400;
  function shotDone(t: number) {
    g.drawImage(monitor, pcX, pcY);
    if (t < YES + 250) {
      appHeader('PROJECTS', C.muted);
      const x0 = SX + 6, y0 = SY;
      text(g, 'mono', 'ASTRO ARROW', x0 + 1, y0 + 23, C.text);
      right('tiny', `COMPLETE  ${PIECES} / ${PIECES} PIECES`, x0 + SW - 12, y0 + 23, C.secondary);
      // the prompt, as the app frames it
      const px = x0 + 8, py = y0 + 34, pw = SW - 28, ph = 52;
      box(px, py, pw, ph, C.raised);
      box(px, py, pw, 1, C.accent); box(px, py + ph - 1, pw, 1, C.accent); box(px, py, 1, ph, C.accent); box(px + pw - 1, py, 1, ph, C.accent);
      text(g, 'tiny', 'FIND IN RACKS', px + 5, py + 8, C.accent);
      text(g, 'tiny', `BUILD COMPLETE. ${PIECES} PIECES, 2 STOPS`, px + 5, py + 19, C.text);
      box(px + 4, py + 23, pw - 8, 1, C.divider);
      const ask = 'SUBTRACT THESE FROM STOCK?';
      text(g, 'tiny', ask.slice(0, R(seg(t, DONE + 400, DONE + 400 + ask.length * 25) * ask.length)), px + 5, py + 32, C.accent);
      if (t >= DONE + 1000) {
        const pressed = t >= YES && Math.floor((t - YES) / 80) % 2 === 0;
        box(px + 5, py + 38, 50, 9, pressed ? C.focus : C.accent);
        text(g, 'tiny', 'Y  SUBTRACT', px + 8, py + 45, C.ink);
        box(px + 59, py + 38, 58, 9, C.surface);
        text(g, 'tiny', 'N  KEEP STOCK', px + 62, py + 45, C.secondary);
      }
    } else {
      // back on the comparison: every count steps down by what was taken
      appHeader(`-${PIECES} PIECES`, C.focus);
      table(t, LINES.length, i => {
        const l = LINES[i], k = seg(t, COUNT + i * 140, COUNT + i * 140 + 400);
        return l.have - R(k * l.need);
      }, i => t >= COUNT + i * 140 && t < COUNT + i * 140 + 900);
    }
  }

  function render(time: number) {
    const t = ((time % LOOP) + LOOP) % LOOP;
    g.clearRect(0, 0, W, H);
    if (t < FIND) shotPc(t);
    else if (t < RACK_IN) shotFind(t);
    else if (t < BOARD_IN) shotRack(t);
    else if (t < DONE) shotBoard(t);
    else if (t < END) shotDone(t);
    const cuts: Array<[number, number, number]> = [[0, 400, -1],
      [FIND - 300, FIND, 1], [FIND, FIND + 300, -1], [RACK_IN - 300, RACK_IN, 1], [RACK_IN, RACK_IN + 300, -1],
      [BOARD_IN - 300, BOARD_IN, 1], [BOARD_IN, BOARD_IN + 300, -1], [DONE - 300, DONE, 1], [DONE, DONE + 300, -1], [END - 600, END, 1]];
    for (const [a, b, dir] of cuts) if (t >= a && t < b) dither(g, dir > 0 ? seg(t, a, b) : 1 - seg(t, a, b), DESK);
    if (t >= END) g.clearRect(0, 0, W, DESK);
    bar();
    caption(t);
  }

  return { render };
}
