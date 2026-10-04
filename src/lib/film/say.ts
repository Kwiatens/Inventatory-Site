// Text as an actor: the film's cursor (the lockup's prompt) types a line like a terminal does, in
// the big bitmap font; the line is held for as long as it is read, then backspaced away (or the
// shot ends on it). One line at a time, never a caption bar or a box. Drawn at SAY_X/SAY_BASE;
// a shot that wants it elsewhere translates the context (film.ts puts the question mid-frame).
import { text, ascent, C } from './gfx';

export interface Line { text: string; at: number; until: number }   // typed from `at`, erased from `until`
export const ERASE_MS = 14;
export const SAY_X = 8, SAY_BASE = 23, SAY_FONT = 'big' as const;

const PROMPT: Array<[number, number]> = [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]];
const SQ = 3;                                                       // the prompt's square, in art pixels

// each key lands a little after the last, never evenly: a person's rhythm, the same every time
const gap = (i: number) => 38 + ((i * 7 + 3) % 5) * 9;
const keyTimes = (n: number) => { const out: number[] = []; let at = 0; for (let i = 0; i < n; i++) { out.push(at); at += gap(i); } return out; };
const typedAt = new Map<number, number[]>();

/** How many characters of `line` are showing at time t (0 when it is not on). */
export function shown(line: Line, t: number): number {
  const n = line.text.length;
  if (t < line.at) return 0;
  if (t < line.until) {
    let times = typedAt.get(n); if (!times) { times = keyTimes(n); typedAt.set(n, times); }
    let k = 0; while (k < n && t - line.at >= times[k]) k++;
    return k;
  }
  return Math.max(0, n - Math.ceil((t - line.until) / ERASE_MS));
}

/** Draw whichever line is on at t: the prompt, the text after it, and a terminal's block caret that
 *  holds still while keys land and blinks while it waits. */
export function say(g: CanvasRenderingContext2D, lines: Line[], t: number) {
  let line: Line | undefined, n = 0;
  for (const l of lines) { const k = shown(l, t); if (k > 0 && (!line || l.at >= line.at)) { line = l; n = k; } }
  if (!line) return;
  const top = SAY_BASE - 12;
  g.fillStyle = C.shadow;
  for (const [i, j] of PROMPT) g.fillRect(SAY_X + i * SQ + 1, top + j * SQ + 1, SQ, SQ);
  g.fillStyle = C.accent;
  for (const [i, j] of PROMPT) g.fillRect(SAY_X + i * SQ, top + j * SQ, SQ, SQ);
  const tx = SAY_X + 3 * SQ + 7, str = line.text.slice(0, n);
  text(g, SAY_FONT, str, tx + 1, SAY_BASE + 1, C.shadow);
  const advance = text(g, SAY_FONT, str, tx, SAY_BASE, C.bone);
  const typing = t < line.until ? n < line.text.length : false, erasing = t >= line.until;
  if (typing || erasing || Math.floor(t / 500) % 2 === 0) {
    g.fillStyle = C.accent; g.fillRect(tx + advance + 2, SAY_BASE - ascent(SAY_FONT) + 1, 9, ascent(SAY_FONT) + 3);
  }
}
