// The reel: an intro (intro.ts: the title line is typed and backspaced away), then one film.
// "Stock a part" (film.ts) puts a part away and backs off to the racks on the desk; then, on a
// dissolve, the finale (finale.ts) takes a board's BOM to the parts; then a second of blank closes
// the loop. render(t) draws any moment of it.
import * as intake from './film';
import * as finale from './finale';
import { createIntro, LENGTH as INTRO } from './intro';
import { dither } from './gfx';

export const W = intake.W, H = intake.H;
const CUT = intake.CUT, FADE = 300, IN = 450, PAUSE = 1000;
export const LOOP = INTRO + CUT + finale.RUN + PAUSE;
/** The frame to show still (reduced motion). */
export const POSTER = INTRO + CUT + finale.POSTER;

export function createReel(canvas: HTMLCanvasElement) {
  const i = createIntro(canvas), a = intake.createFilm(canvas), b = finale.createFinale(canvas, a.kit);
  const g = canvas.getContext('2d')!;
  function render(time: number) {
    const t = ((time % LOOP) + LOOP) % LOOP;
    if (t < INTRO) { i.render(t); return; }
    const u = t - INTRO;
    if (u < CUT) {
      a.render(u);
      if (u < IN) dither(g, 1 - u / IN);                  // dithers in out of the intro's blank
      if (u >= CUT - FADE) dither(g, (u - (CUT - FADE)) / FADE);
    } else if (u < CUT + finale.RUN) b.render(u - CUT);
    else g.clearRect(0, 0, W, H);
  }
  return { render };
}
