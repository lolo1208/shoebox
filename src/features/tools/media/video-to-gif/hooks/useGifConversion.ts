import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GifEngine,
  GifEngineError,
  type GifErrorCode,
  type GifPhase,
  type GifPlan,
  type GifResult,
} from '@/lib/media/gif';

export type ConversionStatus = 'idle' | 'running' | 'done' | 'error' | 'cancelled';

/** 带预览地址的转换结果（对象 URL 由本 hook 统一回收） */
export interface GifPreview extends GifResult {
  previewUrl: string;
}

export interface GifConversion {
  status: ConversionStatus;
  phase: GifPhase | null;
  /** 0–1 */
  progress: number;
  error: GifErrorCode | null;
  result: GifPreview | null;
  /** 执行转换；同一时间只允许一个任务 */
  run: (file: File, plan: GifPlan) => Promise<void>;
  cancel: () => void;
  /** 清空结果（不影响已加载的引擎） */
  clear: () => void;
}

interface ConversionState {
  status: ConversionStatus;
  phase: GifPhase | null;
  progress: number;
  error: GifErrorCode | null;
  result: GifPreview | null;
}

const INITIAL_STATE: ConversionState = {
  status: 'idle',
  phase: null,
  progress: 0,
  error: null,
  result: null,
};

/**
 * GIF 转换任务编排：调用引擎、维护进度与结果、回收预览 URL。
 *
 * 引擎懒创建：只有真正点击生成时才实例化并下载 ffmpeg 核心；
 * 组件卸载时终止 Worker，避免后台继续占用内存与 CPU。
 *
 * 每次任务带一个自增 token，清空 / 换片后旧任务的回调不会覆盖新状态。
 */
export function useGifConversion(): GifConversion {
  const engineRef = useRef<GifEngine | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const tokenRef = useRef(0);
  const busyRef = useRef(false);
  const [state, setState] = useState<ConversionState>(INITIAL_STATE);

  const releasePreview = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      tokenRef.current += 1;
      busyRef.current = false;
      engineRef.current?.dispose();
      engineRef.current = null;
      releasePreview();
    };
  }, [releasePreview]);

  const run = useCallback(
    async (file: File, plan: GifPlan) => {
      if (busyRef.current) return;

      const engine = engineRef.current ?? new GifEngine();
      engineRef.current = engine;

      const token = tokenRef.current + 1;
      tokenRef.current = token;
      const isCurrent = () => tokenRef.current === token;

      busyRef.current = true;
      releasePreview();
      setState({ status: 'running', phase: 'loading', progress: 0, error: null, result: null });

      try {
        const result = await engine.convert(file, plan, {
          onPhase: phase => {
            if (!isCurrent()) return;
            setState(prev => (prev.status === 'running' ? { ...prev, phase } : prev));
          },
          onProgress: progress => {
            if (!isCurrent()) return;
            setState(prev => (prev.status === 'running' ? { ...prev, progress } : prev));
          },
        });

        if (!isCurrent()) return;

        const previewUrl = URL.createObjectURL(result.blob);
        previewUrlRef.current = previewUrl;
        setState({
          status: 'done',
          phase: null,
          progress: 1,
          error: null,
          result: { ...result, previewUrl },
        });
      } catch (error) {
        if (!isCurrent()) return;

        if (error instanceof GifEngineError && error.code === 'cancelled') {
          setState({ status: 'cancelled', phase: null, progress: 0, error: 'cancelled', result: null });
          return;
        }
        const code = error instanceof GifEngineError ? error.code : 'encode';
        setState({ status: 'error', phase: null, progress: 0, error: code, result: null });
      } finally {
        if (isCurrent()) busyRef.current = false;
      }
    },
    [releasePreview],
  );

  const cancel = useCallback(() => {
    engineRef.current?.cancel();
  }, []);

  const clear = useCallback(() => {
    // 让进行中的任务回调失效，避免覆盖新视频的状态
    tokenRef.current += 1;
    if (busyRef.current) engineRef.current?.cancel();
    busyRef.current = false;
    releasePreview();
    setState(INITIAL_STATE);
  }, [releasePreview]);

  return { ...state, run, cancel, clear };
}
