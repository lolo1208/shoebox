/// <reference lib="dom" />
import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Pipette, RefreshCw, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { pickImagePixel, rgbToHex } from '@/lib/image/palette';
import type { RGB } from '@/lib/image/palette';
import { formatBytes } from '@/lib/format';
import type { ImageSource } from '../hooks/useImageSource';
import { CHECKERBOARD_BACKGROUND } from '@/styles/checkerboard';


interface ImagePanelProps {
  source: ImageSource | null;
  errorKey: string | null;
  onFile: (file: File) => void;
  onClear: () => void;
  onPick: (color: RGB) => void;
}

/** 图片导入面板：拖拽 / 选择 / 粘贴导入，并在预览图上直接取色 */
const ImagePanel: React.FC<ImagePanelProps> = ({ source, errorKey, onFile, onClear, onPick }) => {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; hex: string; flip: boolean } | null>(null);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = Array.from(event.clipboardData?.items ?? []);
      const imageItem = items.find(item => item.type.startsWith('image/'));
      const file = imageItem?.getAsFile();
      if (!file) return;
      event.preventDefault();
      onFile(file);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onFile]);

  // 换图后旧图的悬停取色已无意义
  useEffect(() => setHover(null), [source]);

  const handlePreviewClick = (event: React.MouseEvent<HTMLImageElement>) => {
    if (!source) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const color = pickImagePixel(
      source.image,
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height,
    );
    if (color) onPick(color);
  };

  // 悬停实时显示光标下的精确颜色，取色前就能看到结果
  const handlePreviewMove = (event: React.MouseEvent<HTMLImageElement>) => {
    if (!source) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const color = pickImagePixel(source.image, x / rect.width, y / rect.height);
    setHover(color ? { x, y, hex: rgbToHex(color), flip: x > rect.width - 96 } : null);
  };

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
        <span className="font-semibold text-sm text-gray-800">{t('palette.source')}</span>
        {source && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
            >
              <RefreshCw size={13} />
              {t('palette.change')}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <X size={13} />
              {t('palette.remove')}
            </button>
          </div>
        )}
      </div>

      <div
        className="p-4 space-y-3"
        onDragOver={event => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={event => {
          // 子元素间移动也会触发 dragleave，仅在真正离开面板时收起高亮
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={event => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={event => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            event.target.value = '';
          }}
        />

        {!source ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={`w-full h-56 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition-all ${
              dragging
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
            }`}
          >
            <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mb-3">
              <ImagePlus size={26} />
            </div>
            <p className="text-sm font-semibold text-gray-800">{t('palette.upload_title')}</p>
            <p className="text-xs text-gray-500 mt-1 px-6">{t('palette.upload_desc')}</p>
            <p className="text-[11px] text-gray-400 mt-3">{t('palette.paste_hint')}</p>
          </button>
        ) : (
          <>
            <div className="relative">
              <div
                className={`rounded-lg overflow-hidden border flex items-center justify-center max-h-64 ${
                  dragging ? 'border-primary-400 ring-2 ring-primary-200' : 'border-gray-200'
                }`}
                style={{ backgroundImage: CHECKERBOARD_BACKGROUND }}
              >
                <img
                  src={source.url}
                  alt={source.name}
                  onClick={handlePreviewClick}
                  onMouseMove={handlePreviewMove}
                  onMouseLeave={() => setHover(null)}
                  className="max-h-64 max-w-full object-contain cursor-crosshair"
                />
              </div>
              {hover && (
                <div
                  className="pointer-events-none absolute z-10 flex items-center gap-1.5 rounded-md bg-gray-900/90 px-2 py-1 font-mono text-[10px] text-white shadow-lg"
                  style={{
                    left: hover.x,
                    top: hover.y,
                    transform: hover.flip
                      ? 'translate(-100%, -50%) translateX(-12px)'
                      : 'translate(12px, -50%)',
                  }}
                >
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: hover.hex }} />
                  {hover.hex.toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex items-start gap-2 text-[11px] text-gray-500">
              <Pipette size={13} className="mt-0.5 shrink-0 text-primary-500" />
              <span>{t('palette.eyedropper_hint')}</span>
            </div>

            <div className="text-xs text-gray-500 space-y-1">
              <p className="truncate font-medium text-gray-700" title={source.name}>
                {source.name}
              </p>
              <p className="font-mono">
                {source.width} × {source.height} · {formatBytes(source.size)}
              </p>
            </div>
          </>
        )}

        {errorKey && <p className="text-xs text-red-500">{t(errorKey)}</p>}
      </div>
    </section>
  );
};

export default ImagePanel;
