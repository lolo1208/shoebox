import React, { type ReactNode } from 'react';
import { Camera, Hash, ScanSearch, Timer, X } from 'lucide-react';
import { Field, FIELD_CLASS, NumberField, Segmented } from '@/components/ui/FormField';
import { useLanguage } from '@/contexts/LanguageContext';
import { FRAME_NAME_TOKENS, MAX_FRAMES, MIN_INTERVAL, type CaptureMode, type FrameFormat } from '@/lib/media/frames';
import {
  COUNT_MAX,
  COUNT_MIN,
  FORMAT_LABELS,
  FORMAT_OPTIONS,
  INTERVAL_PRESETS,
  MAX_SIZE_OPTIONS,
  THRESHOLD_MAX,
  THRESHOLD_MIN,
  type CaptureSettings,
} from '../constants';
import type { CapturePhase } from '../hooks/useFrameCapture';

interface CapturePanelProps {
  settings: CaptureSettings;
  onChange: (patch: Partial<CaptureSettings>) => void;
  duration: number;
  /** 预计帧数（已按上限截断） */
  estimate: number;
  /** 原始帧数超过单次上限 */
  truncated: boolean;
  running: boolean;
  phase: CapturePhase;
  progress: number;
  done: number;
  total: number;
  webpSupported: boolean;
  /** 视频元数据是否就绪（未就绪时不允许开始抽帧） */
  ready: boolean;
  /** 已翻译的错误提示 */
  errorText: string | null;
  onRun: () => void;
  onCancel: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const SECTION = 'text-[11px] font-semibold uppercase tracking-wide text-gray-400';
const FIELD = FIELD_CLASS;

/** 抽帧参数面板：模式、区间、输出与命名 */
const CapturePanel: React.FC<CapturePanelProps> = ({
  settings,
  onChange,
  duration,
  estimate,
  truncated,
  running,
  phase,
  progress,
  done,
  total,
  webpSupported,
  ready,
  errorText,
  onRun,
  onCancel,
}) => {
  const { t } = useLanguage();

  const modes: { value: CaptureMode; label: string; icon: ReactNode }[] = [
    { value: 'interval', label: t('vfx.mode.interval'), icon: <Timer size={13} /> },
    { value: 'count', label: t('vfx.mode.count'), icon: <Hash size={13} /> },
    { value: 'scene', label: t('vfx.mode.scene'), icon: <ScanSearch size={13} /> },
  ];

  const formats: { value: FrameFormat; label: string }[] = FORMAT_OPTIONS.filter(
    format => format !== 'webp' || webpSupported,
  ).map(format => ({ value: format, label: FORMAT_LABELS[format] }));

  const progressLabel =
    phase === 'scan'
      ? t('vfx.running.scan', { percent: Math.round(progress * 100) })
      : t('vfx.running.capture', { done, total });

  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900">{t('vfx.panel_title')}</h3>

      <div className={`space-y-5 ${running ? 'pointer-events-none opacity-60' : ''}`}>
        <div className="space-y-2">
          <Segmented value={settings.mode} options={modes} onChange={mode => onChange({ mode })} />
          <p className="text-[11px] leading-relaxed text-gray-400">{t(`vfx.mode.${settings.mode}.desc`)}</p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-gray-600">{t('vfx.range')}</span>
            <button
              type="button"
              onClick={() => onChange({ start: 0, end: duration })}
              className="text-[11px] text-primary-600 hover:underline"
            >
              {t('vfx.range_full')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              value={settings.start}
              onChange={start => onChange({ start: clamp(start, 0, Math.max(0, settings.end - 0.01)) })}
              min={0}
              max={Math.max(0, duration)}
              step={0.1}
              suffix={t('vfx.unit_sec')}
            />
            <NumberField
              value={settings.end}
              onChange={end => onChange({ end: clamp(end, settings.start, Math.max(settings.start, duration)) })}
              min={0}
              max={Math.max(0, duration)}
              step={0.1}
              suffix={t('vfx.unit_sec')}
            />
          </div>
        </div>

        {settings.mode === 'interval' && (
          <Field label={t('vfx.interval')} hint={t('vfx.interval_min', { min: MIN_INTERVAL })}>
            <div className="flex flex-wrap gap-1.5">
              {INTERVAL_PRESETS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChange({ interval: preset })}
                  className={`rounded-md border px-2 py-1 text-xs tabular-nums transition-colors ${
                    settings.interval === preset
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-600'
                  }`}
                >
                  {preset}s
                </button>
              ))}
            </div>
            <NumberField
              value={settings.interval}
              onChange={interval => onChange({ interval })}
              min={MIN_INTERVAL}
              max={600}
              step={0.1}
              suffix={t('vfx.unit_sec')}
            />
          </Field>
        )}

        {settings.mode === 'count' && (
          <Field label={t('vfx.count')} hint={t('vfx.count_hint')}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={COUNT_MIN}
                max={COUNT_MAX}
                step={1}
                value={clamp(settings.count, COUNT_MIN, COUNT_MAX)}
                onChange={event => onChange({ count: Number(event.target.value) })}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-primary-600"
              />
              <div className="w-20 shrink-0">
                <NumberField
                  value={settings.count}
                  onChange={count => onChange({ count })}
                  min={COUNT_MIN}
                  max={MAX_FRAMES}
                />
              </div>
            </div>
          </Field>
        )}

        {settings.mode === 'scene' && (
          <>
            <Field
              label={t('vfx.threshold')}
              hint={`${Math.round(settings.threshold)}%`}
            >
              <input
                type="range"
                min={THRESHOLD_MIN}
                max={THRESHOLD_MAX}
                step={1}
                value={clamp(settings.threshold, THRESHOLD_MIN, THRESHOLD_MAX)}
                onChange={event => onChange({ threshold: Number(event.target.value) })}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-primary-600"
              />
              <p className="text-[11px] text-gray-400">{t('vfx.threshold_hint')}</p>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('vfx.min_gap')}>
                <NumberField
                  value={settings.minGap}
                  onChange={minGap => onChange({ minGap })}
                  min={0}
                  max={30}
                  step={0.1}
                  suffix={t('vfx.unit_sec')}
                />
              </Field>
              <Field label={t('vfx.scene_step')}>
                <NumberField
                  value={settings.sceneStep}
                  onChange={sceneStep => onChange({ sceneStep })}
                  min={0.1}
                  max={10}
                  step={0.1}
                  suffix={t('vfx.unit_sec')}
                />
              </Field>
            </div>
          </>
        )}

        <div className="space-y-2 border-t border-gray-100 pt-4">
          <span className={SECTION}>{t('vfx.output')}</span>
          <Segmented value={settings.format} options={formats} onChange={format => onChange({ format })} />
          {settings.format !== 'png' && (
            <Field label={t('vfx.quality')} hint={`${Math.round(settings.quality * 100)}%`}>
              <input
                type="range"
                min={0.3}
                max={1}
                step={0.01}
                value={settings.quality}
                onChange={event => onChange({ quality: Number(event.target.value) })}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-primary-600"
              />
            </Field>
          )}
          <Field label={t('vfx.max_size')}>
            <select
              value={settings.maxSize}
              onChange={event => onChange({ maxSize: Number(event.target.value) })}
              className={FIELD}
            >
              {MAX_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>
                  {size === 0 ? t('vfx.size_original') : `${size}px`}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="space-y-2 border-t border-gray-100 pt-4">
          <span className={SECTION}>{t('vfx.naming')}</span>
          <input
            type="text"
            value={settings.template}
            onChange={event => onChange({ template: event.target.value })}
            placeholder="{name}_{index}"
            className={`${FIELD} font-mono text-xs`}
          />
          <div className="flex flex-wrap gap-1">
            {FRAME_NAME_TOKENS.map(token => (
              <button
                key={token}
                type="button"
                onClick={() => onChange({ template: `${settings.template}${token}` })}
                className="rounded border border-gray-200 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 hover:border-primary-300 hover:text-primary-600"
                title={t(`vfx.token.${token.replace(/[{}]/g, '')}`)}
              >
                {token}
              </button>
            ))}
          </div>
          <Field label={t('vfx.naming_digits')}>
            <NumberField value={settings.digits} onChange={digits => onChange({ digits })} min={1} max={8} />
          </Field>
        </div>
      </div>

      <div className="space-y-3 border-t border-gray-100 pt-4">
        <div className="rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-700">
          {settings.mode === 'scene'
            ? t('vfx.estimate_scene', { n: estimate })
            : t('vfx.estimate', { n: estimate })}
          {truncated && <span className="mt-1 block text-amber-600">{t('vfx.estimate_limit', { n: MAX_FRAMES })}</span>}
        </div>

        {settings.mode !== 'scene' && settings.maxSize === 0 && estimate > 120 && (
          <p className="text-[11px] leading-relaxed text-amber-600">{t('vfx.memory_hint')}</p>
        )}

        {running ? (
          <div className="space-y-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-primary-500 transition-[width] duration-150"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">{progressLabel}</p>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <X size={16} />
              {t('vfx.cancel')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onRun}
            disabled={!ready}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Camera size={16} />
            {t('vfx.run')}
          </button>
        )}

        {errorText && <p className="text-xs text-red-500">{errorText}</p>}
      </div>
    </div>
  );
};

export default CapturePanel;
