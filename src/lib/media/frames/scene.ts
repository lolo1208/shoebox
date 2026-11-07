/**
 * 场景变化检测：在密集采样点上计算画面差异，筛出真正发生切换的帧。
 *
 * 判定方式是对缩略图的灰度均值差（0–100%）做阈值过滤，
 * 不追求与 ffmpeg scene 分数完全一致，但足够用于「抓关键画面」。
 */

import type { FrameGrabber } from './grab';

/** 差异计算使用的缩略图尺寸（越小越快，精度足够） */
const THUMB_WIDTH = 48;
const THUMB_HEIGHT = 27;

export interface SceneScanOptions {
  /** 差异阈值（0–100，越大越挑剔） */
  threshold: number;
  /** 两次保留之间的最小间隔（秒） */
  minGap: number;
  /** 最多保留的帧数 */
  maxFrames: number;
  onProgress?: (done: number, total: number) => void;
  shouldCancel?: () => boolean;
}

interface GrayFrame {
  data: Uint8ClampedArray;
}

function diffPercent(a: GrayFrame, b: GrayFrame): number {
  const length = Math.min(a.data.length, b.data.length);
  if (!length) return 0;
  let sum = 0;
  for (let i = 0; i < length; i += 1) sum += Math.abs(a.data[i] - b.data[i]);
  return (sum / length / 255) * 100;
}

function toGray(image: ImageData): GrayFrame {
  const { data, width, height } = image;
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < gray.length; i += 1, p += 4) {
    gray[i] = (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000;
  }
  return { data: gray };
}

/** 抓取一帧并转成灰度缩略图，用于计算差异 */
async function sampleGray(grabber: FrameGrabber, time: number, canvas: HTMLCanvasElement): Promise<GrayFrame | null> {
  await grabber.seekTo(time);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  if (!grabber.drawTo(ctx, THUMB_WIDTH, THUMB_HEIGHT)) return null;

  return toGray(ctx.getImageData(0, 0, THUMB_WIDTH, THUMB_HEIGHT));
}

/**
 * 从候选时间点中挑出场景切换帧。
 * 首帧恒被保留，后续仅在差异超阈值且满足最小间隔时保留。
 */
export async function detectSceneChanges(
  grabber: FrameGrabber,
  times: number[],
  options: SceneScanOptions,
): Promise<number[]> {
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_WIDTH;
  canvas.height = THUMB_HEIGHT;

  const threshold = Math.min(Math.max(options.threshold, 0), 100);
  const selected: number[] = [];
  let previous: GrayFrame | null = null;

  for (let i = 0; i < times.length; i += 1) {
    if (options.shouldCancel?.()) break;

    const time = times[i];
    const gray = await sampleGray(grabber, time, canvas);
    options.onProgress?.(i + 1, times.length);
    if (!gray) continue;

    if (!previous) {
      selected.push(time);
      previous = gray;
      continue;
    }

    const changed = diffPercent(previous, gray) >= threshold;
    previous = gray;
    if (!changed) continue;

    const last = selected[selected.length - 1];
    if (last !== undefined && time - last < options.minGap) continue;
    if (selected.length >= Math.max(1, options.maxFrames)) break;

    selected.push(time);
  }

  canvas.width = 0;
  canvas.height = 0;
  return selected;
}
