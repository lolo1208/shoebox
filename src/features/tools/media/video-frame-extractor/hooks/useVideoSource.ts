import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { estimateFrameRate, isVideoFile, readProbe, type VideoProbe } from '@/lib/media/frames';

export type SourceStatus = 'idle' | 'loading' | 'ready' | 'error';
export type SourceError = 'invalid' | 'load' | null;

export interface VideoSource {
  videoRef: RefObject<HTMLVideoElement | null>;
  file: File | null;
  url: string | null;
  probe: VideoProbe | null;
  status: SourceStatus;
  error: SourceError;
  /** 载入新视频（校验类型并生成 object URL） */
  load: (file: File) => boolean;
  /** 清空当前视频 */
  reset: () => void;
}

/**
 * 视频源装载：维护 object URL 生命周期、读取基础信息并尽力探测帧率。
 *
 * 帧率探测会短暂静音播放，因此放在 metadata 就绪之后异步进行，
 * 不阻塞首屏渲染。
 */
export function useVideoSource(): VideoSource {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [probe, setProbe] = useState<VideoProbe | null>(null);
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
    setProbe(null);
    setStatus('loading');
    setFile(next);
    setUrl(URL.createObjectURL(next));
    return true;
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    setUrl(null);
    setProbe(null);
    setStatus('idle');
    setError(null);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!url || !video) return;

    let cancelled = false;

    const onLoadedMetadata = async () => {
      const base = readProbe(video);
      if (cancelled) return;
      setProbe(base);
      setStatus('ready');

      const fps = await estimateFrameRate(video, { shouldAbort: () => cancelled }).catch(() => null);
      if (cancelled) return;
      setProbe(current => ({ ...(current ?? base), fps }));
    };

    const onError = () => {
      if (cancelled) return;
      setStatus('error');
      setError('load');
    };

    if (video.readyState >= 1 && video.videoWidth > 0) {
      void onLoadedMetadata();
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

  return { videoRef, file, url, probe, status, error, load, reset };
}
