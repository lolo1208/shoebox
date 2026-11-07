/**
 * 颜色直方图与量化。
 *
 * 流程：像素 → 5bit/通道直方图（按桶累加精确均值）→ 中位切分（median cut）
 * → Lab 空间 k-means 精修。桶化让 400 万像素的图片也能在毫秒级完成聚类。
 */

import { deltaE, rgbToLab, type Lab, type RGB } from './color';

/** 直方图每个通道的位数，5bit 即 32768 个桶，肉眼几乎无损失 */
const HIST_BITS = 5;
const HIST_SHIFT = 8 - HIST_BITS;
const HIST_MASK = (1 << HIST_BITS) - 1;
const HIST_SIZE = 1 << (HIST_BITS * 3);

/** 低于该 alpha 的像素视为透明，不参与统计 */
const ALPHA_THRESHOLD = 16;
/** 近白 / 近黑判定阈值（各通道同时满足） */
const NEAR_WHITE = 245;
const NEAR_BLACK = 12;

export interface ColorBin {
  rgb: RGB;
  /** 该颜色在采样中的像素数 */
  count: number;
  lab: Lab;
}

export interface SampleFilters {
  ignoreTransparent?: boolean;
  ignoreNearWhite?: boolean;
  ignoreNearBlack?: boolean;
}

export interface Histogram {
  bins: ColorBin[];
  /** 参与统计的像素数 */
  total: number;
  /** 被过滤掉的像素数 */
  filtered: number;
}

const makeBin = (rgb: RGB, count: number): ColorBin => ({ rgb, count, lab: rgbToLab(rgb) });

/** 在采样像素上建立加权颜色直方图 */
export function buildHistogram(rgba: Uint8ClampedArray, filters: SampleFilters = {}): Histogram {
  const counts = new Uint32Array(HIST_SIZE);
  const sums = new Float64Array(HIST_SIZE * 3);
  let total = 0;
  let filtered = 0;

  const ignoreTransparent = filters.ignoreTransparent !== false;
  const ignoreNearWhite = filters.ignoreNearWhite === true;
  const ignoreNearBlack = filters.ignoreNearBlack === true;

  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = rgba[i + 3];
    if (ignoreTransparent && alpha < ALPHA_THRESHOLD) {
      filtered += 1;
      continue;
    }

    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];

    if (ignoreNearWhite && r >= NEAR_WHITE && g >= NEAR_WHITE && b >= NEAR_WHITE) {
      filtered += 1;
      continue;
    }
    if (ignoreNearBlack && r <= NEAR_BLACK && g <= NEAR_BLACK && b <= NEAR_BLACK) {
      filtered += 1;
      continue;
    }

    const key =
      (((r >> HIST_SHIFT) & HIST_MASK) << (HIST_BITS * 2)) |
      (((g >> HIST_SHIFT) & HIST_MASK) << HIST_BITS) |
      ((b >> HIST_SHIFT) & HIST_MASK);

    counts[key] += 1;
    sums[key * 3] += r;
    sums[key * 3 + 1] += g;
    sums[key * 3 + 2] += b;
    total += 1;
  }

  const bins: ColorBin[] = [];
  for (let key = 0; key < HIST_SIZE; key += 1) {
    const count = counts[key];
    if (!count) continue;
    const rgb: RGB = {
      r: sums[key * 3] / count,
      g: sums[key * 3 + 1] / count,
      b: sums[key * 3 + 2] / count,
    };
    bins.push(makeBin(rgb, count));
  }

  return { bins, total, filtered };
}

export function weightedAverage(bins: ColorBin[]): ColorBin | null {
  let count = 0;
  let r = 0;
  let g = 0;
  let b = 0;

  for (const bin of bins) {
    count += bin.count;
    r += bin.rgb.r * bin.count;
    g += bin.rgb.g * bin.count;
    b += bin.rgb.b * bin.count;
  }

  if (!count) return null;
  return makeBin({ r: r / count, g: g / count, b: b / count }, count);
}

/** 直方图按数量降序 */
export const sortByCount = (bins: ColorBin[]): ColorBin[] => [...bins].sort((a, b) => b.count - a.count);

interface Box {
  bins: ColorBin[];
  count: number;
}

const makeBox = (bins: ColorBin[]): Box => ({
  bins,
  count: bins.reduce((sum, bin) => sum + bin.count, 0),
});

/** 跨度最大的通道（0=r, 1=g, 2=b） */
function dominantChannel(bins: ColorBin[]): 0 | 1 | 2 {
  let minR = 255;
  let maxR = 0;
  let minG = 255;
  let maxG = 0;
  let minB = 255;
  let maxB = 0;

  for (const bin of bins) {
    const { r, g, b } = bin.rgb;
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (g < minG) minG = g;
    if (g > maxG) maxG = g;
    if (b < minB) minB = b;
    if (b > maxB) maxB = b;
  }

  const rangeR = maxR - minR;
  const rangeG = maxG - minG;
  const rangeB = maxB - minB;
  if (rangeG >= rangeR && rangeG >= rangeB) return 1;
  if (rangeB >= rangeR && rangeB >= rangeG) return 2;
  return 0;
}

const channelKey = ['r', 'g', 'b'] as const;

/** 沿最大跨度通道按像素量中位线切分盒子 */
function splitBox(box: Box): [Box, Box] | null {
  if (box.bins.length < 2) return null;

  const channel = channelKey[dominantChannel(box.bins)];
  const sorted = [...box.bins].sort((a, b) => a.rgb[channel] - b.rgb[channel]);

  const half = box.count / 2;
  let acc = 0;
  let splitAt = 0;
  for (let i = 0; i < sorted.length - 1; i += 1) {
    acc += sorted[i].count;
    if (acc >= half) {
      splitAt = i + 1;
      break;
    }
  }
  if (!splitAt) splitAt = sorted.length - 1;

  const left = sorted.slice(0, splitAt);
  const right = sorted.slice(splitAt);
  if (!left.length || !right.length) return null;

  return [makeBox(left), makeBox(right)];
}

/** 盒子内 RGB 任一通道的最大跨度（0–255） */
function boxRange(box: Box): number {
  const min = [255, 255, 255];
  const max = [0, 0, 0];

  for (const bin of box.bins) {
    const values = [bin.rgb.r, bin.rgb.g, bin.rgb.b];
    for (let channel = 0; channel < 3; channel += 1) {
      if (values[channel] < min[channel]) min[channel] = values[channel];
      if (values[channel] > max[channel]) max[channel] = values[channel];
    }
  }

  return Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
}

/** 中位切分：把直方图切成 count 个颜色簇 */
export function medianCut(bins: ColorBin[], count: number): ColorBin[] {
  if (!bins.length || count <= 0) return [];
  if (count >= bins.length) return sortByCount(bins);

  let boxes: Box[] = [makeBox(bins)];

  while (boxes.length < count) {
    let target = -1;
    let bestScore = -1;

    for (let i = 0; i < boxes.length; i += 1) {
      const box = boxes[i];
      if (box.bins.length < 2) continue;
      // 优先切分「像素多、跨度大」的盒子，避免切出大量肉眼难辨的颜色
      const score = box.count * Math.max(boxRange(box), 1);
      if (score > bestScore) {
        bestScore = score;
        target = i;
      }
    }

    if (target < 0) break;

    const parts = splitBox(boxes[target]);
    if (!parts) break;

    boxes = [...boxes.slice(0, target), parts[0], parts[1], ...boxes.slice(target + 1)];
  }

  return boxes
    .map(box => weightedAverage(box.bins))
    .filter((bin): bin is ColorBin => bin !== null);
}

/**
 * Lab 空间 k-means 精修。
 * 以中位切分的结果作为初始中心，迭代重分配直方图桶，收敛后返回按像素量排序的簇。
 */
export function refineClusters(bins: ColorBin[], seeds: ColorBin[], iterations = 8): ColorBin[] {
  if (!bins.length || !seeds.length) return sortByCount(seeds);

  let centers = seeds.map(seed => ({ rgb: seed.rgb, lab: seed.lab, count: seed.count }));

  for (let iter = 0; iter < iterations; iter += 1) {
    const acc = centers.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));

    for (const bin of bins) {
      let nearest = 0;
      let nearestDistance = Infinity;
      for (let i = 0; i < centers.length; i += 1) {
        const distance = deltaE(bin.lab, centers[i].lab);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = i;
        }
      }
      const target = acc[nearest];
      target.r += bin.rgb.r * bin.count;
      target.g += bin.rgb.g * bin.count;
      target.b += bin.rgb.b * bin.count;
      target.count += bin.count;
    }

    let maxShift = 0;
    const next = centers.map((center, i) => {
      const bucket = acc[i];
      if (!bucket.count) return { ...center, count: 0 };
      const rgb: RGB = {
        r: bucket.r / bucket.count,
        g: bucket.g / bucket.count,
        b: bucket.b / bucket.count,
      };
      const lab = rgbToLab(rgb);
      maxShift = Math.max(maxShift, deltaE(lab, center.lab));
      return { rgb, lab, count: bucket.count };
    });

    centers = next;
    if (maxShift < 0.5) break;
  }

  return centers
    .filter(center => center.count > 0)
    .map(center => makeBin(center.rgb, center.count))
    .sort((a, b) => b.count - a.count);
}

/** 中位切分 + k-means 的完整量化流程 */
export function quantizeColors(bins: ColorBin[], count: number): ColorBin[] {
  if (!bins.length) return [];
  const seeds = medianCut(bins, count);
  return refineClusters(bins, seeds);
}

/** 合并 Lab 距离小于阈值的簇（视觉上几乎相同的颜色） */
export function mergeSimilar(clusters: ColorBin[], threshold: number): ColorBin[] {
  if (threshold <= 0 || clusters.length < 2) return sortByCount(clusters);

  const merged: ColorBin[] = [];
  for (const cluster of sortByCount(clusters)) {
    const neighbor = merged.find(item => deltaE(item.lab, cluster.lab) <= threshold);
    if (!neighbor) {
      merged.push({ ...cluster, rgb: { ...cluster.rgb }, lab: { ...cluster.lab } });
      continue;
    }

    const count = neighbor.count + cluster.count;
    const rgb: RGB = {
      r: (neighbor.rgb.r * neighbor.count + cluster.rgb.r * cluster.count) / count,
      g: (neighbor.rgb.g * neighbor.count + cluster.rgb.g * cluster.count) / count,
      b: (neighbor.rgb.b * neighbor.count + cluster.rgb.b * cluster.count) / count,
    };
    neighbor.rgb = rgb;
    neighbor.count = count;
    neighbor.lab = rgbToLab(rgb);
  }

  return sortByCount(merged);
}
