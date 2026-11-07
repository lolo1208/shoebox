/**
 * GIF 编码引擎：对 ffmpeg.wasm 的轻量封装。
 *
 * 职责边界：
 * - 懒加载核心（首次约 30MB，按镜像顺序重试），避免打开工具就下载；
 * - 把导出计划翻译成命令并执行（命令构建在 command.ts，保持纯函数）；
 * - 聚合进度（ffmpeg progress 事件 + 日志里的 frame= 计数，取较大值）；
 * - 支持取消：终止 Worker 而非仅丢弃 Promise，避免后台继续占用 CPU；
 * - 调色板滤镜不可用时自动降级为直接编码，保证仍能产出文件。
 *
 * 不接触 React，可被任意 UI 复用。
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { FFMPEG_CORE_MIRRORS } from './constants';
import { buildGifCommand } from './command';
import { fileExtension } from './source';
import type {
  GifCommand,
  GifConvertHandlers,
  GifErrorCode,
  GifMode,
  GifPlan,
  GifResult,
} from './types';

/** 保留的 ffmpeg 日志行数，用于补充错误信息 */
const LOG_LIMIT = 40;

/** 判定「调色板滤镜不可用」的日志特征，命中后尝试降级编码 */
const PALETTE_FAILURE = /no such filter|unknown filter|not found|error parsing filterchain|palettegen|paletteuse/i;

/** 运行环境统一取时（Node 测试环境没有 performance） */
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const describe = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** 引擎错误：code 供 UI 映射文案 */
export class GifEngineError extends Error {
  readonly code: GifErrorCode;

  constructor(code: GifErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'GifEngineError';
    this.code = code;
  }
}

export class GifEngine {
  /** 已就绪的 ffmpeg 实例（同一实例可复用多次转换） */
  private active: FFmpeg | null = null;
  /** 正在加载中的实例（并发调用共享同一 Promise） */
  private loading: Promise<FFmpeg> | null = null;
  /** 当前转换的取消信号 */
  private abort: AbortController | null = null;
  private cancelled = false;
  private disposed = false;

  /** 当前 exec 的进度（0–1，单调递增） */
  private progress = 0;
  /** 当前 exec 的预期帧数，用于把 frame= 日志换算成进度 */
  private expectedFrames = 0;
  /** 日志里最后一次 frame= 计数，作为实际输出帧数 */
  private encodedFrames = 0;
  private progressListener: ((ratio: number) => void) | null = null;
  private logs: string[] = [];

  /** 核心是否已经加载完成 */
  get loaded(): boolean {
    return this.active !== null;
  }

  /**
   * 转换视频为 GIF。
   * 取消或销毁时抛出 code 为 cancelled 的 GifEngineError。
   */
  async convert(file: File, plan: GifPlan, handlers: GifConvertHandlers = {}): Promise<GifResult> {
    if (this.disposed) throw new GifEngineError('cancelled', 'engine disposed');
    if (!(plan.duration > 0)) throw new GifEngineError('empty', 'empty clip');

    const startedAt = now();
    this.cancelled = false;
    this.logs = [];
    this.progressListener = handlers.onProgress ?? null;

    const abort = new AbortController();
    this.abort = abort;
    const { signal } = abort;

    handlers.onPhase?.('loading');
    const ffmpeg = await this.ensureLoaded(signal);
    this.throwIfCancelled();

    handlers.onPhase?.('encoding');
    const inputName = `source${fileExtension(file.name)}`;
    const command = buildGifCommand(plan, inputName);

    try {
      const source = new Uint8Array(await file.arrayBuffer());
      this.throwIfCancelled();

      await ffmpeg.writeFile(inputName, source, { signal });
      this.throwIfCancelled();

      const usedMode = await this.encode(ffmpeg, plan, command, signal);

      handlers.onPhase?.('finalizing');
      this.throwIfCancelled();

      const blob = await this.readOutput(ffmpeg, command, signal);
      handlers.onProgress?.(1);

      return {
        blob,
        fileName: plan.fileName,
        signature: plan.signature,
        width: plan.width,
        height: plan.height,
        frames: this.encodedFrames || plan.frames,
        fps: plan.fps,
        start: plan.start,
        duration: plan.duration,
        bytes: blob.size,
        elapsedMs: Math.round(now() - startedAt),
        mode: usedMode,
        requestedMode: plan.mode,
      };
    } catch (error) {
      // 取消 / 销毁时统一转换为 cancelled，避免 UI 把它当成编码失败
      this.throwIfCancelled();
      throw error;
    } finally {
      this.progressListener = null;
      this.abort = null;
      this.expectedFrames = 0;
      this.encodedFrames = 0;
      await this.cleanup(ffmpeg, inputName, command.outputName);
    }
  }

  /** 中止当前转换：立即终止 Worker，下一次转换会重新加载核心 */
  cancel(): void {
    this.cancelled = true;
    this.abort?.abort();
    this.abort = null;
    this.kill();
  }

  /** 释放引擎（组件卸载时调用） */
  dispose(): void {
    this.disposed = true;
    this.cancel();
  }

  /* ------------------------------- 内部实现 ------------------------------- */

  private ensureLoaded(signal: AbortSignal): Promise<FFmpeg> {
    if (this.disposed) return Promise.reject(new GifEngineError('cancelled', 'engine disposed'));
    if (this.active) return Promise.resolve(this.active);

    if (!this.loading) {
      this.loading = this.spawn(signal).finally(() => {
        this.loading = null;
      });
    }
    return this.loading;
  }

  /** 依次尝试 CDN 镜像加载核心 */
  private async spawn(signal: AbortSignal): Promise<FFmpeg> {
    const failures: string[] = [];

    for (const base of FFMPEG_CORE_MIRRORS) {
      if (signal.aborted) throw new GifEngineError('cancelled', 'aborted');
      const instance = new FFmpeg();
      this.bind(instance);

      try {
        const [coreURL, wasmURL] = await Promise.all([
          toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
          toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
        ]);
        await instance.load({ coreURL, wasmURL }, { signal });

        if (signal.aborted) {
          instance.terminate();
          throw new GifEngineError('cancelled', 'aborted');
        }

        this.active = instance;
        return instance;
      } catch (error) {
        try {
          instance.terminate();
        } catch {
          /* Worker 可能已终止，忽略 */
        }
        if (signal.aborted || error instanceof GifEngineError) {
          throw error instanceof GifEngineError ? error : new GifEngineError('cancelled', describe(error));
        }
        failures.push(describe(error));
      }
    }

    throw new GifEngineError('load', failures.join(' | '));
  }

  /** 执行编码；调色板滤镜缺失时降级为直接编码并返回实际模式 */
  private async encode(
    ffmpeg: FFmpeg,
    plan: GifPlan,
    command: GifCommand,
    signal: AbortSignal,
  ): Promise<GifMode> {
    try {
      await this.run(ffmpeg, command, plan.frames, signal);
      return command.palette ? 'palette' : 'simple';
    } catch (error) {
      this.throwIfCancelled();
      if (!command.palette || !this.paletteUnavailable()) throw error;

      // 个别核心裁剪了 palettegen/paletteuse：清掉半成品后改用直接编码
      await this.cleanup(ffmpeg, command.outputName);
      const fallback = buildGifCommand(plan, command.inputName, { plain: true });
      await this.run(ffmpeg, fallback, plan.frames, signal);
      return 'simple';
    }
  }

  private async run(
    ffmpeg: FFmpeg,
    command: GifCommand,
    expectedFrames: number,
    signal: AbortSignal,
  ): Promise<void> {
    this.throwIfCancelled();
    this.progress = 0;
    this.expectedFrames = expectedFrames;
    this.encodedFrames = 0;
    const code = await ffmpeg.exec(command.args, -1, { signal });
    if (code !== 0) throw new GifEngineError('encode', this.describeError(`ffmpeg exited with ${code}`));
  }

  private async readOutput(ffmpeg: FFmpeg, command: GifCommand, signal: AbortSignal): Promise<Blob> {
    let raw: string | Uint8Array;
    try {
      raw = await ffmpeg.readFile(command.outputName, 'binary', { signal });
    } catch (error) {
      this.throwIfCancelled();
      throw new GifEngineError('empty', this.describeError(error));
    }

    const data = typeof raw === 'string' ? new TextEncoder().encode(raw) : raw;
    if (data.byteLength === 0) throw new GifEngineError('empty', this.describeError('empty output'));

    // Uint8Array 可能来自 Worker 的 transfer，构造 Blob 会复制一份，随后可安全清理
    return new Blob([data as BlobPart], { type: 'image/gif' });
  }

  private bind(instance: FFmpeg): void {
    instance.on('log', ({ message }) => this.handleLog(message));
    instance.on('progress', ({ progress }) => {
      if (Number.isFinite(progress)) this.emitProgress(progress);
    });
  }

  private handleLog(message: string): void {
    this.logs.push(message);
    if (this.logs.length > LOG_LIMIT) this.logs.shift();

    // progress 事件在某些滤镜图下不够准，用 frame= 计数补齐
    const match = /frame=\s*(\d+)/.exec(message);
    if (match && this.expectedFrames > 0) {
      const done = Number(match[1]);
      if (Number.isFinite(done)) {
        this.encodedFrames = done;
        this.emitProgress(done / this.expectedFrames);
      }
    }
  }

  private emitProgress(ratio: number): void {
    const next = Math.min(1, Math.max(0, ratio));
    if (!(next > this.progress)) return;
    this.progress = next;
    this.progressListener?.(next);
  }

  private paletteUnavailable(): boolean {
    return PALETTE_FAILURE.test(this.logs.join('\n'));
  }

  private describeError(error: unknown): string {
    const tail = this.logs.slice(-6).join(' / ');
    return tail ? `${describe(error)} | ${tail}` : describe(error);
  }

  private throwIfCancelled(): void {
    if (this.cancelled || this.disposed) throw new GifEngineError('cancelled', 'aborted');
  }

  /** 终止 Worker 并重置实例，下一次转换重新加载核心 */
  private kill(): void {
    const instance = this.active;
    this.active = null;
    this.loading = null;
    this.progressListener = null;
    if (!instance) return;
    try {
      instance.terminate();
    } catch {
      /* 已终止，忽略 */
    }
  }

  /** 尽力删除虚拟文件系统中的临时文件（实例可能已被取消销毁） */
  private async cleanup(ffmpeg: FFmpeg, ...names: string[]): Promise<void> {
    for (const name of names) {
      try {
        await ffmpeg.deleteFile(name);
      } catch {
        /* 文件不存在或实例已终止，忽略 */
      }
    }
  }
}
