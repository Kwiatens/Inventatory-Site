// Concept: illustrations drawn on the lockup's own grid.
// One pixel here is the size of one rack slot in the i's dot: one terminal character wide,
// half a row tall (10 × 10 units). Every drawing gets the lockup's half-block drop shadow and
// its top-to-bottom teal ramp, so artwork and wordmark read as the same hand.

export type Tone = 'ramp' | 'graphite' | 'steel' | 'bone' | 'ink' | 'lit' | 'slot' | 'amber' | 'deep' | 'film' | 'sheen' | 'paper2';
export const PX = 10;

export type Rgb = [number, number, number];
export const CANVAS: Rgb = [0x0d, 0x10, 0x10];
const RAMP_TOP: Rgb = [0x58, 0xb9, 0xb0];
const RAMP_BOTTOM: Rgb = [0xb9, 0xe7, 0xdd];
const FIXED: Record<Exclude<Tone, 'ramp'>, Rgb> = {
  graphite: [0x38, 0x45, 0x43],
  steel: [0x5d, 0x68, 0x65],
  bone: [0xf1, 0xee, 0xe5],
  ink: [0x0d, 0x10, 0x10],
  lit: [0xb9, 0xe7, 0xdd],
  slot: [0x1d, 0x24, 0x22],
  amber: [0xd8, 0xb5, 0x6b],
  deep: [0x14, 0x19, 0x18],
  film: [0x27, 0x31, 0x2f],
  sheen: [0x4a, 0x57, 0x54],
  paper2: [0xca, 0xd0, 0xca],
};
const SHADOWLESS: Tone[] = ['ink', 'slot'];
/** The Scan R1's ST7565 panel: grey-green glass, near-black pixels. */
export const LCD_BG: Rgb = [0xa9, 0xb6, 0xa4];
export const LCD_INK: Rgb = [0x1f, 0x27, 0x23];
export const mix = (a: Rgb, b: Rgb, t: number): Rgb => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as Rgb;
export const hex = (c: Rgb) => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');

export interface PixelRect { x: number; y: number; w: number; h: number; fill: string; shadow?: string; tag?: string }

export class Canvas {
  readonly cells: Array<Array<{ tone: Tone; tag?: string } | null>>;
  constructor(readonly w: number, readonly h: number) {
    this.cells = Array.from({ length: h }, () => Array<null>(w).fill(null));
  }
  set(x: number, y: number, tone: Tone | null, tag?: string) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.cells[y][x] = tone ? { tone, tag } : null;
    return this;
  }
  rect(x: number, y: number, w: number, h: number, tone: Tone | null, tag?: string) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, tone, tag);
    return this;
  }
  frame(x: number, y: number, w: number, h: number, tone: Tone) {
    this.rect(x, y, w, 1, tone).rect(x, y + h - 1, w, 1, tone).rect(x, y, 1, h, tone).rect(x + w - 1, y, 1, h, tone);
    return this;
  }
  /** Filled ring between two radii, centred on (cx, cy) in pixel space. */
  ring(cx: number, cy: number, r0: number, r1: number, tone: Tone) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const d = Math.hypot(x + .5 - cx, y + .5 - cy);
      if (d >= r0 && d < r1) this.set(x, y, tone);
    }
    return this;
  }
  /** Draw a map: one character per pixel, `key` maps characters to tones. */
  draw(x: number, y: number, map: string[], key: Record<string, Tone>) {
    map.forEach((row, j) => [...row].forEach((ch, i) => { if (key[ch]) this.set(x + i, y + j, key[ch]); }));
    return this;
  }

  /** Horizontal runs of one tone and tag merged into rects, shadows first. */
  render(rampFrom = 0, rampTo = this.h - 1) {
    const faces: PixelRect[] = [];
    const color = (tone: Tone, y: number): Rgb =>
      tone === 'ramp' ? mix(RAMP_TOP, RAMP_BOTTOM, Math.min(1, Math.max(0, (y - rampFrom) / Math.max(1, rampTo - rampFrom)))) : FIXED[tone];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w;) {
        const c = this.cells[y][x];
        if (!c) { x++; continue; }
        let run = 1;
        while (x + run < this.w && this.cells[y][x + run]?.tone === c.tone && this.cells[y][x + run]?.tag === c.tag) run++;
        const rgb = color(c.tone, y);
        faces.push({
          x: x * PX, y: y * PX, w: run * PX + .6, h: PX + .6, fill: hex(rgb), tag: c.tag,
          shadow: SHADOWLESS.includes(c.tone) ? undefined : hex(mix(rgb, CANVAS, .62)),
        });
        x += run;
      }
    }
    return { faces, width: this.w * PX, height: this.h * PX };
  }
}

/**
 * A plausible ECC200-looking module pattern: solid L finder on the left and bottom edges,
 * alternating clock track on the top and right, seeded noise inside.
 */
export function dataMatrix(size: number, seed: number) {
  let s = seed;
  const rand = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const on: boolean[][] = [];
  for (let y = 0; y < size; y++) {
    on[y] = [];
    for (let x = 0; x < size; x++) {
      if (x === 0 || y === size - 1) on[y][x] = true;
      else if (y === 0) on[y][x] = x % 2 === 0;
      else if (x === size - 1) on[y][x] = y % 2 === 1;
      else on[y][x] = rand() > .5;
    }
  }
  return on;
}

// ---------- sprites generated from models (scripts/pixel-art) ----------

/** Palette for the codes written by scripts/pixel-art/pixelize.py, darkest band first. */
export const CODES: Record<string, Rgb> = {
  '0': [0x2a, 0x35, 0x40], '1': [0x3d, 0x4c, 0x5a], '2': [0x5a, 0x6c, 0x7c], '3': [0x84, 0x96, 0xa6], // Scan R1 shell, blue-grey
  '4': [0x12, 0x17, 0x16], '5': [0x1d, 0x24, 0x22], '6': [0x27, 0x31, 0x2f], '7': [0x38, 0x45, 0x43], // black PLA
  a: [0x8c, 0x96, 0x90], b: [0xca, 0xd0, 0xca], c: [0xf1, 0xee, 0xe5],                                 // caps
  g: [0x1d, 0x24, 0x22], h: [0x38, 0x45, 0x43],                                                        // clear tube
  Q: [0xca, 0xd0, 0xca], P: [0xf1, 0xee, 0xe5], I: [0x0d, 0x10, 0x10],                                 // paper, ink
  L: LCD_BG, k: [0x1a, 0x21, 0x1f], K: [0x2b, 0x36, 0x33], T: [0x58, 0xb9, 0xb0],
};

export interface SpriteData { width: number; height: number; rows: string[]; tags: Record<string, number[][]>; uv?: number[][] }
export interface Sprite { faces: PixelRect[]; lcd: Array<{ x: number; y: number; u: number; v: number }>; width: number; height: number }

/** Rows of codes into merged rects, tagged pixels kept apart so the page can switch them. */
export function sprite(data: SpriteData): Sprite {
  const tagAt = new Map<string, string>();
  for (const [tag, cells] of Object.entries(data.tags)) for (const [x, y] of cells) tagAt.set(x + ',' + y, tag);
  const faces: PixelRect[] = [];
  data.rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const code = row[x];
      if (code === '.' || code === 'L') { x++; continue; }
      const tag = tagAt.get(x + ',' + y);
      let run = 1;
      while (x + run < row.length && row[x + run] === code && tagAt.get(x + run + ',' + y) === tag) run++;
      const rgb = CODES[code] ?? [255, 0, 255];
      faces.push({ x: x * PX, y: y * PX, w: run * PX + .6, h: PX + .6, fill: hex(rgb), shadow: hex(mix(rgb, CANVAS, .62)), tag });
      x += run;
    }
  });
  // LCD pixels are drawn one by one: the page paints the firmware's frames into them.
  const lcd = (data.uv ?? []).map(([x, y, u, v]) => ({ x, y, u, v }));
  return { faces, lcd, width: data.width * PX, height: data.height * PX };
}

/** A 5-row pixel font for the keypad's legends: digits 3 wide, letters and symbols 4. */
export const GLYPHS: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'], '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'], '9': ['###', '#.#', '###', '..#', '##.'],
  A: ['.##.', '#..#', '####', '#..#', '#..#'], B: ['###.', '#..#', '###.', '#..#', '###.'],
  C: ['.###', '#...', '#...', '#...', '.###'], D: ['###.', '#..#', '#..#', '#..#', '###.'],
  '*': ['....', '#..#', '.##.', '#..#', '....'], '#': ['.#.#', '####', '.#.#', '####', '#.#.'],
};
