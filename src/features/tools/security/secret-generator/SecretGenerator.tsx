import React from 'react';
import { KeySquare, Lock, Minus, Plus, ShieldCheck } from 'lucide-react';
import { Segmented } from '@/components/ui/FormField';
import { useLanguage } from '@/contexts/LanguageContext';
import { SECRET_COUNT, type SecretMode } from '@/lib/secret';
import KeyOptionsPanel from './components/KeyOptionsPanel';
import PasswordOptionsPanel from './components/PasswordOptionsPanel';
import PresetChips from './components/PresetChips';
import SecretOutputPanel from './components/SecretOutputPanel';
import { KEY_PRESETS, PASSWORD_PRESETS, resolvePasswordPresetId } from './constants';
import { useSecretGenerator } from './hooks/useSecretGenerator';

const SECTION_LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-gray-400';

const STEPPER_BUTTON =
  'inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition-colors hover:border-primary-300 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-500';

/**
 * 密码 / 随机密钥生成器。
 *
 * 顶部切换模式，下面「参数 → 结果」两栏：参数变化即自动重新生成，
 * 「重新生成」按钮只承担「换一批」的语义。
 * 算法在 `@/lib/secret`，本组件只负责状态编排与界面。
 */
const SecretGenerator: React.FC = () => {
  const { t } = useLanguage();
  const generator = useSecretGenerator();
  const { mode, passwordOptions, keyOptions, result } = generator;

  const passwordPresetId = resolvePasswordPresetId(passwordOptions);
  const keyPresetId = KEY_PRESETS.find((preset) => preset.bytes === keyOptions.bytes)?.id ?? 'custom';

  const count = mode === 'password' ? passwordOptions.count : keyOptions.count;
  const setCount = (next: number) => {
    const clamped = Math.min(Math.max(next, SECRET_COUNT.min), SECRET_COUNT.max);
    if (mode === 'password') generator.updatePasswordOptions({ count: clamped });
    else generator.updateKeyOptions({ count: clamped });
  };

  const modeOptions = [
    { value: 'password' as SecretMode, label: t('secret.mode.password'), icon: <Lock size={13} /> },
    { value: 'key' as SecretMode, label: t('secret.mode.key'), icon: <KeySquare size={13} /> },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <Segmented value={mode} options={modeOptions} onChange={generator.setMode} />
        </div>
        <span className="inline-flex w-fit items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
          <ShieldCheck size={12} />
          {t('secret.badge')}
        </span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,11fr)_minmax(0,13fr)] xl:items-start">
        <div className="order-2 space-y-5 rounded-xl border border-gray-200 bg-white p-5 xl:order-1">
          <h3 className="text-sm font-semibold text-gray-900">{t('secret.settings')}</h3>

          <div className="space-y-2">
            <span className={SECTION_LABEL}>{t('secret.presets')}</span>
            {mode === 'password' ? (
              <PresetChips
                options={PASSWORD_PRESETS.map((preset) => ({ id: preset.id, label: t(preset.nameKey) }))}
                activeId={passwordPresetId}
                onSelect={(id) => {
                  const preset = PASSWORD_PRESETS.find((item) => item.id === id);
                  if (preset) generator.applyPasswordPreset(preset);
                }}
              />
            ) : (
              <PresetChips
                options={KEY_PRESETS.map((preset) => ({ id: preset.id, label: t(preset.nameKey) }))}
                activeId={keyPresetId}
                onSelect={(id) => {
                  const preset = KEY_PRESETS.find((item) => item.id === id);
                  if (preset) generator.applyKeyPreset(preset);
                }}
              />
            )}
          </div>

          {mode === 'password' ? (
            <PasswordOptionsPanel
              options={passwordOptions}
              onChange={generator.updatePasswordOptions}
              onToggleClass={generator.toggleCharacterClass}
            />
          ) : (
            <KeyOptionsPanel options={keyOptions} onChange={generator.updateKeyOptions} />
          )}

          <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
            <div className="min-w-0">
              <span className="block text-xs font-medium text-gray-700">{t('secret.count')}</span>
              <span className="block text-[11px] text-gray-400">{t('secret.count_hint')}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCount(count - 1)}
                disabled={count <= SECRET_COUNT.min}
                aria-label={t('secret.count_minus')}
                className={STEPPER_BUTTON}
              >
                <Minus size={13} />
              </button>
              <span className="w-7 text-center font-mono text-sm tabular-nums text-gray-800">{count}</span>
              <button
                type="button"
                onClick={() => setCount(count + 1)}
                disabled={count >= SECRET_COUNT.max}
                aria-label={t('secret.count_plus')}
                className={STEPPER_BUTTON}
              >
                <Plus size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* 窄屏下结果排在上方，避免调完参数还要往回滚 */}
        <div className="order-1 xl:order-2 xl:sticky xl:top-4">
          <SecretOutputPanel mode={mode} result={result} onRegenerate={generator.regenerate} />
        </div>
      </div>
    </div>
  );
};

export default SecretGenerator;
