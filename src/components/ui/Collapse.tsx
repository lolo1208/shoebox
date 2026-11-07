import React from 'react';

export interface CollapseProps {
  /** 是否展开 */
  open: boolean;
  children: React.ReactNode;
  /** 动画时长（毫秒），默认 200ms */
  duration?: number;
  /** 外层容器类名 */
  className?: string;
  /** 内层内容类名（内边距、分隔线等写在这里，收起时才会被裁干净） */
  innerClassName?: string;
}

/**
 * 高度自动过渡的折叠容器。
 *
 * 采用 `grid-template-rows: 0fr ↔ 1fr` 方案，不需要测量子元素高度，
 * 内容变化时也能保持正确的展开高度；收起后通过 visibility 让内部
 * 控件退出 Tab 焦点顺序。
 */
const Collapse: React.FC<CollapseProps> = ({
  open,
  children,
  duration = 200,
  className = '',
  innerClassName = '',
}) => (
  <div
    className={`collapse-panel ${className}`}
    data-open={open ? 'true' : 'false'}
    style={{ '--collapse-duration': `${duration}ms` } as React.CSSProperties}
  >
    <div className={`collapse-inner ${innerClassName}`} aria-hidden={!open}>
      {children}
    </div>
  </div>
);

export default Collapse;
