import { useEffect, useRef, useState } from 'react';

export type TaskStatus = 'idle' | 'running' | 'ready' | 'error';

export interface DebouncedTaskState<T> {
  status: TaskStatus;
  /** 上一次成功的结果；重新计算期间保留旧值，避免画面闪烁 */
  result: T | null;
  error: unknown;
}

export interface DebouncedTaskOptions {
  /** 变化即重新执行；传入派生值即可，无需 memo */
  deps: readonly unknown[];
  /** 防抖时长（毫秒） */
  delay?: number;
  /** 为 false 时清空结果并停止调度 */
  enabled?: boolean;
}

/**
 * 防抖 + 任务令牌的异步计算。
 *
 * 参数连续变化时只接受最后一次结果（令牌校验），
 * 且旧结果会保留到新结果就绪，适合「预览随参数实时更新」的场景。
 */
export function useDebouncedTask<T>(run: () => Promise<T>, options: DebouncedTaskOptions): DebouncedTaskState<T> {
  const { deps, delay = 250, enabled = true } = options;
  const runRef = useRef(run);
  runRef.current = run;

  const tokenRef = useRef(0);
  const [state, setState] = useState<DebouncedTaskState<T>>({ status: 'idle', result: null, error: null });

  // 卸载后让仍在执行的任务失效，避免对已卸载组件写入状态
  useEffect(
    () => () => {
      tokenRef.current += 1;
    },
    [],
  );

  useEffect(() => {
    tokenRef.current += 1;
    const token = tokenRef.current;

    if (!enabled) {
      setState({ status: 'idle', result: null, error: null });
      return;
    }

    setState(previous => ({ status: 'running', result: previous.result, error: null }));

    const timer = window.setTimeout(() => {
      // Promise.resolve().then 包一层：任务同步抛错时也能进入错误分支
      void Promise.resolve()
        .then(() => runRef.current())
        .then(
          result => {
            if (token === tokenRef.current) setState({ status: 'ready', result, error: null });
          },
          error => {
            if (token === tokenRef.current) setState({ status: 'error', result: null, error });
          },
        );
    }, delay);

    return () => window.clearTimeout(timer);
    // 由调用方通过 deps 声明依赖，这里不再展开
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, delay, ...deps]);

  return state;
}
