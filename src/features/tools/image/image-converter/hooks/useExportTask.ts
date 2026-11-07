import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadBlob } from '@/lib/download';
import {
  ConversionError,
  runExport,
  type ConverterSettings,
  type ExportResult,
  type SourceImage,
} from '@/lib/image/convert';

export type ExportStatus = 'idle' | 'running' | 'done' | 'error';

export interface ExportTask {
  status: ExportStatus;
  /** 0–1 */
  progress: number;
  /** 失败提示文案 key */
  errorKey: string | null;
  /** 最近一次成功导出的文件名 */
  fileName: string | null;
  run: () => Promise<void>;
  /** 请求取消：当前这一张处理完后中断，不产生下载 */
  cancel: () => void;
  reset: () => void;
}

interface ExportState {
  status: ExportStatus;
  progress: number;
  errorKey: string | null;
  fileName: string | null;
}

const INITIAL_STATE: ExportState = { status: 'idle', progress: 0, errorKey: null, fileName: null };

const errorKeyOf = (error: unknown): string => {
  const code = error instanceof ConversionError ? error.code : 'encode';
  return `img_conv.error.${code}`;
};

/**
 * 导出任务：设置或素材变化时结果失效，任务带令牌，旧任务不会覆盖新状态。
 *
 * 取消标志与令牌分开：用户点取消时保留令牌，任务能以 cancelled 正常收尾；
 * 而参数变化 / 卸载时提升令牌，任务结果直接丢弃。
 */
export function useExportTask(items: SourceImage[], settings: ConverterSettings): ExportTask {
  const [state, setState] = useState<ExportState>(INITIAL_STATE);
  const tokenRef = useRef(0);
  const cancelRef = useRef(false);

  const reset = useCallback(() => {
    tokenRef.current += 1;
    cancelRef.current = true;
    setState(INITIAL_STATE);
  }, []);

  // 素材或参数变化后，上一次导出的结果/提示都不再适用，进行中的任务也就地取消
  useEffect(() => {
    reset();
  }, [items, settings, reset]);

  useEffect(() => {
    return () => {
      tokenRef.current += 1;
      cancelRef.current = true;
    };
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const run = useCallback(async () => {
    if (items.length === 0) {
      setState({ status: 'error', progress: 0, errorKey: 'img_conv.error.empty', fileName: null });
      return;
    }

    const token = tokenRef.current + 1;
    tokenRef.current = token;
    cancelRef.current = false;
    setState({ status: 'running', progress: 0, errorKey: null, fileName: null });

    try {
      const result: ExportResult = await runExport(items, settings, {
        onProgress: ratio => {
          if (token === tokenRef.current) {
            setState(previous => ({ ...previous, progress: Math.min(1, Math.max(0, ratio)) }));
          }
        },
        shouldCancel: () => cancelRef.current,
      });
      if (token !== tokenRef.current) return;

      // 取消可能发生在最后一步（打包 / 序列化）之后，此时不再触发下载
      if (cancelRef.current) {
        setState(INITIAL_STATE);
        return;
      }

      downloadBlob(result.blob, result.fileName);
      setState({ status: 'done', progress: 1, errorKey: null, fileName: result.fileName });
    } catch (error) {
      if (token !== tokenRef.current) return;

      // 用户取消不是错误，回到初始状态即可
      if (error instanceof ConversionError && error.code === 'cancelled') {
        setState(INITIAL_STATE);
        return;
      }

      console.error(error);
      setState({ status: 'error', progress: 0, errorKey: errorKeyOf(error), fileName: null });
    }
  }, [items, settings]);

  return { ...state, run, cancel, reset };
}
