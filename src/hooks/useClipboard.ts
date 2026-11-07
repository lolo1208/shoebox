import { useCallback, useEffect, useRef, useState } from 'react';

type CopyKey = string | number;

/**
 * 剪贴板复制与“已复制”状态。
 * key 用于区分同一页面内多个复制按钮。
 */
export function useClipboard(resetMs = 1600) {
  const [copiedKey, setCopiedKey] = useState<CopyKey | null>(null);
  const timerRef = useRef<number | null>(null);

  const copy = useCallback(
    async (text: string, key: CopyKey = 'default') => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          // 非安全上下文回退方案
          const el = document.createElement('textarea');
          el.value = text;
          el.style.cssText = 'position:fixed;opacity:0';
          document.body.appendChild(el);
          el.select();
          document.execCommand('copy');
          el.remove();
        }
      } catch {
        return false;
      }

      setCopiedKey(key);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopiedKey(null), resetMs);
      return true;
    },
    [resetMs],
  );

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const isCopied = useCallback((key: CopyKey = 'default') => copiedKey === key, [copiedKey]);

  return { copy, copiedKey, isCopied };
}
