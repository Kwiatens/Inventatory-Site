// Concept: plays Scan R1 scenes recorded from the firmware (src/data/scan-r1-lcd.json) into
// every display inside a root element: dot-matrix panels, and the LCD pixels of sprites.
// Events recorded with the scene (a scan, a key press, a stored part) are handed back so
// the page can move the rest of the picture in step.
import lcd from '../data/scan-r1-lcd.json';

type Frames = typeof lcd;
const W = lcd.width, H = lcd.height;
const INK = '#1f2723', GHOST = '#a1ae9c', BG = '#a9b6a4', MID = '#5f6b5f';

const decoded = new Map<number, Uint8Array>();
function frame(index: number) {
  let bits = decoded.get(index);
  if (!bits) {
    const raw = atob(lcd.frames[index]);
    bits = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) bits[i] = (raw.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
    decoded.set(index, bits);
  }
  return bits;
}

function paintPanel(canvas: HTMLCanvasElement, bits: Uint8Array) {
  // Whole device pixels per LCD pixel, so the dot grid stays crisp at any size.
  const s = Math.max(1, Math.floor(canvas.getBoundingClientRect().width * devicePixelRatio / W));
  if (canvas.width !== W * s) { canvas.width = W * s; canvas.height = H * s; }
  const g = canvas.getContext('2d');
  if (!g) return;
  const gap = s >= 3 ? 1 : 0;
  g.fillStyle = BG; g.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    g.fillStyle = bits[y * W + x] ? INK : GHOST;
    g.fillRect(x * s, y * s, s - gap, s - gap);
  }
}

// Sprite LCDs are a few dozen pixels across: each takes the share of lit firmware pixels
// under its footprint and shows it in one of three steps.
function paintSprite(pixels: SVGRectElement[], bits: Uint8Array) {
  const n = pixels.length;
  const fx = Math.max(1, W / Math.sqrt(n * 2)), fy = Math.max(1, H / Math.sqrt(n / 2));
  for (const px of pixels) {
    const cx = Number(px.dataset.u) * W, cy = Number(px.dataset.v) * H;
    let on = 0, all = 0;
    for (let y = Math.floor(cy - fy / 2); y < cy + fy / 2; y++) for (let x = Math.floor(cx - fx / 2); x < cx + fx / 2; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      all++; on += bits[y * W + x];
    }
    const share = all ? on / all : 0;
    px.setAttribute('fill', share > .3 ? INK : share > .1 ? MID : BG);
  }
}

export interface PlayerOptions {
  /** Scenes to play in order, then loop. */
  scenes: Array<keyof Frames['scenes']>;
  /** Shown with reduced motion: [scene, ms into it]. */
  still: [keyof Frames['scenes'], number];
  onEvent?: (scene: string, event: string) => void;
  onScene?: (scene: string) => void;
}

export function playScanR1(root: HTMLElement, options: PlayerOptions) {
  const panels = [...root.querySelectorAll<HTMLCanvasElement>('[data-lcd-panel]')];
  const spritePixels = [...root.querySelectorAll<SVGGElement>('[data-lcd-pixels]')].map(g => [...g.querySelectorAll<SVGRectElement>('rect')]);
  const show = (index: number) => {
    const bits = frame(index);
    panels.forEach(c => paintPanel(c, bits));
    spritePixels.forEach(p => paintSprite(p, bits));
  };
  const frameAt = (scene: keyof Frames['scenes'], ms: number) => {
    let current = 0;
    for (const [t, f] of lcd.scenes[scene] as number[][]) { if (t > ms) break; if (f >= 0) current = f; }
    return current;
  };

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    show(frameAt(...options.still));
    return;
  }

  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '100px' }).observe(root);
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
  (async () => {
    show(frameAt(...options.still));
    for (let s = 0; ; s = (s + 1) % options.scenes.length) {
      while (!visible || document.hidden) await wait(300);
      const name = options.scenes[s];
      options.onScene?.(name as string);
      const steps: Array<[number, () => void]> = [];
      for (const [t, f] of lcd.scenes[name] as number[][]) steps.push([t, f >= 0 ? () => show(f) : () => {}]);
      for (const [t, e] of (lcd.events as unknown as Record<string, Array<[number, string]>>)[name as string] ?? []) steps.push([t, () => options.onEvent?.(name as string, e)]);
      steps.sort((a, b) => a[0] - b[0]);
      let now = 0;
      for (const [t, act] of steps) { await wait(t - now); now = t; act(); }
    }
  })();
}

/** The firmware frame showing at `ms` into a scene. */
export function lcdFrameAt(scene: keyof Frames['scenes'], ms: number) {
  let current = 0;
  for (const [t, f] of lcd.scenes[scene] as number[][]) { if (t > ms) break; if (f >= 0) current = f; }
  return current;
}

/** Paint one firmware frame into every sprite LCD under `root`. */
export function paintSpriteLcds(root: Element, index: number) {
  const bits = frame(index);
  root.querySelectorAll<SVGGElement>('[data-lcd-pixels]').forEach(g => paintSprite([...g.querySelectorAll<SVGRectElement>('rect')], bits));
}

/** One firmware frame as 128 x 64 bits (1 = lit pixel). */
export const frameBits = (index: number) => frame(index);

/** Paint a firmware frame into a sprite's LCD pixels on a 2D canvas (uv: [x, y, u, v]). */
export function paintLcdCanvas(g: CanvasRenderingContext2D, uv: number[][], index: number) {
  const bits = frame(index);
  const n = uv.length;
  const fx = Math.max(1, W / Math.sqrt(n * 2)), fy = Math.max(1, H / Math.sqrt(n / 2));
  for (const [px, py, u, v] of uv) {
    const cx = u * W, cy = v * H;
    let on = 0, all = 0;
    for (let y = Math.floor(cy - fy / 2); y < cy + fy / 2; y++) for (let x = Math.floor(cx - fx / 2); x < cx + fx / 2; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      all++; on += bits[y * W + x];
    }
    const share = all ? on / all : 0;
    g.fillStyle = share > .3 ? INK : share > .1 ? MID : BG;
    g.fillRect(px, py, 1, 1);
  }
}
