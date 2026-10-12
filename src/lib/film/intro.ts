// The intro: before the film, the cursor (the lockup's prompt mark, the mascot's ›) types the title
// line in the big bitmap font, holds it, and backspaces it away. Then the reel dithers in out of the
// blank (reel.ts). The line is say.ts's typed line, the same device the film uses for its question.
import { say, ERASE_MS, SAY_X, SAY_BASE, type Line } from './say';
import { measure } from './gfx';

export const TITLE = 'See what the system can do';
const W = 384, H = 166;
const START = 700;                              // a blank desk first
const HOLD_UNTIL = START + 2900;                // typed by about 1.6 s, then held until here
const LINE: Line = { text: TITLE, at: START, until: HOLD_UNTIL };
/** The intro's length on the loop: the line is backspaced away, then a beat of blank. */
export const LENGTH = HOLD_UNTIL + TITLE.length * ERASE_MS + 350;

// say() draws the prompt and the line at SAY_X / SAY_BASE; shift them to the middle of the canvas.
// The prompt and its gap take 16 px, the block caret after the text takes 11.
const width = 16 + measure('big', TITLE) + 11;
const DX = Math.round((W - width) / 2) - SAY_X;
const DY = Math.round(H / 2) - (SAY_BASE - 5);

export function createIntro(canvas: HTMLCanvasElement) {
  const g = canvas.getContext('2d')!;
  function render(t: number) {
    g.clearRect(0, 0, W, H);
    g.save();
    g.translate(DX, DY);
    say(g, [LINE], t);
    g.restore();
  }
  return { render };
}
