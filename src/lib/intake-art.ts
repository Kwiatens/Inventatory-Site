// Concept: flat pixel art for the intake scene, drawn from photos of the real things.
import { Canvas, dataMatrix } from './pixel';

/**
 * A vendor's anti-static bag, from a DigiKey bag without its branding: plain dark film, the
 * heat seal along the top, and the black-and-white shipping label with its DataMatrix.
 */
export function bag() {
  const c = new Canvas(54, 40);
  c.rect(0, 1, 52, 38, 'film');
  c.rect(0, 1, 52, 2, 'sheen');
  const L = 6, T = 7;
  c.rect(L, T, 40, 28, 'bone');
  c.rect(L + 2, T + 2, 4, 3, 'ink').rect(L + 8, T + 3, 16, 1, 'ink');
  c.rect(L + 2, T + 7, 36, 1, 'ink');
  c.rect(L + 2, T + 9, 22, 1, 'ink').rect(L + 2, T + 11, 14, 1, 'ink');
  dataMatrix(10, 41).forEach((row, y) => row.forEach((on, x) => { if (on) c.set(L + 2 + x, T + 15 + y, 'ink', 'dm'); }));
  [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1].forEach((on, i) => { if (on) c.rect(L + 15 + i, T + 15, 1, 6, 'ink'); });
  c.rect(L + 29, T + 17, 9, 1, 'ink').rect(L + 29, T + 17, 1, 8, 'ink').rect(L + 37, T + 17, 1, 8, 'ink').rect(L + 29, T + 24, 9, 1, 'ink');
  c.rect(L + 32, T + 20, 3, 3, 'ink');
  return c.render(1, 38);
}

/** A QR-looking module pattern: three finder squares, seeded data. */
export function qr(size = 21, seed = 5) {
  let s = seed;
  const rand = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const finder = (x: number, y: number) => {
    for (const [fx, fy] of [[0, 0], [size - 7, 0], [0, size - 7]]) {
      const dx = x - fx, dy = y - fy;
      if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4) ? 1 : 0;
      if (dx >= -1 && dx < 8 && dy >= -1 && dy < 8) return 0;
    }
    return -1;
  };
  return Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => {
    const f = finder(x, y);
    return f >= 0 ? f === 1 : rand() > .52;
  }));
}
