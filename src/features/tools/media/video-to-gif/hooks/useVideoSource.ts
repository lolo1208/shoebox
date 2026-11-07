import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { isVideoFile, readSourceInfo, type GifSourceInfo } from '@/lib/media/gif';

export type SourceStatus = 'idle' | 'loading' | 'ready' | 'error';
export type SourceError = 'invalid' | 'load' | null;

export interface VideoSource {
  videoRef: RefObject<HTMLVideoElement | null>;
  file: File | null;
  url: string | null;
  info: GifSourceInfo | null;
  status: SourceStatus;
  error: SourceError;
  /** 载入新视频（校验类型并生成 object URL） */
  load: (file: File) => boolean;
  /** 清空当前视频 */
  reset: () => void;
}

/**
 * 视频源装载：维护 object URL 生命周期并读取时长 / 分辨率。
 *
 * GIF 的帧率由用户指定，因此不需要像抽帧工具那样探测源帧率，
 * 只需等 <video> 元数据就绪即可开始配置导出参数。
 */
export function useVideoSource(): VideoSource {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [info, setInfo] = useState<GifSourceInfo | null>(null);
  const [status, setStatus] = useState<SourceStatus>('idle');
  const [error, setError] = useState<SourceError>(null);

  // url 变化或组件卸载时回收上一份 object URL
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  const load = useCallback((next: File) => {
    if (!isVideoFile(next)) {
      setError('invalid');
      return false;
    }
    setError(null);
    setInfo(null);
    setStatus('loading');
    setFile(next);
    setUrl(URL.createObjectURL(next));
    return true;
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    setUrl(null);
    setInfo(null);
    setStatus('idle');
    setError(null);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!url || !video) return;

    let cancelled = false;

    const onLoadedMetadata = () => {
      if (cancelled) return;
      setInfo(readSourceInfo(video));
      setStatus('ready');
    };

    const onError = () => {
      if (cancelled) return;
      setStatus('error');
      setError('load');
    };

    if (video.readyState >= 1 && video.videoWidth > 0) {
      onLoadedMetadata();
    } else {
      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('error', onError);
    }

    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onError);
    };
  }, [url]);

  return { videoRef, file, url, info, status, error, load, reset };
}
