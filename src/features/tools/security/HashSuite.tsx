/// <reference lib="dom" />
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  FileSearch,
  FileText,
  Fingerprint,
  KeyRound,
  Loader2,
  ShieldCheck,
  Target,
  X,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useClipboard } from '@/hooks/useClipboard';
import {
  ALGO_BITS,
  HASH_ALGOS,
  digestLength,
  formatBytes,
  formatDigest,
  hashFileBatch,
  hashTextBatch,
  type HashAlgo,
  type OutputFormat,
} from '@/lib/crypto/hash';

type InputMode = 'text' | 'file';

const DEFAULT_ALGOS: HashAlgo[] = ['MD5', 'SHA-1', 'SHA-256', 'SHA-512'];

/** Pick up the draft of the retired standalone MD5 tool, if any. */
const readLegacyMd5Text = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage.getItem('tool-md5-text');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return typeof parsed === 'string' ? parsed : '';
  } catch {
    return '';
  }
};

const HashSuite: React.FC = () => {
  const { t } = useLanguage();

  const [mode, setMode] = useLocalStorage<InputMode>('tool-hash-mode', 'text');
  const legacyText = useMemo(() => readLegacyMd5Text(), []);
  const [text, setText] = useLocalStorage<string>('tool-hash-text', legacyText);
  const [algos, setAlgos] = useLocalStorage<HashAlgo[]>('tool-hash-algos', DEFAULT_ALGOS);
  const [format, setFormat] = useLocalStorage<OutputFormat>('tool-hash-format', 'hex');
  const [hmacEnabled, setHmacEnabled] = useLocalStorage<boolean>('tool-hash-hmac', false);
  const [hmacKey, setHmacKey] = useLocalStorage<string>('tool-hash-key', '');
  const [showKey, setShowKey] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<Partial<Record<HashAlgo, string>>>({});
  const [computing, setComputing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const { copy: copyText, isCopied } = useClipboard(1500);
  const [computedFor, setComputedFor] = useState<string | null>(null);
  const [expected, setExpected] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => HASH_ALGOS.filter((algo) => algos.includes(algo)), [algos]);
  const key = hmacEnabled ? hmacKey : '';
  const hmacReady = !hmacEnabled || hmacKey.length > 0;
  const algoKey = selected.join(',');

  // Switching between text and file must not leave digests of the other input on screen.
  useEffect(() => {
    setResults({});
    setComputedFor(null);
    setProgress(0);
    setComputing(false);
    setError(null);
  }, [mode]);

  /* ------------------------------ text mode ------------------------------- */

  useEffect(() => {
    if (mode !== 'text') return;
    if (!text || !hmacReady) {
      setResults({});
      setComputedFor(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const next = await hashTextBatch(text, selected, key);
        if (!cancelled) {
          setResults(next);
          setComputedFor(text);
          setError(null);
        }
      } catch {
        if (!cancelled) setError(t('hash.error'));
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, text, algoKey, key, hmacReady]);

  /* ------------------------------ file mode ------------------------------- */

  useEffect(() => {
    if (mode !== 'file' || !file) return;
    if (!hmacReady) {
      setResults({});
      setComputing(false);
      return;
    }

    let cancelled = false;
    setComputing(true);
    setProgress(0);
    setError(null);

    // Small debounce so editing the HMAC key does not re-hash a large file on
    // every keystroke.
    const timer = setTimeout(() => {
      (async () => {
        try {
          const next = await hashFileBatch(file, selected, key, (percent) => {
            if (!cancelled) setProgress(percent);
          });
          if (!cancelled) {
            setResults(next);
            setProgress(100);
          }
        } catch {
          if (!cancelled) {
            setError(t('hash.error'));
            setResults({});
          }
        } finally {
          if (!cancelled) setComputing(false);
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, file, algoKey, key, hmacReady]);

  /* ------------------------------- handlers ------------------------------- */

  const toggleAlgo = (algo: HashAlgo) => {
    if (algos.includes(algo)) {
      if (algos.length === 1) return;
      setAlgos(algos.filter((item) => item !== algo));
    } else {
      setAlgos(HASH_ALGOS.filter((item) => item === algo || algos.includes(item)));
    }
  };

  const copy = async (value: string, id: string) => {
    if (!(await copyText(value, id))) setError(t('id.error_copy'));
  };

  const copyAll = () => {
    const lines = selected
      .filter((algo) => results[algo])
      .map((algo) => `${hmacEnabled ? `HMAC-${algo}` : algo}: ${formatDigest(results[algo] as string, format)}`);
    if (lines.length) void copy(lines.join('\n'), 'all');
  };

  const acceptFile = (next: File | null) => {
    setFile(next);
    setResults({});
    setProgress(0);
    if (!next) setError(null);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) acceptFile(dropped);
  };

  const hasResults = selected.some((algo) => results[algo]);
  // True while the shown digests belong to older text (debounce in flight).
  const resultsAreStale = mode === 'text' && hasResults && computedFor !== text;

  const expectedTrimmed = expected.trim();
  const matchFor = (algo: HashAlgo): boolean => {
    const hex = results[algo];
    if (!hex || !expectedTrimmed) return false;
    const needle = expectedTrimmed.toLowerCase();
    return hex.toLowerCase() === needle || formatDigest(hex, 'base64') === expectedTrimmed;
  };
  const matchedAlgo = selected.find((algo) => matchFor(algo));
  const showNoMatch = !!expectedTrimmed && hasResults && !matchedAlgo;

  return (
    <div className="w-full space-y-4 animate-fade-in">
      {/* Configuration */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setMode('text')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                mode === 'text' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('hash.text')}
            </button>
            <button
              onClick={() => setMode('file')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                mode === 'file' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('hash.file')}
            </button>
          </div>

          <button
            onClick={() => setHmacEnabled(!hmacEnabled)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-all ${
              hmacEnabled
                ? 'bg-primary-50 border-primary-200 text-primary-700 font-medium'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            <KeyRound size={13} />
            HMAC
          </button>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">{t('hash.format')}</span>
            <div className="flex p-1 bg-gray-100 rounded-lg">
              {(['hex', 'HEX', 'base64'] as OutputFormat[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setFormat(item)}
                  className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all ${
                    format === item ? 'bg-white text-primary-600 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {item === 'base64' ? 'Base64' : item}
                </button>
              ))}
            </div>
          </div>
        </div>

        {hmacEnabled && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 shrink-0">{t('hash.key')}</span>
            <div className="relative flex-1">
              <input
                value={hmacKey}
                onChange={(event) => setHmacKey(event.target.value)}
                placeholder={t('hash.key_ph')}
                spellCheck={false}
                type={showKey ? 'text' : 'password'}
                className="w-full pl-3 pr-9 py-2 font-mono text-xs border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300 transition-all"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
          <span className="text-xs font-medium text-gray-500">{t('hash.algorithms')}</span>
          {HASH_ALGOS.map((algo) => {
            const active = algos.includes(algo);
            return (
              <button
                key={algo}
                onClick={() => toggleAlgo(algo)}
                className={`px-2.5 py-1 text-xs font-mono rounded-full border transition-all ${
                  active
                    ? 'bg-primary-50 border-primary-200 text-primary-700 font-medium'
                    : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                }`}
              >
                {algo}
              </button>
            );
          })}
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-green-600">
            <ShieldCheck size={12} />
            {t('hash.local')}
          </span>
        </div>
      </div>

      {/* Input */}
      {mode === 'text' ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">{t('hash.text_label')}</label>
            <span className="text-[11px] text-gray-400">{t('hash.char_count', { n: text.length })}</span>
          </div>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t('hash.text_ph')}
            spellCheck={false}
            className="w-full h-32 p-3 font-mono text-xs leading-5 border border-gray-200 rounded-xl text-gray-800 resize-y placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300 transition-all"
          />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(event) => {
              const next = event.target.files?.[0];
              if (next) acceptFile(next);
              event.target.value = '';
            }}
          />

          {!file ? (
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`h-56 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer group ${
                dragging ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
              }`}
            >
              <div className="w-14 h-14 bg-gray-100 group-hover:bg-primary-100 rounded-full flex items-center justify-center mb-3 text-gray-400 group-hover:text-primary-600 transition-colors">
                <FileSearch size={26} />
              </div>
              <p className="text-base font-semibold text-gray-800">{t('hash.file_ph')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('hash.file_desc')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-primary-50 text-primary-600 rounded-lg shrink-0">
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-gray-900 text-sm truncate">{file.name}</h3>
                    <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                  </div>
                </div>
                <button
                  onClick={() => acceptFile(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                  title={t('common.clear')}
                >
                  <X size={18} />
                </button>
              </div>

              {computing ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-gray-600">
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" />
                      {t('hash.computing')}
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 transition-all duration-200 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-green-600 text-xs font-medium bg-green-50 px-2.5 py-1 rounded-lg">
                  <Check size={13} />
                  {t('hash.done')}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl">{error}</div>
      )}

      {/* Results */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Fingerprint size={14} className="text-gray-400" />
            {t('hash.result')}
            {resultsAreStale && (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                <Loader2 size={11} className="animate-spin" />
                {t('hash.computing')}
              </span>
            )}
            {hmacEnabled && (
              <span className="px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 border border-primary-100 font-medium">
                HMAC
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Target size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                value={expected}
                onChange={(event) => setExpected(event.target.value)}
                placeholder={t('hash.verify_ph')}
                spellCheck={false}
                className={`w-44 sm:w-64 pl-7 pr-6 py-1.5 text-[11px] font-mono bg-white border rounded-lg text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 transition-all ${
                  showNoMatch
                    ? 'border-red-200 focus:ring-red-100 focus:border-red-300'
                    : 'border-gray-200 focus:ring-primary-100 focus:border-primary-300'
                }`}
              />
              {expected && (
                <button
                  onClick={() => setExpected('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-300 hover:text-gray-500 rounded transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {hasResults && (
              <button
                onClick={copyAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {isCopied('all') ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                {t('id.copy_all')}
              </button>
            )}
          </div>
        </div>

        {showNoMatch && (
          <div className="px-4 py-2 text-[11px] text-red-600 bg-red-50 border-b border-red-100">
            {t('hash.verify_no_match')}
          </div>
        )}

        {!hasResults ? (
          <div className="py-14 text-center text-sm text-gray-400">
            {!hmacReady
              ? t('hash.hmac_key_required')
              : mode === 'text'
                ? text
                  ? t('hash.computing')
                  : t('hash.empty')
                : file
                  ? computing
                    ? t('hash.computing')
                    : t('hash.empty')
                  : t('hash.empty_file')}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {selected.map((algo) => {
              const hex = results[algo];
              if (!hex) return null;
              const value = formatDigest(hex, format);
              const label = hmacEnabled ? `HMAC-${algo}` : algo;
              const matched = matchFor(algo);
              return (
                <div
                  key={algo}
                  className={`group flex items-start gap-3 px-4 py-3 ${matched ? 'bg-green-50/70' : ''}`}
                >
                  <span className="shrink-0 mt-0.5 px-2 py-0.5 text-[11px] font-mono font-medium rounded-md bg-gray-100 text-gray-600">
                    {label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs leading-5 text-gray-800 break-all select-all">{value}</p>
                    <p className="mt-0.5 text-[10px] text-gray-400 flex items-center gap-2">
                      <span>
                        {ALGO_BITS[algo]} bit · {t('hash.chars', { n: digestLength(ALGO_BITS[algo], format) })}
                      </span>
                      {matched && (
                        <span className="inline-flex items-center gap-0.5 text-green-600 font-medium">
                          <Check size={10} />
                          {t('hash.verify_match')}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => copy(value, algo)}
                    title={t('common.copy')}
                    className="shrink-0 mt-0.5 p-1.5 text-gray-300 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100"
                  >
                    {isCopied(algo) ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Security note */}
      <div className="bg-amber-50 text-amber-800 p-4 rounded-lg text-xs leading-5">
        <p className="font-semibold text-sm">{t('hash.note_title')}</p>
        <p className="opacity-90 mt-1">{t('hash.note')}</p>
      </div>
    </div>
  );
};

export default HashSuite;
