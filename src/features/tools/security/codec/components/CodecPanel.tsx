import React from 'react';
import { AlertCircle, Info } from 'lucide-react';

/** 输入 / 输出面板统一的正文高度，保证左右两栏对齐且超长结果不会把页面撑开 */
export const CODEC_BODY_CLASS = 'h-[260px] lg:h-[320px]';

interface CodecPanelProps {
  title: string;
  value: string;
  placeholder: string;
  /** 头部右侧的统计信息（字符数 / 位元组数） */
  meta?: string;
  /** 头部操作区按钮 */
  actions?: React.ReactNode;
  /** 底部区域，用于放置识别提示等轻量内容 */
  footer?: React.ReactNode;
  /** 自定义主体（如文件选择区），优先于文本输入 / 只读结果 */
  body?: React.ReactNode;
  editable?: boolean;
  onChange?: (value: string) => void;
  /** 文本域的无障碍名称 */
  label?: string;
  errorText?: string | null;
  noteTexts?: string[];
}

/**
 * 编解码面板：输入与输出共用同一套骨架，
 * 由 `body` / `editable` 决定正文渲染文本域、只读文本还是自定义内容。
 */
const CodecPanel: React.FC<CodecPanelProps> = ({
  title,
  value,
  placeholder,
  meta,
  actions,
  footer,
  body,
  editable = false,
  onChange,
  label,
  errorText,
  noteTexts,
}) => {
  const renderBody = () => {
    if (errorText) {
      return (
        <div className={`${CODEC_BODY_CLASS} p-3 flex items-start gap-2 overflow-auto text-xs text-red-600 bg-red-50/70`}>
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span className="break-all">{errorText}</span>
        </div>
      );
    }

    if (body) return <div className={`${CODEC_BODY_CLASS} overflow-auto`}>{body}</div>;

    if (editable) {
      return (
        <textarea
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder={placeholder}
          aria-label={label || title}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          className={`${CODEC_BODY_CLASS} w-full p-3 font-mono text-xs leading-5 border-0 bg-white text-gray-800 resize-none break-all placeholder:text-gray-300 focus:outline-none focus:ring-0`}
        />
      );
    }

    return (
      <pre
        className={`${CODEC_BODY_CLASS} p-3 m-0 font-mono text-xs leading-5 whitespace-pre-wrap break-all overflow-auto text-gray-800`}
      >
        {value || <span className="text-gray-300 italic">{placeholder}</span>}
      </pre>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-gray-100">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-medium text-gray-700 shrink-0">{title}</span>
          {meta && <span className="text-[11px] text-gray-400 truncate">{meta}</span>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">{actions}</div>
      </div>

      {renderBody()}

      {noteTexts && noteTexts.length > 0 && (
        <div className="px-3 py-2 border-t border-amber-100 bg-amber-50/70 space-y-1">
          {noteTexts.map((note) => (
            <p key={note} className="flex items-start gap-1.5 text-[11px] leading-4 text-amber-700">
              <Info size={12} className="mt-0.5 shrink-0" />
              <span>{note}</span>
            </p>
          ))}
        </div>
      )}

      {footer && <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/60">{footer}</div>}
    </div>
  );
};

export default CodecPanel;
