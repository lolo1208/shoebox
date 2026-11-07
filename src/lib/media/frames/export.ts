/**
 * 抽帧结果的导出：单张下载与 ZIP 打包。
 */

import JSZip from 'jszip';
import { downloadBlob } from '@/lib/download';
import type { ExportedFrame } from './types';

/** 下载单帧 */
export function downloadFrame(frame: ExportedFrame): void {
  downloadBlob(frame.blob, frame.name);
}

/** 打包文件名（去掉模板占位符后的安全主部） */
export function buildZipName(base: string, count: number): string {
  const safeBase = (base || 'frames').replace(/[\\/:*?"<>|]/g, '_').trim() || 'frames';
  return `${safeBase}_${count}frames.zip`;
}

/**
 * 把帧批量打包为 ZIP 并触发下载。
 * 重名文件自动追加序号，保证压缩包内不丢帧。
 */
export async function downloadFramesAsZip(
  frames: ExportedFrame[],
  zipName: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  if (frames.length === 0) return;

  const zip = new JSZip();
  const used = new Map<string, number>();

  for (const frame of frames) {
    let name = frame.name;
    const seen = used.get(name);
    if (seen === undefined) {
      used.set(name, 1);
    } else {
      used.set(name, seen + 1);
      const dot = name.lastIndexOf('.');
      name = dot > 0 ? `${name.slice(0, dot)}(${seen})${name.slice(dot)}` : `${name}(${seen})`;
    }
    zip.file(name, frame.blob);
  }

  const blob = await zip.generateAsync({ type: 'blob' }, metadata => onProgress?.(metadata.percent));
  downloadBlob(blob, zipName);
  onProgress?.(100);
}
