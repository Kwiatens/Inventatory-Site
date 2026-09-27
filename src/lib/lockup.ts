// Geometry for the ›iNVENTATORY lockup, built from the desktop ANSI wordmark.
// One terminal character is CELL_W × CELL_H units; two characters side by side
// make one square "letter pixel". Only the solid blocks (█) of the wordmark are
// used — the box-drawing shadow is replaced by the half-block drop shadow.
import { logoRows } from '../data/logo';

export const CELL_W = 10;
export const CELL_H = 20;
/** Dot row of the i, above the five letter rows (0–4). */
export const TOP_ROW = -2;
const LETTER_ROWS = 5;
/** First character column of the wordmark, after the prompt and one empty pixel. */
const WORD_X = 8;
/** Prompt pixels (x, y) in letter pixels: the master mark's ›, on the stem's rows. */
const PROMPT: ReadonlyArray<[number, number]> = [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]];

type Rgb = [number, number, number];
const START: Rgb = [0x58, 0xb9, 0xb0]; // Interactive
const END: Rgb = [0xb9, 0xe7, 0xdd]; // FocusText
const CANVAS: Rgb = [0x0d, 0x10, 0x10]; // CanvasBg

const mix = (a: Rgb, b: Rgb, t: number): Rgb => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as Rgb;
const hex = (c: Rgb) => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
const rowRgb = (y: number) => mix(START, END, (y - TOP_ROW) / (LETTER_ROWS - 1 - TOP_ROW));

export type LockupPart = 'prompt' | 'stem' | 'dot' | 'word';
export interface LockupRect {
  part: LockupPart;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  shadow: string;
  /** Build order inside its part, used for the boot animation. */
  order: number;
}

function build() {
  const cells: Array<{ x: number; y: number; part: LockupPart; order: number }> = [];
  PROMPT.forEach(([px, py], i) => {
    cells.push({ x: px * 2, y: py, part: 'prompt', order: i }, { x: px * 2 + 1, y: py, part: 'prompt', order: i });
  });
  for (let y = 0; y < LETTER_ROWS; y++) {
    [...logoRows[y]].forEach((char, x) => {
      if (char !== '█') return;
      const stem = x < 2;
      cells.push({ x: WORD_X + x, y, part: stem ? 'stem' : 'word', order: stem ? LETTER_ROWS - 1 - y : x });
    });
  }
  const filled = new Set(cells.map(c => c.x + ',' + c.y));
  const has = (x: number, y: number) => filled.has(x + ',' + y);
  const rects: LockupRect[] = [];

  // The dot is one letter pixel split into four rack slots.
  const dotX = WORD_X * CELL_W;
  const dotY = 0;
  const half = CELL_H / 2;
  [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([i, j], order) => {
    const color = rowRgb(TOP_ROW);
    rects.push({
      part: 'dot', order,
      x: dotX + i * CELL_W, y: dotY + j * half,
      width: CELL_W + (i === 0 ? 0.6 : 0), height: half + (j === 0 ? 0.6 : 0),
      fill: hex(color), shadow: hex(mix(color, CANVAS, 0.62)),
    });
  });

  // Every other block: merge horizontal runs of the same part so edges stay seamless.
  const seen = new Set<string>();
  const byKey = new Map(cells.map(c => [c.x + ',' + c.y, c]));
  for (const cell of [...cells].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const key = cell.x + ',' + cell.y;
    if (seen.has(key)) continue;
    let run = 0;
    while (byKey.get((cell.x + run) + ',' + cell.y)?.part === cell.part && !(cell.part === 'prompt' && run === 2)) {
      seen.add((cell.x + run) + ',' + cell.y);
      run++;
    }
    const color = rowRgb(cell.y);
    const overlapX = has(cell.x + run, cell.y) ? 0.6 : 0;
    const overlapY = has(cell.x, cell.y + 1) ? 0.6 : 0;
    rects.push({
      part: cell.part, order: cell.order,
      x: cell.x * CELL_W, y: (cell.y - TOP_ROW) * CELL_H,
      width: run * CELL_W + overlapX, height: CELL_H + overlapY,
      fill: hex(color), shadow: hex(mix(color, CANVAS, 0.62)),
    });
  }
  const columns = Math.max(...cells.map(c => c.x)) + 1;
  return { rects, width: columns * CELL_W, height: (LETTER_ROWS - TOP_ROW) * CELL_H };
}

export const lockup = build();
/** Offset of the half-block drop shadow: one character right, half a row down. */
export const shadowOffset = { x: CELL_W, y: CELL_H / 2 };
