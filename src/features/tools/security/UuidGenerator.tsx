/// <reference lib="dom" />
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, RefreshCw, Check, Plus, Minus, ArrowRightLeft, Layers, Shuffle, Hash, AlertTriangle } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useClipboard } from '@/hooks/useClipboard';
import CryptoJS from 'crypto-js';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  NANOID_PRESETS,
  formatUlidTime,
  generateCuid,
  generateCuid2,
  generateNanoId,
  generateUlid,
  type NanoidPreset,
} from '@/lib/id/generators';

type IdType = 'uuid' | 'ulid' | 'nanoid' | 'cuid';
type UuidMode = 'v4' | 'v5';
type CuidVersion = 'v1' | 'v2';

const DEFAULT_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const NANO_PRESET_LIST: NanoidPreset[] = ['url', 'alphanumeric', 'lowercase', 'numbers'];

const generateUUIDv4 = (): string => {
  if (typeof window !== 'undefined' && typeof window.crypto?.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const UuidGenerator: React.FC = () => {
  const { t } = useLanguage();

  const [idType, setIdType] = useLocalStorage<IdType>('tool-id-type', 'uuid');
  const [mode, setMode] = useLocalStorage<UuidMode>('tool-uuid-mode', 'v4');
  const [count, setCount] = useLocalStorage<number>('tool-uuid-v4-count', 5);

  // UUID v5
  const [contentInput, setContentInput] = useLocalStorage<string>('tool-uuid-v5-input', '');
  const [contentUuid, setContentUuid] = useState('');
  const [namespaceError, setNamespaceError] = useState(false);
  const [namespace, setNamespace] = useLocalStorage<string>('tool-uuid-v5-ns', '');

  // NanoID
  const [nanoSize, setNanoSize] = useLocalStorage<number>('tool-nanoid-size', 21);
  const [nanoPreset, setNanoPreset] = useLocalStorage<NanoidPreset | 'custom'>('tool-nanoid-preset', 'url');
  const [nanoCustom, setNanoCustom] = useLocalStorage<string>('tool-nanoid-custom', 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');

  // CUID
  const [cuidVersion, setCuidVersion] = useLocalStorage<CuidVersion>('tool-cuid-version', 'v2');
  const [cuidLength, setCuidLength] = useLocalStorage<number>('tool-cuid-length', 24);

  // Defensive: localStorage may hold values from an older version (or be edited
  // by hand), so never trust the stored numbers directly.
  const safeCount = Math.min(50, Math.max(1, Math.floor(Number(count)) || 5));
  const safeNanoSize = Math.min(64, Math.max(8, Math.floor(Number(nanoSize)) || 21));
  const safeCuidLength = Math.min(32, Math.max(8, Math.floor(Number(cuidLength)) || 24));
  const safePreset: NanoidPreset | 'custom' =
    nanoPreset === 'custom' || NANO_PRESET_LIST.includes(nanoPreset as NanoidPreset) ? nanoPreset : 'url';

  const [uuids, setUuids] = useState<string[]>([]);
  const [ulids, setUlids] = useState<string[]>([]);
  const [nanoids, setNanoids] = useState<string[]>([]);
  const [cuids, setCuids] = useState<string[]>([]);

  const { copy, isCopied } = useClipboard(1500);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const alphabet = useMemo(
    () => (safePreset === 'custom' ? nanoCustom : NANOID_PRESETS[safePreset]),
    [safePreset, nanoCustom]
  );

  const uniqueAlphabetSize = useMemo(() => new Set(Array.from(alphabet)).size, [alphabet]);

  /* ------------------------------- UUID v5 -------------------------------- */

  const generateUUIDv5 = (name: string, ns: string): string | null => {
    const effectiveNs = ns.trim() || DEFAULT_NAMESPACE;
    try {
      const nsHex = effectiveNs.replace(/-/g, '');
      if (!/^[0-9a-fA-F]{32}$/.test(nsHex)) return null;
      const nsWords = CryptoJS.enc.Hex.parse(nsHex);
      const nameWords = CryptoJS.enc.Utf8.parse(name);
      const combined = nsWords.concat(nameWords);
      const hash = CryptoJS.SHA1(combined);
      const raw = hash.toString(CryptoJS.enc.Hex).substring(0, 32);

      const p1 = raw.substring(0, 8);
      const p2 = raw.substring(8, 12);
      const p3Arr = raw.substring(12, 16).split('');
      p3Arr[0] = '5';
      const p4Arr = raw.substring(16, 20).split('');
      p4Arr[0] = ((parseInt(p4Arr[0], 16) & 0x3) | 0x8).toString(16);
      const p5 = raw.substring(20, 32);

      return `${p1}-${p2}-${p3Arr.join('')}-${p4Arr.join('')}-${p5}`;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  useEffect(() => {
    if (!contentInput) {
      setContentUuid('');
      setNamespaceError(false);
      return;
    }
    const result = generateUUIDv5(contentInput, namespace);
    if (result === null) {
      setContentUuid('');
      setNamespaceError(true);
    } else {
      setContentUuid(result);
      setNamespaceError(false);
    }
  }, [contentInput, namespace]);

  /* --------------------------- batch generation --------------------------- */

  const buildBatch = useCallback((): string[] => {
    if (idType === 'ulid') return Array.from({ length: safeCount }, () => generateUlid());
    if (idType === 'nanoid') return Array.from({ length: safeCount }, () => generateNanoId(safeNanoSize, alphabet));
    if (idType === 'cuid')
      return Array.from({ length: safeCount }, () =>
        cuidVersion === 'v1' ? generateCuid() : generateCuid2(safeCuidLength)
      );
    return Array.from({ length: safeCount }, () => generateUUIDv4());
  }, [idType, safeCount, safeNanoSize, alphabet, cuidVersion, safeCuidLength]);

  useEffect(() => {
    if (idType === 'uuid' && mode === 'v5') return;
    try {
      const items = buildBatch();
      setError(null);
      if (idType === 'uuid') setUuids(items);
      else if (idType === 'ulid') setUlids(items);
      else if (idType === 'nanoid') setNanoids(items);
      else setCuids(items);
    } catch {
      setError(t('id.error_alphabet'));
      if (idType === 'nanoid') setNanoids([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildBatch, idType, mode, nonce]);

  /* -------------------------------- handlers ------------------------------- */

  const copyOne = async (value: string, index: number) => {
    if (!(await copy(value, index))) setError(t('id.error_copy'));
  };

  const copyAll = async (items: string[]) => {
    if (!(await copy(items.join('\n'), 'all'))) setError(t('id.error_copy'));
  };

  const copyV5 = async () => {
    if (contentUuid && !(await copy(contentUuid, 'v5'))) setError(t('id.error_copy'));
  };

  const adjustCount = (delta: number) => setCount(Math.max(1, Math.min(50, safeCount + delta)));

  /* -------------------------------- renderers ------------------------------ */

  const actionBar = (items: string[]) => (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <span className="text-gray-700 font-medium">{t('id.count')}:</span>
        <div className="flex items-center rounded-lg border border-gray-300 bg-white">
          <button
            onClick={() => adjustCount(-1)}
            className="p-2 hover:bg-gray-100 text-gray-600 rounded-l-lg border-r border-gray-300"
          >
            <Minus size={16} />
          </button>
          <div className="w-12 text-center font-mono text-gray-900">{safeCount}</div>
          <button
            onClick={() => adjustCount(1)}
            className="p-2 hover:bg-gray-100 text-gray-600 rounded-r-lg border-l border-gray-300"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="flex gap-3 w-full sm:w-auto">
        <button
          onClick={() => setNonce((n) => n + 1)}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <RefreshCw size={18} />
          {t('id.regenerate')}
        </button>
        <button
          onClick={() => copyAll(items)}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {isCopied('all') ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
          {t('id.copy_all')}
        </button>
      </div>
    </div>
  );

  const list = (items: string[], meta?: (item: string) => string) => (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={`${item}-${index}`}
          className="group flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-sm transition-all"
        >
          <span className="font-mono text-gray-600 text-sm select-none w-6 text-right opacity-50">{index + 1}.</span>
          <div className="font-mono text-gray-800 flex-1 break-all">{item}</div>
          {meta && <span className="hidden sm:block text-xs text-gray-400 font-mono shrink-0">{meta(item)}</span>}
          <button
            onClick={() => copyOne(item, index)}
            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100"
            title={t('common.copy')}
          >
            {isCopied(index) ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
          </button>
        </div>
      ))}
    </div>
  );

  const infoCard = (title: string, desc: string, icon: React.ReactNode, tone = 'blue') => {
    const toneClass =
      tone === 'orange'
        ? 'bg-orange-50 text-orange-800'
        : tone === 'purple'
          ? 'bg-purple-50 text-purple-800'
          : 'bg-primary-50 text-primary-800';
    return (
      <div className={`${toneClass} p-4 rounded-lg flex items-start gap-3 text-sm`}>
        <div className="shrink-0 mt-0.5">{icon}</div>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="opacity-90 mt-1 whitespace-pre-line">{desc}</p>
        </div>
      </div>
    );
  };

  /* ---------------------------------- tabs -------------------------------- */

  const tabs: { id: IdType; label: string }[] = [
    { id: 'uuid', label: t('id.type.uuid') },
    { id: 'ulid', label: t('id.type.ulid') },
    { id: 'nanoid', label: t('id.type.nanoid') },
    { id: 'cuid', label: t('id.type.cuid') },
  ];

  const nanoBits = Math.round(safeNanoSize * Math.log2(Math.max(2, uniqueAlphabetSize)));

  return (
    <div className="w-full space-y-6">
      {/* Type selector */}
      <div className="flex flex-wrap p-1 bg-gray-100 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setIdType(tab.id)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              idType === tab.id ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl">{error}</div>
      )}

      {/* ------------------------------- UUID ------------------------------- */}
      {idType === 'uuid' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex p-1 bg-gray-100 rounded-lg w-fit">
            <button
              onClick={() => setMode('v4')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                mode === 'v4' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('uuid.v4')}
            </button>
            <button
              onClick={() => setMode('v5')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                mode === 'v5' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('uuid.v5')}
            </button>
          </div>

          {mode === 'v4' ? (
            <>
              {actionBar(uuids)}
              {list(uuids)}
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('uuid.input_ph')}</label>
                  <input
                    type="text"
                    value={contentInput}
                    onChange={(e) => setContentInput((e.target as HTMLInputElement).value)}
                    placeholder="..."
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-100 focus:border-primary-500 transition-all text-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('uuid.ns_ph')}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={namespace}
                      onChange={(e) => setNamespace((e.target as HTMLInputElement).value)}
                      placeholder={`Default: ${DEFAULT_NAMESPACE}`}
                      className="flex-1 p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-100 focus:border-primary-500 transition-all font-mono text-gray-600"
                    />
                    <button
                      onClick={() => setNamespace('')}
                      className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                    >
                      {t('common.reset')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-gray-100">
                <label className="block text-sm font-medium text-gray-700">{t('uuid.generated')}</label>
                <div className="relative">
                  <div
                    className={`w-full p-4 pr-14 border rounded-xl font-mono break-all min-h-[56px] flex items-center justify-center text-lg ${
                      namespaceError
                        ? 'bg-red-50 border-red-200 text-red-600 text-base font-normal'
                        : 'bg-gray-50 border-gray-200 text-primary-700 font-semibold'
                    }`}
                  >
                    {namespaceError ? (
                      <span className="inline-flex items-center gap-2">
                        <AlertTriangle size={16} />
                        {t('id.error_namespace')}
                      </span>
                    ) : (
                      contentUuid || (
                        <span className="text-gray-400 font-normal text-base italic">{t('common.waiting')}</span>
                      )
                    )}
                  </div>
                  {contentUuid && (
                    <button
                      onClick={copyV5}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white text-gray-500 border border-gray-200 rounded-lg shadow-sm hover:text-primary-600 hover:border-primary-200 transition-colors"
                    >
                      {isCopied('v5') ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                    </button>
                  )}
                </div>
              </div>

              {infoCard(t('uuid.about'), t('uuid.desc'), <ArrowRightLeft size={20} />, 'orange')}
            </>
          )}
        </div>
      )}

      {/* ------------------------------- ULID ------------------------------- */}
      {idType === 'ulid' && (
        <div className="space-y-6 animate-fade-in">
          {actionBar(ulids)}
          {list(ulids, formatUlidTime)}
          {infoCard(t('ulid.about'), t('ulid.desc'), <Layers size={20} />)}
        </div>
      )}

      {/* ------------------------------ NanoID ------------------------------ */}
      {idType === 'nanoid' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-700">{t('nano.preset')}</span>
              <div className="flex flex-wrap gap-2">
                {NANO_PRESET_LIST.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setNanoPreset(preset)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                      safePreset === preset
                        ? 'bg-primary-50 border-primary-200 text-primary-700 font-medium'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {t(`nano.preset.${preset}`)}
                  </button>
                ))}
                <button
                  onClick={() => setNanoPreset('custom')}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                    safePreset === 'custom'
                      ? 'bg-primary-50 border-primary-200 text-primary-700 font-medium'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {t('nano.preset.custom')}
                </button>
              </div>
            </div>

            {safePreset === 'custom' && (
              <div className="space-y-1">
                <input
                  type="text"
                  value={nanoCustom}
                  onChange={(e) => setNanoCustom((e.target as HTMLInputElement).value)}
                  placeholder={t('nano.custom_ph')}
                  className="w-full p-2.5 text-sm font-mono border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-100 focus:border-primary-500 transition-all text-gray-700"
                />
                <p className={`text-xs ${uniqueAlphabetSize < 2 ? 'text-red-500' : 'text-gray-400'}`}>
                  {t('nano.chars', { n: uniqueAlphabetSize })}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium text-gray-700 w-16">{t('nano.size')}</span>
              <input
                type="range"
                min="8"
                max="64"
                value={safeNanoSize}
                onChange={(e) => setNanoSize(parseInt(e.target.value))}
                className="flex-1 min-w-[140px] h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
              <span className="text-sm font-mono text-gray-600 w-8">{safeNanoSize}</span>
              <div className="flex gap-2">
                {[8, 12, 21, 32].map((size) => (
                  <button
                    key={size}
                    onClick={() => setNanoSize(size)}
                    className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded hover:bg-gray-200 transition-colors"
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-400">
              {t('nano.entropy', { n: nanoBits })} · {t('nano.size_hint')}
            </p>
          </div>

          {actionBar(nanoids)}
          {list(nanoids)}
          {infoCard(t('nano.about'), t('nano.desc'), <Shuffle size={20} />)}
        </div>
      )}

      {/* -------------------------------- CUID ------------------------------ */}
      {idType === 'cuid' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">{t('cuid.version')}</span>
                <div className="flex p-1 bg-gray-100 rounded-lg">
                  {(['v1', 'v2'] as CuidVersion[]).map((version) => (
                    <button
                      key={version}
                      onClick={() => setCuidVersion(version)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        cuidVersion === version
                          ? 'bg-white text-primary-600 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {version === 'v1' ? t('cuid.v1') : t('cuid.v2')}
                    </button>
                  ))}
                </div>
              </div>

              {cuidVersion === 'v2' && (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">{t('cuid.length')}</span>
                  <input
                    type="range"
                    min="8"
                    max="32"
                    value={safeCuidLength}
                    onChange={(e) => setCuidLength(parseInt(e.target.value))}
                    className="w-36 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <span className="text-sm font-mono text-gray-600 w-8">{safeCuidLength}</span>
                  <div className="flex gap-2">
                    {[16, 24, 32].map((size) => (
                      <button
                        key={size}
                        onClick={() => setCuidLength(size)}
                        className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded hover:bg-gray-200 transition-colors"
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-400">
              {cuidVersion === 'v1' ? t('cuid.v1_hint') : t('cuid.v2_hint')}
            </p>
          </div>

          {actionBar(cuids)}
          {list(cuids)}
          {infoCard(t('cuid.about'), cuidVersion === 'v1' ? t('cuid.desc_v1') : t('cuid.desc_v2'), <Hash size={20} />, 'purple')}
        </div>
      )}
    </div>
  );
};

export default UuidGenerator;
