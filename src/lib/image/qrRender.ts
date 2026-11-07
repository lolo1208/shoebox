/// <reference lib="dom" />
export type QrModuleShape = 'square' | 'rounded' | 'dot';
export type QrEyeShape = 'square' | 'rounded' | 'circle';
export type QrGradientDir = 'diagonal' | 'horizontal' | 'vertical';

export interface QrRenderOptions {
  size: number;
  /** 静区宽度（模块数） */
  quiet: number;
  fgColor: string;
  fgColor2: string;
  bgColor: string;
  bgColor2: string;
  gradient: boolean;
  bgGradient: boolean;
  gradientDir: QrGradientDir;
  moduleShape: QrModuleShape;
  eyeShape: QrEyeShape;
  transparentBg: boolean;
}

type Corners = [number, number, number, number];

export const roundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radii: Corners
) => {
  const limit = Math.min(w, h) / 2;
  const [tl, tr, br, bl] = radii.map((r) => Math.max(0, Math.min(r, limit))) as Corners;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  if (tr > 0) ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  if (br > 0) ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  if (bl > 0) ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  if (tl > 0) ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
};

/**
 * 把 QR 模块矩阵绘制到 canvas：支持方形 / 圆角 / 圆点码点，
 * 三种定位点样式、渐变填充、背景渐变与透明背景。
 */
export const drawQrModules = (
  ctx: CanvasRenderingContext2D,
  count: number,
  modules: Uint8Array | number[],
  options: QrRenderOptions
) => {
  const {
    size,
    quiet,
    fgColor,
    fgColor2,
    bgColor,
    bgColor2,
    gradient,
    bgGradient,
    gradientDir,
    moduleShape,
    eyeShape,
    transparentBg,
  } = options;

  const cell = size / (count + quiet * 2);
  const offset = quiet * cell;

  const makePaint = (from: string, to: string) => {
    if (gradientDir === 'horizontal') {
      const g = ctx.createLinearGradient(0, 0, size, 0);
      g.addColorStop(0, from);
      g.addColorStop(1, to);
      return g;
    }
    if (gradientDir === 'vertical') {
      const g = ctx.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, from);
      g.addColorStop(1, to);
      return g;
    }
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, from);
    g.addColorStop(1, to);
    return g;
  };

  // 背景
  if (!transparentBg) {
    ctx.fillStyle = bgGradient ? makePaint(bgColor, bgColor2) : bgColor;
    ctx.fillRect(0, 0, size, size);
  }

  const isDark = (r: number, c: number) =>
    r >= 0 && r < count && c >= 0 && c < count && modules[r * count + c] === 1;
  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= count - 7) || (r >= count - 7 && c < 7);

  const fgPaint = gradient ? makePaint(fgColor, fgColor2) : fgColor;

  // 码点
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!isDark(r, c) || isFinder(r, c)) continue;
      const x = offset + c * cell;
      const y = offset + r * cell;
      ctx.fillStyle = fgPaint;

      if (moduleShape === 'dot') {
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, cell * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (moduleShape === 'rounded') {
        const radius = cell * 0.5;
        const tl = !isDark(r - 1, c) && !isDark(r, c - 1) ? radius : 0;
        const tr = !isDark(r - 1, c) && !isDark(r, c + 1) ? radius : 0;
        const br = !isDark(r + 1, c) && !isDark(r, c + 1) ? radius : 0;
        const bl = !isDark(r + 1, c) && !isDark(r, c - 1) ? radius : 0;
        roundedRectPath(ctx, x, y, cell, cell, [tl, tr, br, bl]);
        ctx.fill();
      } else {
        // 多画 0.6px，避免整数缩放时出现接缝
        ctx.fillRect(x, y, cell + 0.6, cell + 0.6);
      }
    }
  }

  // 三个定位点（外圈 7 模块，内块 3 模块）
  const eyes: Array<[number, number]> = [
    [0, 0],
    [count - 7, 0],
    [0, count - 7],
  ];
  ctx.fillStyle = fgPaint;
  ctx.strokeStyle = fgPaint;
  ctx.lineWidth = cell;

  for (const [mc, mr] of eyes) {
    const bx = offset + mc * cell;
    const by = offset + mr * cell;

    if (eyeShape === 'circle') {
      ctx.beginPath();
      ctx.arc(bx + 3.5 * cell, by + 3.5 * cell, 3 * cell, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(bx + 3.5 * cell, by + 3.5 * cell, 1.5 * cell, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const outerRadius = eyeShape === 'rounded' ? cell * 1.9 : 0;
      roundedRectPath(ctx, bx + cell / 2, by + cell / 2, cell * 6, cell * 6, [
        outerRadius,
        outerRadius,
        outerRadius,
        outerRadius,
      ]);
      ctx.stroke();
      const innerRadius = eyeShape === 'rounded' ? cell * 0.9 : 0;
      roundedRectPath(ctx, bx + cell * 2, by + cell * 2, cell * 3, cell * 3, [
        innerRadius,
        innerRadius,
        innerRadius,
        innerRadius,
      ]);
      ctx.fill();
    }
  }
};
