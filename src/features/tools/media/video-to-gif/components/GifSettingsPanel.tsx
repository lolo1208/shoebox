import React, { type ReactNode } from 'react';
import { Wand2, X } from 'lucide-react';
import { Field, FIELD_CLASS, NumberField, Segmented } from '@/components/ui/FormField';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatBytes } from '@/lib/format';
import {
  COLOR_OPTIONS,
  DITHER_OPTIONS,
  FPS_MAX,
  FPS_MIN,
  FPS_OPTIONS,
  LOOP_INFINITE,
  LOOP_ONCE,
  LOOP_OPTIONS,
  SPEED_OPTIONS,
  WIDTH_MAX,
  WIDTH_OPTIONS,
  type GifDither,
  type GifPhase,
  type GifPlan,
  type GifSettings,
  type GifSourceInfo,
} from '@/lib/media/gif';
import { GIF_PRESETS, resolvePresetId } from '../constants';

interface GifSettingsPanelProps {
  settings: GifSettings;
  /** 由设置与源视频推导出的导出计划 */
  plan: GifPlan;
  info: GifSourceInfo | null;
  /** 视频当前播放位置（秒），用于「取当前」按钮 */
  playhead: number;
  running: boolean;
  phase: GifPhase | null;
  /** 0–1 */
  progress: number;
  ready: boolean;
  /** 已翻译的错误提示（红色） */
  errorText: string | null;
  /** 已翻译的中性提示（灰色，例如已停止） */
  noticeText: string | null;
  onChange: (patch: Partial<GifSettings>) => void;
  onRun: () => void;
  onCancel: () => void;
}

const SECTION = 'text-[11px] font-semibold uppercase tracking-wide text-gray-400';

/** 「取当前」这类行内小按钮 */
const LinkButton: React.FC<{ onClick: () => void; children: ReactNode }> = ({ onClick, children }) => (
  <button type="button" onClick={onClick} className="text-[11px] text-primary-600 hover:underline">
    {children}
  </button>
);

/** 参数快捷值按钮 */
const Chip: React.FC<{ active: boolean; onClick: () => void; children: ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-md border px-2 py-1 text-xs tabular-nums transition-colors ${
      active
        ? 'border-primary-500 bg-primary-50 text-primary-700'
        : 'border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-600'
    }`}
  >
    {children}
  </button>
);

/** 视频转 GIF 参数面板：预设、区间、画质、循环与执行 */
const GifSettingsPanel: React.FC<GifSettingsPanelProps> = ({
  settings,
  plan,
  info,
  playhead,
  running,
  phase,
  progress,
  ready,
  errorText,
  noticeText,
  onChange,
  onRun,
  onCancel,
}) => {
  const { t } = useLanguage();

  const presetId = resolvePresetId(settings);
  const duration = info?.duration ?? 0;
  const clipDuration = Math.max(0, settings.end - settings.start);
  const playbackDuration = plan.speed > 0 ? clipDuration / plan.speed : clipDuration;

  const loopLabel = (loop: number) => {
    if (loop === LOOP_INFINITE) return t('gif.loop.infinite');
    if (loop === LOOP_ONCE) return t('gif.loop.once');
    return t('gif.loop.times', { n: loop });
  };

  const progressLabel =
    phase === 'loading'
      ? t('gif.running.loading')
      : phase === 'finalizing'
        ? t('gif.running.finalizing')
        : t('gif.running.encoding', { percent: Math.round(progress * 100) });

  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900">{t('gif.panel_title')}</h3>

      <div className={`space-y-5 ${running ? 'pointer-events-none opacity-60' : ''}`}>
        <div className="space-y-2">
          <span className={SECTION}>{t('gif.presets')}</span>
          <div className="grid grid-cols-3 gap-1.5">
            {GIF_PRESETS.map(preset => {
              const active = presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  title={t(preset.descKey)}
                  onClick={() => onChange(preset.patch)}
                  className={`rounded-lg border px-2 py-2 text-left transition-colors ${
                    active
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                  }`}
                >
                  <span className={`block text-xs font-semibold ${active ? 'text-primary-700' : 'text-gray-700'}`}>
                    {t(preset.nameKey)}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-tight text-gray-400">{t(preset.descKey)}</span>
                </button>
              );
            })}
          </div>
          {presetId === 'custom' && <p className="text-[11px] text-gray-400">{t('gif.preset.custom')}</p>}
        </div>

        <div className="space-y-2 border-t border-gray-100 pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-gray-600">{t('gif.range')}</span>
            <LinkButton onClick={() => onChange({ start: 0, end: duration })}>{t('gif.range_full')}</LinkButton>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t('gif.range_start')}
              hint={<LinkButton onClick={() => onChange({ start: playhead })}>{t('gif.use_playhead')}</LinkButton>}
            >
              <NumberField
                value={settings.start}
                onChange={start => onChange({ start })}
                min={0}
                max={Math.max(0, duration)}
                step={0.1}
                suffix={t('gif.unit_sec')}
              />
            </Field>
            <Field
              label={t('gif.range_end')}
              hint={<LinkButton onClick={() => onChange({ end: playhead })}>{t('gif.use_playhead')}</LinkButton>}
            >
              <NumberField
                value={settings.end}
                onChange={end => onChange({ end })}
                min={0}
                max={Math.max(0, duration)}
                step={0.1}
                suffix={t('gif.unit_sec')}
              />
            </Field>
          </div>
          <p className="text-[11px] text-gray-400">
            {t('gif.range_duration', { value: playbackDuration.toFixed(1) })}
          </p>
        </div>

        <div className="space-y-3 border-t border-gray-100 pt-4">
          <span className={SECTION}>{t('gif.quality')}</span>

          <Field label={t('gif.fps')} hint={`${FPS_MIN}–${FPS_MAX} fps`}>
            <div className="flex flex-wrap gap-1.5">
              {FPS_OPTIONS.map(option => (
                <Chip key={option} active={settings.fps === option} onClick={() => onChange({ fps: option })}>
                  {option}
                </Chip>
              ))}
            </div>
            <NumberField
              value={settings.fps}
              onChange={fps => onChange({ fps })}
              min={FPS_MIN}
              max={FPS_MAX}
              step={0.5}
              suffix="fps"
            />
          </Field>

          <Field
            label={t('gif.width')}
            hint={plan.height > 0 ? `${plan.width}×${plan.height}px` : undefined}
          >
            <div className="flex flex-wrap gap-1.5">
              {WIDTH_OPTIONS.map(option => (
                <Chip key={option} active={settings.width === option} onClick={() => onChange({ width: option })}>
                  {option === 0 ? t('gif.width_original') : option}
                </Chip>
              ))}
            </div>
            <NumberField
              value={settings.width}
              onChange={width => onChange({ width })}
              min={0}
              max={WIDTH_MAX}
              step={10}
              suffix="px"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('gif.colors')}>
              <select
                value={settings.colors}
                onChange={event => onChange({ colors: Number(event.target.value) })}
                className={FIELD_CLASS}
              >
                {COLOR_OPTIONS.map(option => (
                  <option key={option} value={option}>
                    {t('gif.colors_value', { n: option })}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('gif.speed')}>
              <select
                value={settings.speed}
                onChange={event => onChange({ speed: Number(event.target.value) })}
                className={FIELD_CLASS}
              >
                {SPEED_OPTIONS.map(option => (
                  <option key={option} value={option}>
                    {option}×
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={t('gif.dither')}>
            <select
              value={settings.dither}
              onChange={event => onChange({ dither: event.target.value as GifDither })}
              className={FIELD_CLASS}
            >
              {DITHER_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {t(`gif.dither.${option}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="space-y-3 border-t border-gray-100 pt-4">
          <span className={SECTION}>{t('gif.output')}</span>

          <Field label={t('gif.loop')}>
            <select
              value={settings.loop}
              onChange={event => onChange({ loop: Number(event.target.value) })}
              className={FIELD_CLASS}
            >
              {LOOP_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {loopLabel(option)}
                </option>
              ))}
            </select>
          </Field>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-gray-600">{t('gif.mode')}</span>
            <Segmented
              value={settings.mode}
              options={[
                { value: 'palette', label: t('gif.mode.palette') },
                { value: 'simple', label: t('gif.mode.simple') },
              ]}
              onChange={mode => onChange({ mode })}
            />
            <p className="text-[11px] leading-relaxed text-gray-400">{t(`gif.mode.${settings.mode}.desc`)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-gray-100 pt-4">
        {ready && plan.duration > 0 ? (
          <div className="space-y-1 rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-700">
            <p className="font-medium">{t('gif.summary', { frames: plan.frames, size: formatBytes(plan.estimatedBytes) })}</p>
            <p className="text-primary-600/80">
              {plan.width > 0 && plan.height > 0
                ? t('gif.summary_detail', {
                    w: plan.width,
                    h: plan.height,
                    fps: plan.fps,
                    sec: playbackDuration.toFixed(1),
                  })
                : t('gif.waiting_source')}
            </p>
            {plan.heavy && <p className="text-amber-600">{t('gif.warn.heavy')}</p>}
          </div>
        ) : (
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-400">{t('gif.waiting_source')}</div>
        )}

        {running ? (
          <div className="space-y-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full bg-primary-500 ${
                  phase === 'loading' ? 'animate-pulse' : 'transition-[width] duration-150'
                }`}
                style={{ width: phase === 'loading' ? '100%' : `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">{progressLabel}</p>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <X size={16} />
              {t('gif.cancel')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onRun}
            disabled={!ready || plan.duration <= 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Wand2 size={16} />
            {t('gif.run')}
          </button>
        )}

        {errorText && <p className="text-xs text-red-500">{errorText}</p>}
        {noticeText && <p className="text-xs text-gray-500">{noticeText}</p>}
        <p className="text-[11px] leading-relaxed text-gray-400">{t('gif.engine_hint')}</p>
      </div>
    </div>
  );
};

export default GifSettingsPanel;
