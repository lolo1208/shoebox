/**
 * 调色板图片渲染。
 *
 * 直接用 Canvas 绘制色卡（不依赖 SVG 光栅化），导出的 PNG 可直接放进设计稿或文档。
 * 默认以 2x 分辨率绘制，高分屏与打印场景下文字依旧清晰。
 */

import { readableOn } from './color';
import type { PaletteColor } from './extract';

interface SwatchSheetOptions {
  columns?: number;
  /** 单个色块边长（CSS px） */
  cell?: number;
  showShare?: boolean;
  /** 输出倍率，默认 2x */
  pixelRatio?: number;
}

const MONO_FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';

export function renderSwatchSheet(colors: PaletteColor[], options: SwatchSheetOptions = {}): HTMLCanvasElement {
  const cell = options.cell ?? 148;
  const ratio = Math.max(1, Math.round(options.pixelRatio ?? 2));
  const columns = Math.max(1, Math.min(options.columns ?? 6, colors.length || 1));
  const rows = Math.max(1, Math.ceil(colors.length / columns));
  const labelHeight = Math.round(cell * 0.36);
  const width = columns * cell;
  const height = rows * (cell + labelHeight);

  const canvas = document.createElement('canvas');
  canvas.width = width * ratio;
  canvas.height = height * ratio;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  colors.forEach((color, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * cell;
    const y = row * (cell + labelHeight);

    ctx.fillStyle = color.hex;
    ctx.fillRect(x, y, cell, cell);

    ctx.fillStyle = readableOn(color.rgb);
    ctx.font = `600 ${Math.round(cell * 0.085)}px ${MONO_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(color.hex.toUpperCase(), x + cell / 2, y + cell / 2);

    ctx.fillStyle = '#1c1f23';
    ctx.font = `500 ${Math.round(cell * 0.078)}px ${MONO_FONT}`;
    ctx.fillText(color.hex.toUpperCase(), x + cell / 2, y + cell + labelHeight * 0.42);

    if (options.showShare !== false) {
      ctx.fillStyle = '#888d92';
      ctx.font = `400 ${Math.round(cell * 0.066)}px ${MONO_FONT}`;
      ctx.fillText(`${(color.share * 100).toFixed(1)}%`, x + cell / 2, y + cell + labelHeight * 0.75);
    }

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
  });

  return canvas;
}
