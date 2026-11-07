import React, { useRef, useState } from 'react';
import { Film, ShieldCheck, Upload } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface VideoDropZoneProps {
  /** 返回 false 表示文件类型不被接受 */
  onFile: (file: File) => boolean;
  /** 已翻译的错误提示 */
  error?: string | null;
  /** 主标题（默认读取 vfx 文案） */
  title?: string;
  /** 副标题（默认读取 vfx 文案） */
  description?: string;
  /** 扩展名提示文本 */
  formats?: string;
}

/**
 * 视频导入区：点击 / 拖拽 / 键盘操作，附隐私说明。
 * 抽帧与转 GIF 共用，文案由调用方注入。
 */
const VideoDropZone: React.FC<VideoDropZoneProps> = ({
  onFile,
  error,
  title,
  description,
  formats = 'MP4 / MOV / WEBM / MKV',
}) => {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = () => inputRef.current?.click();

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={pick}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            pick();
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
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 ${
          dragging ? 'border-primary-400 bg-primary-50/60' : 'border-gray-200 bg-gray-50 hover:border-primary-300 hover:bg-primary-50/40'
        }`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary-600 shadow-sm">
          <Upload size={22} />
        </div>
        <div>
          <p className="text-base font-semibold text-gray-900">{title ?? t('vfx.drop_title')}</p>
          <p className="mt-1 text-sm text-gray-500">{description ?? t('vfx.drop_desc')}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-gray-400">
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1">
            <Film size={12} />
            {formats}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1">
            <ShieldCheck size={12} />
            {t('vfx.drop_privacy')}
          </span>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="video/*,.mkv,.mov,.m4v"
        className="hidden"
        onChange={event => {
          handleFiles(event.target.files);
          event.target.value = '';
        }}
      />
    </div>
  );
};

export default VideoDropZone;
