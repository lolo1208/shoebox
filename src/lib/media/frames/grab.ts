/**
 * 基于 <video> + <canvas> 的逐帧抓取器。
 *
 * 流程：seek 到目标时间 → 等待该帧真正呈现 → 绘制到 canvas → 编码为 Blob。
 * 相比 ffmpeg.wasm 方案无需下载 30MB+ 的核心，抽帧是浏览器原生能力。
 */

import { FRAME_FORMAT_MIME } from './naming';
import type { FrameFormat, GrabOptions, GrabbedFrame } from './types';

/** 单次 seek 的兜底超时（毫秒），超时后继续，避免个别容器卡死整批任务 */
const SEEK_TIMEOUT = 8000;

/** 等待「下一帧已呈现」的超时（毫秒） */
const PRESENT_TIMEOUT = 300;

type FrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number, metadata: { mediaTime: number }) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/** canvas → Blob，附带 toDataURL 回退 */
export function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== 'function') {
      try {
        const dataUrl = canvas.toDataURL(mime, quality);
        const [head, body] = dataUrl.split(',');
        const binary = atob(body);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        resolve(new Blob([bytes], { type: head.replace(/^data:|;base64$/g, '') }));
      } catch (error) {
        reject(error);
      }
      return;
    }
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('encode-failed'))),
      mime,
      mime === 'image/png' ? undefined : quality,
    );
  });
}

/** 浏览器是否支持把 canvas 编码为该格式 */
export function isFormatSupported(format: FrameFormat): boolean {
  if (format === 'png') return true;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL(FRAME_FORMAT_MIME[format]).startsWith(`data:${FRAME_FORMAT_MIME[format]}`);
  } catch {
    return false;
  }
}

/** 视频容器是否可能被浏览器解码（不保证，最终以 <video> 事件为准） */
export function isVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true;
  return /\.(mp4|m4v|webm|ogv|ogg|mov|mkv|avi|flv|wmv)$/i.test(file.name);
}

/** 等一帧呈现：优先 requestVideoFrameCallback，其次双 rAF，最后超时兜底 */
function waitForPresentedFrame(video: HTMLVideoElement): Promise<void> {
  const target = video as FrameCallbackVideo;
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(finish, PRESENT_TIMEOUT);

    if (typeof target.requestVideoFrameCallback === 'function') {
      let handle = 0;
      const cancel = () => {
        if (handle && typeof target.cancelVideoFrameCallback === 'function') target.cancelVideoFrameCallback(handle);
      };
      handle = target.requestVideoFrameCallback(() => {
        cancel();
        finish();
      });
      return;
    }

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(finish));
      return;
    }
    finish();
  });
}

export class FrameGrabber {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;

  constructor(private readonly video: HTMLVideoElement) {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  get duration(): number {
    return Number.isFinite(this.video.duration) ? this.video.duration : 0;
  }

  /** 绑定的 video 元素，供调用方判断是否需要重建抓帧器 */
  get element(): HTMLVideoElement {
    return this.video;
  }

  /** seek 到指定时间并确保对应帧已呈现 */
  async seekTo(time: number): Promise<void> {
    const video = this.video;
    const limit = Math.max(0, this.duration - 0.001);
    const target = Math.min(Math.max(time, 0), limit);

    if (video.readyState >= 2 && Math.abs(video.currentTime - target) < 0.002) {
      await waitForPresentedFrame(video);
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
        window.clearTimeout(timer);
      };
      const onSeeked = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('seek-failed'));
      };
      const timer = window.setTimeout(() => {
        cleanup();
        // 超时意味着目标帧未就绪（大文件 / 长 GOP），宁可报错也不默默截到旧帧
        reject(new Error('seek-timeout'));
      }, SEEK_TIMEOUT);

      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', onError);
      try {
        video.currentTime = target;
      } catch (error) {
        cleanup();
        reject(error);
      }
    });

    await waitForPresentedFrame(video);
  }

  /** 把当前画面绘制到 canvas（含缩放与 JPEG 白底） */
  private draw(options: GrabOptions): { width: number; height: number } {
    const ctx = this.ctx;
    if (!ctx) throw new Error('canvas-unavailable');

    const sourceWidth = this.video.videoWidth;
    const sourceHeight = this.video.videoHeight;
    if (!sourceWidth || !sourceHeight) throw new Error('frame-unavailable');

    let width = sourceWidth;
    let height = sourceHeight;
    if (options.maxSize > 0) {
      const longest = Math.max(sourceWidth, sourceHeight);
      if (longest > options.maxSize) {
        const scale = options.maxSize / longest;
        width = Math.round(sourceWidth * scale);
        height = Math.round(sourceHeight * scale);
      }
    }
    width = Math.max(1, width);
    height = Math.max(1, height);

    this.canvas.width = width;
    this.canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    if (options.format === 'jpeg') {
      // JPEG 不支持透明通道，先铺白底避免出现黑块
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(this.video, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height);

    return { width, height };
  }

  /** 把当前画面缩放绘制到外部 canvas 上下文（场景检测等用途） */
  drawTo(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
    const { videoWidth, videoHeight } = this.video;
    if (!videoWidth || !videoHeight) return false;
    ctx.drawImage(this.video, 0, 0, videoWidth, videoHeight, 0, 0, width, height);
    return true;
  }

  /** 抓取指定时间点的一帧 */
  async capture(time: number, options: GrabOptions): Promise<GrabbedFrame> {
    await this.seekTo(time);
    return this.captureCurrent(options);
  }

  /** 抓取当前画面（不 seek） */
  async captureCurrent(options: GrabOptions): Promise<GrabbedFrame> {
    const { width, height } = this.draw(options);
    const mime = FRAME_FORMAT_MIME[options.format];
    const blob = await canvasToBlob(this.canvas, mime, options.quality);
    return { blob, width, height };
  }

  /** 释放 canvas 占用的位图内存 */
  dispose(): void {
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
