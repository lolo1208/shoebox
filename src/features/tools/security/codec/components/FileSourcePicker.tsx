import React, { useRef, useState } from 'react';
import { FileText, FileUp, Loader2, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatBytes } from '@/lib/format';

export interface PickedFile {
  name: string;
  size: number;
}

interface FileSourcePickerProps {
  file: PickedFile | null;
  reading: boolean;
  errorText: string | null;
  onPick: (file: File) => void;
  onClear: () => void;
}

/**
 * 文件来源选择区：只在编码方向、且编码族需要字节时出现。
 * 文件内容由调用方读取，这里只负责选择、展示与移除。
 */
const FileSourcePicker: React.FC<FileSourcePickerProps> = ({ file, reading, errorText, onPick, onClear }) => {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onPick(dropped);
  };

  return (
    <div className="h-full p-3 flex flex-col">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          const next = event.target.files?.[0];
          if (next) onPick(next);
          event.target.value = '';
        }}
      />

      {file ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 bg-primary-50 text-primary-600 rounded-lg shrink-0">
                <FileText size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
              </div>
            </div>
            <button
              onClick={onClear}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              title={t('codec.file_remove')}
              aria-label={t('codec.file_remove')}
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-[11px] text-gray-400">{t('codec.file_loaded')}</p>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all group ${
            dragging ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
          }`}
        >
          <div className="w-12 h-12 bg-gray-100 group-hover:bg-primary-100 rounded-full flex items-center justify-center mb-2 text-gray-400 group-hover:text-primary-600 transition-colors">
            <FileUp size={22} />
          </div>
          <p className="text-sm font-medium text-gray-700">{reading ? t('codec.file_reading') : t('codec.file_pick')}</p>
          <p className="text-[11px] text-gray-400 mt-1">{t('codec.file_hint')}</p>
        </div>
      )}

      {reading && file && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-gray-500">
          <Loader2 size={12} className="animate-spin" />
          {t('codec.file_reading')}
        </p>
      )}

      {errorText && <p className="mt-2 text-[11px] text-red-600 break-all">{errorText}</p>}
    </div>
  );
};

export default FileSourcePicker;
