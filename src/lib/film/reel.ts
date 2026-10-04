// The reel: one film. "Stock a part" (film.ts) puts a part away and backs off to the racks on the
// desk; then, on a dissolve, the finale (finale.ts) takes a board's BOM to the parts; then a second
// of blank closes the loop. render(t) draws any moment of it.
import * as intake from './film';
import * as finale from './finale';
import { dither } from './gfx';

export const W = intake.W, H = intake.H;
const CUT = intake.CUT, FADE = 300, PAUSE = 1000;
export const LOOP = CUT + finale.RUN + PAUSE;
/** The frame to show still (reduced motion). */
export const POSTER = CUT + finale.POSTER;
/** Chapter starts, for the arrow keys. */
export const CHAPTERS = [...intake.CHAPTERS.filter(c => c < CUT), ...finale.CHAPTERS.map(c => CUT + c)];

export function createReel(canvas: HTMLCanvasElement) {
  const a = intake.createFilm(canvas), b = finale.createFinale(canvas, a.kit);
  const g = canvas.getContext('2d')!;
  function render(time: number) {
    const t = ((time % LOOP) + LOOP) % LOOP;
    if (t < CUT) {
      a.render(t);
      if (t >= CUT - FADE) dither(g, (t - (CUT - FADE)) / FADE);
    } else if (t < CUT + finale.RUN) b.render(t - CUT);
    else g.clearRect(0, 0, W, H);
  }
  return { render };
}
