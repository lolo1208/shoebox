import React, { useEffect, useMemo, useState } from 'react';
import VideoDropZone from '@/components/media/VideoDropZone';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  buildGifPlan,
  DEFAULT_GIF_SETTINGS,
  normalizeSettings,
  stripExtension,
  type GifSettings,
} from '@/lib/media/gif';
import GifResultPanel from './components/GifResultPanel';
import GifSettingsPanel from './components/GifSettingsPanel';
import VideoPreview from './components/VideoPreview';
import { useGifConversion } from './hooks/useGifConversion';
import { useVideoSource } from './hooks/useVideoSource';

/**
 * 视频转 GIF。
 *
 * 页面只做状态编排：视频源 → 导出计划 → ffmpeg.wasm 编码 → 预览 / 下载。
 * 参数推导在 @/lib/media/gif（纯逻辑），编码引擎同样位于该模块，
 * 展示组件在 ./components，任务编排在 ./hooks。
 */
const VideoToGif: React.FC = () => {
  const { t } = useLanguage();

  // 画质参数跨会话保留，区间在拿到视频时长后重置为整段
  const [storedSettings, setStoredSettings] = useLocalStorage<GifSettings>(
    'tool-video-gif-settings',
    DEFAULT_GIF_SETTINGS,
  );

  const source = useVideoSource();
  const conversion = useGifConversion();
  const [playhead, setPlayhead] = useState(0);

  const duration = source.info?.duration ?? 0;
  const baseName = useMemo(
    () => (source.file ? stripExtension(source.file.name) : 'animation'),
    [source.file],
  );

  // 读取时即归一化，避免本地缓存里的旧值/越界值进入 UI
  const settings = useMemo(
    () => normalizeSettings({ ...DEFAULT_GIF_SETTINGS, ...storedSettings }, source.info),
    [storedSettings, source.info],
  );

  // 换片 / 元数据就绪后把区间重置为整段视频
  useEffect(() => {
    if (duration <= 0) return;
    setStoredSettings(current => ({ ...DEFAULT_GIF_SETTINGS, ...current, start: 0, end: duration }));
    // 仅由时长变化触发，避免用户拖区间时被覆盖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const plan = useMemo(() => buildGifPlan(settings, source.info, baseName), [settings, source.info, baseName]);

  const updateSettings = (patch: Partial<GifSettings>) => setStoredSettings({ ...settings, ...patch });

  const stopRunning = () => {
    if (conversion.status === 'running') conversion.cancel();
  };

  const handleFile = (file: File) => {
    const ok = source.load(file);
    if (!ok) return false;
    stopRunning();
    conversion.clear();
    setPlayhead(0);
    return true;
  };

  const handleRemove = () => {
    stopRunning();
    conversion.clear();
    source.reset();
    setPlayhead(0);
  };

  const handleRun = () => {
    if (!source.file || conversion.status === 'running' || plan.duration <= 0) return;
    // 编码由 ffmpeg.wasm 在 Worker 中完成，先暂停本地播放减少争抢
    source.videoRef.current?.pause();
    void conversion.run(source.file, plan);
  };

  const sourceErrorText =
    source.error === 'invalid' ? t('gif.error.invalid') : source.error === 'load' ? t('gif.error.load') : null;

  const conversionErrorText =
    conversion.status === 'error' && conversion.error
      ? conversion.error === 'load'
        ? t('gif.error.engine')
        : conversion.error === 'empty'
          ? t('gif.error.empty')
          : t('gif.error.encode')
      : null;

  const noticeText = conversion.status === 'cancelled' ? t('gif.error.cancelled') : null;
  const stale = conversion.result ? conversion.result.signature !== plan.signature : false;
  const showStage = Boolean(source.url) && source.status !== 'error';

  if (!showStage) {
    return (
      <div className="mx-auto max-w-3xl">
        <VideoDropZone
          onFile={handleFile}
          error={sourceErrorText}
          title={t('gif.drop_title')}
          description={t('gif.drop_desc')}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="xl:col-start-1 xl:row-start-1">
        <VideoPreview
          videoRef={source.videoRef}
          src={source.url as string}
          fileName={source.file?.name ?? ''}
          fileSize={source.file?.size ?? 0}
          info={source.info}
          selection={{ start: settings.start, end: settings.end }}
          busy={conversion.status === 'running'}
          onPlayhead={setPlayhead}
          onReplace={handleFile}
          onRemove={handleRemove}
        />
      </div>

      <div className="xl:sticky xl:top-6 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:self-start">
        <GifSettingsPanel
          settings={settings}
          plan={plan}
          info={source.info}
          playhead={playhead}
          running={conversion.status === 'running'}
          phase={conversion.phase}
          progress={conversion.progress}
          ready={Boolean(source.info)}
          errorText={conversionErrorText}
          noticeText={noticeText}
          onChange={updateSettings}
          onRun={handleRun}
          onCancel={conversion.cancel}
        />
      </div>

      <div className="xl:col-start-1 xl:row-start-2">
        <GifResultPanel
          result={conversion.result}
          stale={stale}
          running={conversion.status === 'running'}
          onRegenerate={handleRun}
        />
      </div>
    </div>
  );
};

export default VideoToGif;
