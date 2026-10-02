// Concept: the feature plates, drawn on the film's grid (one Canvas pixel = one film pixel)
// so they sit at the same scale as the rack beside them. Tagged pixels are switched by the
// page to animate them.
import { Canvas } from './pixel';

/** The film's cursor, the lockup's ›: three wide, five tall. */
const chevron = (c: Canvas, x: number, y: number, tag: string) =>
  [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]].forEach(([i, j]) => c.set(x + i, y + j, 'ramp', tag));

/**
 * A board for a BOM: QFN in the middle, 0603 passives on both sides tagged part-0…9, traces
 * into the chip, a pin header along the bottom.
 */
export function board() {
  const c = new Canvas(84, 58);
  c.rect(0, 2, 84, 54, 'graphite');
  [[3, 5], [78, 5], [3, 50], [78, 50]].forEach(([x, y]) => c.rect(x, y, 3, 3, 'ink'));
  // Chip, with its pads on all four sides and a pin-1 mark.
  const CX = 32, CY = 12, CS = 20;
  for (let i = 0; i < 8; i++) {
    const p = 3 + i * 2;
    c.rect(CX + p, CY - 2, 1, 2, 'ramp').rect(CX + p, CY + CS, 1, 2, 'ramp');
    c.rect(CX - 2, CY + p, 2, 1, 'ramp').rect(CX + CS, CY + p, 2, 1, 'ramp');
  }
  c.rect(CX, CY, CS, CS, 'steel').rect(CX + 2, CY + 2, 2, 2, 'ink');
  // Passives, five a side. Each is wired to one of the chip's side pads by a trace under the
  // mask; the lower a part, the closer to the chip its trace turns, so no two traces cross. The right
  // side mirrors the left.
  const bends = [20, 20, 22, 24, 26];
  for (let k = 0; k < 10; k++) {
    const left = k < 5, r = k % 5, y = 9 + r * 8, pad = CY + 3 + r * 2;
    const at = (x: number) => left ? x : 83 - x;
    const h = (x0: number, x1: number, yy: number) => c.rect(Math.min(at(x0), at(x1)), yy, Math.abs(x1 - x0) + 1, 1, 'slot');
    h(14, bends[r], y + 1);
    c.rect(at(bends[r]), Math.min(y + 1, pad), 1, Math.abs(pad - y - 1) + 1, 'slot');
    h(bends[r], CX - 3, pad);
    const tag = 'part-' + k;
    c.rect(at(8) - (left ? 0 : 5), y, 2, 3, 'ramp', tag).rect(at(10) - (left ? 0 : 1), y, 2, 3, 'steel', tag).rect(at(12) - (left ? 0 : -3), y, 2, 3, 'ramp', tag);
  }
  // Pin header.
  for (let i = 0; i < 8; i++) c.rect(27 + i * 4, 47, 2, 2, 'ramp');
  c.frame(25, 45, 34, 6, 'ink');
  return c.render(2, 55);
}

/**
 * A vendor's order CSV under review: the cursor walks down its rows and each one is
 * accepted (a tick) or skipped (a dash). Tags: cur-j, ok-j (j = row).
 */
export const ORDER_ROWS = 6;
export const ORDER_SKIP = 3;
export function order() {
  const c = new Canvas(66, 58);
  const X = 6, Y = 2, W = 46, H = 56;
  c.rect(X, Y, W, H, 'bone');
  // Folded corner.
  for (let v = 0; v < 6; v++) { c.rect(X + W - 5 + v, Y + v, 5 - v, 1, null); c.rect(X + W - 6, Y + v, v + 1, 1, 'paper2'); }
  c.rect(X + 4, Y + 5, 20, 2, 'ink');                         // file name
  [[4, 14], [21, 12], [36, 6]].forEach(([dx, w]) => c.rect(X + dx, Y + 11, w, 1, 'steel'));  // header
  c.rect(X + 4, Y + 14, W - 8, 1, 'paper2');
  for (let j = 0; j < ORDER_ROWS; j++) {
    const y = Y + 18 + j * 6;
    const lens = [[13, 9, 4], [11, 12, 5], [14, 8, 3], [12, 10, 6], [10, 12, 4], [13, 7, 5]][j];
    [4, 21, 36].forEach((dx, i) => c.rect(X + dx, y, lens[i], 2, 'graphite'));
    chevron(c, 0, y - 1, 'cur-' + j);
    if (j === ORDER_SKIP) c.rect(X + W + 6, y, 4, 2, 'steel', 'ok-' + j);
    else ['......##', '.....##.', '##..##..', '.####...', '..##....'].forEach((row, v) =>
      [...row].forEach((ch, u) => { if (ch === '#') c.set(X + W + 4 + u, y - 2 + v, 'ramp', 'ok-' + j); }));
  }
  return c.render(2, 57);
}

/**
 * Inventory history: commits newest first on a rail, one of them a checkpoint (amber).
 * Tags: bg-i (row background, for the selection), row-i (row contents).
 */
export const HISTORY_ROWS = 5;
export const HISTORY_CHECKPOINT = 2;
export function history() {
  const c = new Canvas(84, 60);
  const pitch = 12;
  c.rect(3, 6, 1, (HISTORY_ROWS - 1) * pitch + 1, 'graphite');
  for (let i = 0; i < HISTORY_ROWS; i++) {
    const y = i * pitch, tag = 'row-' + i;
    c.rect(8, y, 76, 10, 'deep', 'bg-' + i);
    const lens = [[30, 18], [22, 26], [26, 0], [34, 14], [18, 22]][i];
    c.rect(12, y + 3, lens[0], 2, 'paper2', tag);
    if (lens[1]) c.rect(12, y + 6, lens[1], 1, 'steel', tag);
    c.rect(72, y + 3, 8, 2, 'steel', tag);
    c.rect(2, y + 4, 3, 3, i === HISTORY_CHECKPOINT ? 'amber' : 'ramp', tag);
  }
  // The checkpoint's name tag.
  c.rect(12 + 26 + 3, HISTORY_CHECKPOINT * pitch + 3, 10, 2, 'amber', 'row-' + HISTORY_CHECKPOINT);
  return c.render(0, 59);
}
