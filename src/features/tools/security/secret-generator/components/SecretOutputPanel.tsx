import React from 'react';
import { AlertTriangle, Download, RefreshCw } from 'lucide-react';
import CopyButton from '@/components/ui/CopyButton';
import { useLanguage } from '@/contexts/LanguageContext';
import { downloadBlob } from '@/lib/download';
import type { GenerationResult, SecretMode } from '@/lib/secret';
import SecretValue from './SecretValue';
import StrengthMeter from './StrengthMeter';

interface SecretOutputPanelProps {
  mode: SecretMode;
  result: GenerationResult;
  onRegenerate: () => void;
}

const ICON_BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 transition-all hover:border-primary-200 hover:bg-primary-50 hover:text-primary-600';

/** 单条结果用大字号展示，批量结果改为紧凑列表 */
const SecretOutputPanel: React.FC<SecretOutputPanelProps> = ({ mode, result, onRegenerate }) => {
  const { t } = useLanguage();
  const { secrets, error, bits, charsetSize, length } = result;

  const payload = secrets.join('\n');
  const single = secrets.length === 1;
  const colorize = mode === 'password';

  const errorText = error ? t(`secret.error.${error.code}`, error.params) : null;

  const handleDownload = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const name = mode === 'password' ? `passwords-${stamp}.txt` : `keys-${stamp}.txt`;
    downloadBlob(new Blob([payload], { type: 'text/plain;charset=utf-8' }), name);
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">{t('secret.output.title')}</h3>
          {!error && (
            <p className="mt-0.5 text-[11px] text-gray-400">
              {t('secret.output.meta', { count: secrets.length, length })}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {!errorText && (
            <>
              <CopyButton
                text={payload}
                label={t('secret.output.copy_all')}
                copiedLabel={t('common.copied')}
                className={ICON_BUTTON}
              />
              <button type="button" onClick={handleDownload} className={ICON_BUTTON} title={t('secret.output.download')}>
                <Download size={13} />
                <span className="hidden sm:inline">{t('secret.output.download')}</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onRegenerate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-primary-700 active:scale-[0.98]"
          >
            <RefreshCw size={13} />
            {t('secret.generate')}
          </button>
        </div>
      </div>

      {errorText && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-xs leading-relaxed text-red-600"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{errorText}</span>
        </div>
      )}

      {!errorText && <StrengthMeter bits={bits} charsetSize={charsetSize} />}

      {!errorText &&
        (single ? (
          <div className="relative rounded-xl border border-gray-200 bg-gray-50 p-4 pr-12">
            <div className="select-all break-all font-mono text-lg leading-relaxed text-gray-800 sm:text-xl">
              <SecretValue value={secrets[0]} colorize={colorize} />
            </div>
            <div className="absolute right-2 top-2">
              <CopyButton
                text={secrets[0]}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white hover:text-primary-600"
              />
            </div>
          </div>
        ) : (
          <ul className="max-h-[52vh] space-y-1.5 overflow-y-auto pr-1">
            {secrets.map((secret, index) => (
              <li
                key={`${index}-${secret}`}
                className="group flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-2 transition-colors hover:border-primary-200 hover:bg-primary-50/30"
              >
                <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-gray-300">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 select-all break-all font-mono text-[13px] leading-relaxed text-gray-800">
                  <SecretValue value={secret} colorize={colorize} />
                </span>
                <CopyButton
                  text={secret}
                  className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white hover:text-primary-600"
                />
              </li>
            ))}
          </ul>
        ))}

      {colorize && !errorText && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
          <span>
            <span className="font-mono text-primary-600">A</span> {t('secret.class.uppercase')}
          </span>
          <span>
            <span className="font-mono text-gray-800">a</span> {t('secret.class.lowercase')}
          </span>
          <span>
            <span className="font-mono text-emerald-600">0</span> {t('secret.class.digits')}
          </span>
          <span>
            <span className="font-mono text-orange-500">#</span> {t('secret.class.symbols')}
          </span>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-gray-400">{t('secret.note')}</p>
    </div>
  );
};

export default SecretOutputPanel;
