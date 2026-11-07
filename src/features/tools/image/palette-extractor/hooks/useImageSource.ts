/// <reference lib="dom" />
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadImageElement } from '@/lib/image/loadImage';

export interface ImageSource {
  image: HTMLImageElement;
  url: string;
  name: string;
  width: number;
  height: number;
  size: number;
}

/**
 * 管理当前导入的图片：ObjectURL 生命周期、格式校验与解码失败处理。
 * 所有工具状态（提取结果、取色）都从这里的 image 派生。
 */
export function useImageSource() {
  const [source, setSource] = useState<ImageSource | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  // 连续导入（如快速连按 Ctrl+V）时只保留最后一次，避免异步解码竞态
  const sequenceRef = useRef(0);

  // 等新图真正渲染后再回收旧 URL，避免切换/卸载瞬间出现裂图
  useEffect(() => {
    if (!source) return undefined;
    return () => URL.revokeObjectURL(source.url);
  }, [source]);

  const openBlob = useCallback(async (blob: Blob, name: string) => {
    if (!blob.type.startsWith('image/')) {
      setErrorKey('palette.err_invalid');
      return false;
    }

    const url = URL.createObjectURL(blob);
    const sequence = sequenceRef.current + 1;
    sequenceRef.current = sequence;

    try {
      const image = await loadImageElement(url);
      if (sequence !== sequenceRef.current) {
        URL.revokeObjectURL(url);
        return false;
      }
      setSource({
        image,
        url,
        name,
        width: image.naturalWidth,
        height: image.naturalHeight,
        size: blob.size,
      });
      setErrorKey(null);
      return true;
    } catch {
      URL.revokeObjectURL(url);
      if (sequence === sequenceRef.current) setErrorKey('palette.err_decode');
      return false;
    }
  }, []);

  const openFile = useCallback((file: File) => openBlob(file, file.name), [openBlob]);

  const clear = useCallback(() => {
    // 使仍在解码中的导入失效，避免清空后又被写回
    sequenceRef.current += 1;
    setSource(null);
    setErrorKey(null);
  }, []);

  return { source, errorKey, openFile, openBlob, clear };
}
