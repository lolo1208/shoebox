/** 将图像与打码区域渲染到 canvas（预览与导出共用） */

import { clampNumber, normalizeMode, normalizeShape, safeHex, type CensorRegion } from './censor';

let mosaicCanvas: HTMLCanvasElement | null = null;
let blurCanvas: HTMLCanvasElement | null = null;

const getTempCanvas = (which: 'mosaic' | 'blur'): HTMLCanvasElement => {
  const current = which === 'mosaic' ? mosaicCanvas : blurCanvas;
  if (current) return current;
  const canvas = document.createElement('canvas');
  if (which === 'mosaic') mosaicCanvas = canvas;
  else blurCanvas = canvas;
  return canvas;
};

export function drawCensorScene(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement | null,
  regions: CensorRegion[],
  scale: number,
  opaque = false,
): void {
  if (!img || !img.naturalWidth) return;

  const cw = Math.max(1, Math.round(img.naturalWidth * scale));
  const ch = Math.max(1, Math.round(img.naturalHeight * scale));
  // 仅在尺寸变化时重新分配，避免无谓的画布重建
  if (canvas.width !== cw) canvas.width = cw;
  if (canvas.height !== ch) canvas.height = ch;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, cw, ch);
  if (opaque) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);
  }
  ctx.drawImage(img, 0, 0, cw, ch);

  const shortSide = Math.min(img.naturalWidth, img.naturalHeight);

  for (const region of regions) {
    const x = region.x * scale;
    const y = region.y * scale;
    const w = region.w * scale;
    const h = region.h * scale;
    if (w <= 0 || h <= 0) continue;

    const mode = normalizeMode(region.mode);
    const shape = normalizeShape(region.shape);
    const color = safeHex(region.color);
    const blockPct = clampNumber(region.blockPct, 0.4, 10, 1.6);
    const blurPct = clampNumber(region.blurPct, 0.1, 4, 0.8);

    ctx.save();
    ctx.beginPath();
    if (shape === 'ellipse') {
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.clip();

    if (mode === 'solid') {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    } else if (mode === 'pixelate') {
      const block = Math.max(1, (Math.max(2, (shortSide * blockPct) / 100)) * scale);
      const cols = Math.max(1, Math.round(w / block));
      const rows = Math.max(1, Math.round(h / block));
      const tmp = getTempCanvas('mosaic');
      tmp.width = cols;
      tmp.height = rows;
      const tctx = tmp.getContext('2d');
      if (!tctx) {
        ctx.restore();
        continue;
      }
      tctx.clearRect(0, 0, cols, rows);
      tctx.imageSmoothingEnabled = true;
      tctx.imageSmoothingQuality = 'high';
      tctx.drawImage(img, region.x, region.y, region.w, region.h, 0, 0, cols, rows);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0, cols, rows, x, y, w, h);
    } else {
      const radius = Math.max(1, (Math.max(1, (shortSide * blurPct) / 100)) * scale);
      const pad = Math.ceil(radius * 2) + 2;
      const sx = Math.max(0, x - pad);
      const sy = Math.max(0, y - pad);
      const ex = Math.min(cw, x + w + pad);
      const ey = Math.min(ch, y + h + pad);
      const tw = Math.max(1, Math.ceil(ex - sx));
      const th = Math.max(1, Math.ceil(ey - sy));
      const tmp = getTempCanvas('blur');
      tmp.width = tw;
      tmp.height = th;
      const tctx = tmp.getContext('2d');
      if (!tctx) {
        ctx.restore();
        continue;
      }
      tctx.clearRect(0, 0, tw, th);
      tctx.filter = `blur(${radius}px)`;
      const filterApplied = typeof tctx.filter === 'string' && tctx.filter !== 'none';
      if (!filterApplied) {
        // 不支持 canvas filter 时，用降采样模拟模糊
        const cols = Math.max(1, Math.round(tw / Math.max(1, radius)));
        const rows = Math.max(1, Math.round(th / Math.max(1, radius)));
        const small = getTempCanvas('mosaic');
        small.width = cols;
        small.height = rows;
        const sctx = small.getContext('2d');
        if (sctx) {
          sctx.imageSmoothingEnabled = true;
          sctx.drawImage(img, sx / scale, sy / scale, tw / scale, th / scale, 0, 0, cols, rows);
          tctx.imageSmoothingEnabled = true;
          tctx.drawImage(small, 0, 0, cols, rows, 0, 0, tw, th);
        }
      } else {
        tctx.drawImage(img, sx / scale, sy / scale, tw / scale, th / scale, 0, 0, tw, th);
      }
      tctx.filter = 'none';
      ctx.drawImage(tmp, 0, 0, tw, th, sx, sy, tw, th);
    }

    ctx.restore();
  }
}
