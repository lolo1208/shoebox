import React, { useRef, useState } from 'react';
import { Images, ShieldCheck, Upload } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ACCEPTED_FILE_TYPES } from '../constants';

interface ImageDropZoneProps {
  onFiles: (files: File[]) => void;
  /** 已翻译的错误提示 */
  errorText?: string | null;
}

const FORMAT_HINT = 'JPG / PNG / WebP / GIF / BMP';

/**
 * 图片导入区：点击、拖拽或键盘操作，支持一次选择多张。
 * 导入的全部文件都留在本地内存中，不做任何上传。
 */
const ImageDropZone: React.FC<ImageDropZoneProps> = ({ onFiles, errorText }) => {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onFiles(Array.from(files));
  };

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={event => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={event => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={event => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500/30 ${
          dragging
            ? 'border-primary-400 bg-primary-50/60'
            : 'border-gray-200 bg-gray-50 hover:border-primary-300 hover:bg-primary-50/40'
        }`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary-600 shadow-sm">
          <Upload size={22} />
        </div>
        <div>
          <p className="text-base font-semibold text-gray-900">{t('img_conv.upload_title')}</p>
          <p className="mt-1 text-sm text-gray-500">{t('img_conv.upload_desc')}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-gray-400">
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1">
            <Images size={12} />
            {FORMAT_HINT}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1">
            <ShieldCheck size={12} />
            {t('img_conv.private')}
          </span>
        </div>
      </div>

      {errorText && <p className="text-sm text-red-500">{errorText}</p>}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_FILE_TYPES}
        className="hidden"
        onChange={event => {
          handleFiles(event.target.files);
          event.target.value = '';
        }}
      />
    </div>
  );
};

export default ImageDropZone;
