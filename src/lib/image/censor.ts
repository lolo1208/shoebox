/** 图像打码（马赛克 / 模糊 / 纯色）的数据模型与纯函数 */

export type CensorMode = 'pixelate' | 'blur' | 'solid';
export type CensorShape = 'rect' | 'ellipse';
export type CensorHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface CensorRegionStyle {
  mode: CensorMode;
  shape: CensorShape;
  blockPct: number;
  blurPct: number;
  color: string;
}

export interface CensorRegion extends CensorRegionStyle {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type CensorDrag =
  | { kind: 'create'; id: string; ox: number; oy: number }
  | { kind: 'move'; id: string; ox: number; oy: number; rect: CensorRegion }
  | { kind: 'resize'; id: string; handle: CensorHandle; ox: number; oy: number; rect: CensorRegion };

/** 预览画布最大边长，避免超大图占用过多内存 */
export const PREVIEW_MAX = 1600;
/** 区域最小尺寸（预览坐标） */
export const MIN_SIZE = 4;

export const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const uid = () => Math.random().toString(36).slice(2, 10);
export const snapshot = (regions: CensorRegion[]): CensorRegion[] => regions.map(r => ({ ...r }));

export const normalizeMode = (value: unknown): CensorMode =>
  value === 'blur' || value === 'solid' ? value : 'pixelate';

export const normalizeShape = (value: unknown): CensorShape => (value === 'ellipse' ? 'ellipse' : 'rect');

export const safeHex = (value: unknown) =>
  typeof value === 'string' && HEX_RE.test(value) ? value : '#000000';

export const clampNumber = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? clamp(n, min, max) : fallback;
};

/** 读取区域样式并校正越界值 */
export const pickStyle = (region: CensorRegion): CensorRegionStyle => ({
  mode: normalizeMode(region.mode),
  shape: normalizeShape(region.shape),
  blockPct: clampNumber(region.blockPct, 0.4, 10, 1.6),
  blurPct: clampNumber(region.blurPct, 0.1, 4, 0.8),
  color: safeHex(region.color),
});
