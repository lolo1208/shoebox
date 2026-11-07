import React, { useEffect, useMemo } from 'react';
import VideoDropZone from '@/components/media/VideoDropZone';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  isFormatSupported,
  MAX_FRAMES,
  planFrames,
  predictFrameCount,
  stripExtension,
  type PlanOptions,
} from '@/lib/media/frames';
import CapturePanel from './components/CapturePanel';
import FrameGallery from './components/FrameGallery';
import VideoStage from './components/VideoStage';
import { DEFAULT_SETTINGS, type CaptureSettings } from './constants';
import { useFrameCapture } from './hooks/useFrameCapture';
import { useVideoSource } from './hooks/useVideoSource';

/**
 * 视频抽帧（截图取帧）。
 *
 * 页面只负责状态编排：视频源 → 抽帧计划 → 逐帧抓取 → 预览 / 导出。
 * 抓帧与规划算法在 @/lib/media/frames，展示组件在 ./components。
 */
const VideoFrameExtractor: React.FC = () => {
  const { t } = useLanguage();
  // 抽帧参数跨会话保留，仅区间会随视频时长重置
  const [storedSettings, setStoredSettings] = useLocalStorage<CaptureSettings>(
    'tool-video-frame-settings',
    DEFAULT_SETTINGS,
  );
  const settings = useMemo<CaptureSettings>(
    () => ({ ...DEFAULT_SETTINGS, ...storedSettings }),
    [storedSettings],
  );

  const source = useVideoSource();
  const capture = useFrameCapture(source.videoRef, source.probe);

  const duration = source.probe?.duration ?? 0;
  const baseName = useMemo(() => (source.file ? stripExtension(source.file.name) : 'frame'), [source.file]);

  // 换片 / 元数据就绪后把区间重置为整段视频
  useEffect(() => {
    if (duration <= 0) return;
    setStoredSettings(current => ({ ...DEFAULT_SETTINGS, ...current, start: 0, end: duration }));
    // 仅由时长变化触发，避免用户拖区间时被覆盖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const updateSettings = (patch: Partial<CaptureSettings>) => setStoredSettings({ ...settings, ...patch });

  const planOptions: PlanOptions = useMemo(
    () => ({
      mode: settings.mode,
      duration,
      // 场景模式用独立的采样步长，其余模式用等间隔步长
      interval: settings.mode === 'scene' ? settings.sceneStep : settings.interval,
      count: settings.count,
      start: settings.start,
      end: settings.end,
    }),
    [duration, settings.count, settings.end, settings.interval, settings.mode, settings.sceneStep, settings.start],
  );

  const { estimate, truncated } = useMemo(() => {
    const raw = predictFrameCount(planOptions, Number.MAX_SAFE_INTEGER);
    return { estimate: Math.min(raw, MAX_FRAMES), truncated: raw > MAX_FRAMES };
  }, [planOptions]);

  // 场景模式首帧总是保留，即便视频极短也至少 1 帧
  const plannedFrames = useMemo(() => planFrames(planOptions).times.length, [planOptions]);

  const webpSupported = useMemo(() => isFormatSupported('webp'), []);

  const sourceErrorText =
    source.error === 'invalid' ? t('vfx.error.invalid') : source.error === 'load' ? t('vfx.error.load') : null;
  const captureErrorText =
    capture.error === 'empty'
      ? t('vfx.error.empty')
      : capture.error === 'seek'
        ? t('vfx.error.seek')
        : capture.error === 'partial'
          ? t('vfx.error.partial', { n: capture.failed })
          : capture.error === 'generic'
            ? t('vfx.error.generic')
            : null;

  const handleFile = (file: File) => {
    const ok = source.load(file);
    if (ok) {
      capture.cancel();
      capture.clearFrames();
    }
    return ok;
  };

  const handleRemove = () => {
    capture.cancel();
    capture.clearFrames();
    source.reset();
  };

  const showStage = Boolean(source.url) && source.status !== 'error';

  if (!showStage) {
    return (
      <div className="mx-auto max-w-3xl">
        <VideoDropZone onFile={handleFile} error={sourceErrorText} />
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="xl:col-start-1 xl:row-start-1">
        <VideoStage
          videoRef={source.videoRef}
          src={source.url as string}
          fileName={source.file?.name ?? ''}
          fileSize={source.file?.size ?? 0}
          probe={source.probe}
          capturing={capture.running}
          ready={Boolean(source.probe)}
          onCaptureCurrent={() => {
            if (!source.probe) return;
            void capture.captureCurrent({ settings, baseName });
          }}
          onReplace={handleFile}
          onRemove={handleRemove}
        />
      </div>

      <div className="xl:sticky xl:top-6 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:self-start">
        <CapturePanel
          settings={settings}
          onChange={updateSettings}
          duration={duration}
          estimate={settings.mode === 'scene' ? plannedFrames : estimate}
          truncated={settings.mode !== 'scene' && truncated}
          running={capture.running}
          phase={capture.phase}
          progress={capture.progress}
          done={capture.done}
          total={capture.total}
          webpSupported={webpSupported}
          ready={Boolean(source.probe)}
          errorText={captureErrorText}
          onRun={() => {
            if (!source.probe) return;
            void capture.run({ settings, baseName });
          }}
          onCancel={capture.cancel}
        />
      </div>

      <div className="xl:col-start-1 xl:row-start-2">
        <FrameGallery
          frames={capture.frames}
          running={capture.running}
          zipBase={baseName}
          onRemove={capture.removeFrame}
          onClear={capture.clearFrames}
        />
      </div>
    </div>
  );
};

export default VideoFrameExtractor;
