export type Pt = { x: number; y: number };

/**
 * Affine transform that maps triangle s0s1s2 onto d0d1d2.
 * Returned values are meant for ctx.setTransform(a, b, c, d, e, f).
 */
export const affine = (s0: Pt, s1: Pt, s2: Pt, d0: Pt, d1: Pt, d2: Pt) => {
  const den = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
  const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / den;
  const b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / den;
  const c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / den;
  const d = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / den;
  return { a, b, c, d, e: d0.x - a * s0.x - c * s0.y, f: d0.y - b * s0.x - d * s0.y };
};

/** Grow a triangle slightly around its centroid so clip seams disappear. */
const expand = (p: Pt[], k: number): Pt[] => {
  const cx = (p[0].x + p[1].x + p[2].x) / 3;
  const cy = (p[0].y + p[1].y + p[2].y) / 3;
  return p.map((q) => ({ x: cx + (q.x - cx) * k, y: cy + (q.y - cy) * k }));
};

const drawTriangle = (
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  src: Pt[],
  dst: Pt[],
  alpha: number,
) => {
  const clip = expand(dst, 1.02);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(clip[0].x, clip[0].y);
  ctx.lineTo(clip[1].x, clip[1].y);
  ctx.lineTo(clip[2].x, clip[2].y);
  ctx.closePath();
  ctx.clip();
  const m = affine(src[0], src[1], src[2], dst[0], dst[1], dst[2]);
  ctx.globalAlpha = alpha;
  ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
};

/**
 * Mesh morph: image A and image B are warped through a shared control grid
 * that bulges outward mid-transition, then cross-faded.
 *
 * The bulge is what turns a plain dissolve into a visible "liquid" morph.
 * Set `amplitude` to 0 and you are back to a regular cross-fade.
 */
export const drawMorph = (
  ctx: CanvasRenderingContext2D,
  imgA: HTMLImageElement,
  imgB: HTMLImageElement,
  width: number,
  height: number,
  t: number,
  cols = 6,
  rows = 6,
  amplitude = 0.07,
) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const bulge = Math.sin(Math.PI * Math.max(0, Math.min(1, t)));

  // Destination point (i, j) = natural grid position + radial displacement.
  const dest = (i: number, j: number): Pt => {
    const x = (i / cols) * width;
    const y = (j / rows) * height;
    const dx = x - width / 2;
    const dy = y - height / 2;
    const dist = Math.hypot(dx, dy) || 1;
    const falloff = Math.max(0, 1 - dist / (Math.hypot(width, height) / 2));
    const push = bulge * width * amplitude * falloff;
    return { x: x + (dx / dist) * push, y: y + (dy / dist) * push };
  };

  const srcA = (i: number, j: number): Pt => ({
    x: (i / cols) * imgA.naturalWidth,
    y: (j / rows) * imgA.naturalHeight,
  });
  const srcB = (i: number, j: number): Pt => ({
    x: (i / cols) * imgB.naturalWidth,
    y: (j / rows) * imgB.naturalHeight,
  });

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const d00 = dest(i, j);
      const d10 = dest(i + 1, j);
      const d01 = dest(i, j + 1);
      const d11 = dest(i + 1, j + 1);

      const s00A = srcA(i, j);
      const s10A = srcA(i + 1, j);
      const s01A = srcA(i, j + 1);
      const s11A = srcA(i + 1, j + 1);

      const s00B = srcB(i, j);
      const s10B = srcB(i + 1, j);
      const s01B = srcB(i, j + 1);
      const s11B = srcB(i + 1, j + 1);

      // Lower-left triangle
      drawTriangle(ctx, imgA, [s00A, s10A, s11A], [d00, d10, d11], 1);
      drawTriangle(ctx, imgA, [s00A, s11A, s01A], [d00, d11, d01], 1);
      drawTriangle(ctx, imgB, [s00B, s10B, s11B], [d00, d10, d11], t);
      drawTriangle(ctx, imgB, [s00B, s11B, s01B], [d00, d11, d01], t);
    }
  }
};

/** Load several images and resolve only when every one is ready. */
export const loadImages = (srcs: string[]): Promise<HTMLImageElement[]> =>
  Promise.all(
    srcs.map(
      (src) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`No se pudo cargar: ${src}`));
          img.src = src;
        }),
    ),
  );
