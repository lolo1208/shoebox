import React, { useRef } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatBytes } from '@/lib/format';
import { MAX_IMAGES, type SourceImage } from '@/lib/image/convert';
import { ACCEPTED_FILE_TYPES } from '../constants';

interface SourceQueueProps {
  items: SourceImage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, offset: number) => void;
  onClear: () => void;
  onAdd: (files: File[]) => void;
  /** 顺序是否影响输出（PDF 页面顺序） */
  orderMatters: boolean;
  /** 已翻译的错误提示 */
  errorText?: string | null;
}

const ICON_BUTTON =
  'rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400';

/**
 * 已导入图片列表：选择预览对象、调整顺序（即 PDF 页面顺序）、移除与追加。
 */
const SourceQueue: React.FC<SourceQueueProps> = ({
  items,
  selectedId,
  onSelect,
  onRemove,
  onMove,
  onClear,
  onAdd,
  orderMatters,
  errorText,
}) => {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">
          {t('img_conv.files.title')}
          <span className="ml-1.5 text-xs font-normal tabular-nums text-gray-400">
            {items.length} / {MAX_IMAGES}
          </span>
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-primary-300 hover:text-primary-600"
          >
            <Plus size={13} />
            {t('common.import')}
          </button>
          <button
            type="button"
            onClick={onClear}
            title={t('common.clear')}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:border-red-300 hover:text-red-600"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
        {items.map((item, index) => {
          const active = item.id === selectedId;
          return (
            <li
              key={item.id}
              className={`group flex items-center gap-1 rounded-lg border px-1.5 py-1 transition-colors ${
                active ? 'border-primary-300 bg-primary-50/50' : 'border-transparent hover:bg-gray-50'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none"
              >
                <img
                  src={item.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-9 w-9 shrink-0 rounded border border-gray-200 object-cover"
                />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-gray-800">{item.name}</span>
                  <span className="block text-[11px] tabular-nums text-gray-400">
                    {item.width}×{item.height} · {formatBytes(item.size)}
                  </span>
                </span>
              </button>

              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => onMove(item.id, -1)}
                  disabled={index === 0}
                  title={t('img_conv.files.up')}
                  className={ICON_BUTTON}
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(item.id, 1)}
                  disabled={index === items.length - 1}
                  title={t('img_conv.files.down')}
                  className={ICON_BUTTON}
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  title={t('img_conv.files.remove')}
                  className={ICON_BUTTON}
                >
                  <X size={13} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {orderMatters && items.length > 1 && (
        <p className="text-[11px] text-gray-400">{t('img_conv.files.hint')}</p>
      )}
      {errorText && <p className="text-xs text-red-500">{errorText}</p>}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_FILE_TYPES}
        className="hidden"
        onChange={event => {
          if (event.target.files) onAdd(Array.from(event.target.files));
          event.target.value = '';
        }}
      />
    </div>
  );
};

export default SourceQueue;
