const injected = new Set<string>();

/**
 * 按需注入一份外部样式表（幂等）。
 *
 * 用于只在少数工具里用到、又不想放在 index.html 里阻塞首屏的 CDN 样式，
 * 例如 CheckHost 的国旗图标字体。
 */
export const loadStylesheet = (id: string, href: string): void => {
  if (typeof document === 'undefined') return;
  if (injected.has(id) || document.getElementById(id)) return;
  injected.add(id);

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
};
