/**
 * Plays a video through the films' look: sampled down to the page's art grid (--px), its
 * brightness ordered-dithered (4x4 Bayer, as the films' cuts) into the dark app ramp, and
 * vignetted in the same dither so it dissolves into the page instead of fading. Runs at a
 * stepped 15 fps. The <video> stays the source (and the fallback); the canvas shows it.
 */
const RAMP = ['#0d1010', '#141918', '#1d2422', '#27312f', '#384543', '#5d6865'].map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
const FPS = 15;

export function pixelVideo(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  const src = document.createElement('canvas');
  const sg = src.getContext('2d', { willReadFrequently: true })!;
  let cols = 0, rows = 0, vignette = new Float32Array(0), out: ImageData | null = null;

  // One canvas pixel per art pixel, covering the box; CSS scales it up without smoothing.
  const fit = () => {
    const px = parseFloat(getComputedStyle(canvas).getPropertyValue('--px')) || 2;
    const box = canvas.parentElement!.getBoundingClientRect();
    cols = Math.ceil(box.width / px); rows = Math.ceil(box.height / px);
    canvas.width = src.width = cols; canvas.height = src.height = rows;
    canvas.style.width = cols * px + 'px'; canvas.style.height = rows * px + 'px';
    out = g.createImageData(cols, rows);
    // Brightness falls off towards the edges (and harder at the bottom, into the next band).
    vignette = new Float32Array(cols * rows);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const dx = (x / cols - .5) * 2, dy = (y / rows - .45) * 2;
      const r = Math.hypot(dx * .9, dy * (y / rows > .45 ? 1.25 : 1));
      vignette[y * cols + x] = Math.max(0, Math.min(1, 1.25 - r * .95));
    }
    draw();
  };

  const draw = () => {
    if (!out || video.readyState < 2) return;
    // Cover: crop the frame to the canvas's aspect.
    const vw = video.videoWidth, vh = video.videoHeight, k = Math.max(cols / vw, rows / vh);
    const sw = cols / k, sh = rows / k;
    sg.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, cols, rows);
    const px = sg.getImageData(0, 0, cols, rows).data, o = out.data, top = RAMP.length - 1;
    for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
      const p = i * 4;
      const lum = (px[p] * .2126 + px[p + 1] * .7152 + px[p + 2] * .0722) / 255;
      const level = Math.min(1, lum * 1.15) * vignette[i] * top;
      const base = Math.floor(level);
      const c = RAMP[Math.min(top, base + (level - base > BAYER[(y & 3) * 4 + (x & 3)] ? 1 : 0))];
      o[p] = c[0]; o[p + 1] = c[1]; o[p + 2] = c[2]; o[p + 3] = 255;
    }
    g.putImageData(out, 0, 0);
  };

  let last = 0;
  const tick = (now: number) => {
    if (!video.paused && now - last >= 1000 / FPS) { last = now; draw(); }
    requestAnimationFrame(tick);
  };
  new ResizeObserver(fit).observe(canvas.parentElement!);
  video.addEventListener('loadeddata', draw);
  video.addEventListener('seeked', draw);
  requestAnimationFrame(tick);
}
