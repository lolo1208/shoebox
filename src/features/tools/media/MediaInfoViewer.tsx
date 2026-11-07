import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Captions,
  Check,
  Copy,
  Download,
  FileAudio,
  FileJson,
  FileTerminal,
  FileVideo,
  Info,
  Loader2,
  Music,
  Plus,
  RotateCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useClipboard } from '@/hooks/useClipboard';
import { downloadBlob } from '@/lib/download';
import {
  analyzeMedia,
  analyzeMediaText,
  deriveStats,
  extractFields,
  fieldsToText,
  fileKey,
  formatBitrate,
  formatBytes,
  formatClock,
  getChapters,
  getGeneralString,
  getTrackNumber,
  guessKind,
  isDefaultTrack,
  isForcedTrack,
  isMediaFile,
  MediaInfoError,
  normalizeLanguageCode,
  normalizeVersion,
  summarizeTrack,
  type MediaField,
  type MediaReport,
  type RawTrack,
  type ValueDict
} from '@/lib/media/mediaInfo';

type Tab = 'overview' | 'fields' | 'text' | 'json';

interface Item {
  id: string;
  file: File;
  url: string;
  kind: 'video' | 'audio' | 'other';
  status: 'queued' | 'parsing' | 'ready' | 'error';
  report?: MediaReport;
  text?: string;
  textStatus?: 'loading' | 'ready' | 'error';
  error?: string;
  errorCode?: 'empty' | 'engine' | 'other';
  previewFailed?: boolean;
}

const KINDS: RawTrack['kind'][] = ['General', 'Video', 'Audio', 'Text', 'Image', 'Menu', 'Other'];

const MediaInfoViewer: React.FC = () => {
  const { t, language } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const itemsRef = useRef<Item[]>([]);
  const textPromises = useRef<Map<string, Promise<string | null>>>(new Map());

  const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [trackId, setTrackId] = useState('General');
  const [query, setQuery] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const { copy: copyText, isCopied } = useClipboard(1800);
  const [skipped, setSkipped] = useState<string[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const track = (url: string) => {
    urlsRef.current.add(url);
    return url;
  };

  const dict = useMemo<ValueDict>(() => {
    let displayNames: Intl.DisplayNames | null = null;
    try {
      displayNames = new Intl.DisplayNames([language], { type: 'language', fallback: 'none' });
    } catch {
      displayNames = null;
    }
    const numberFormat = new Intl.NumberFormat(language);
    return {
      yes: t('mediainfo.value.yes'),
      no: t('mediainfo.value.no'),
      lossless: t('mediainfo.value.lossless'),
      lossy: t('mediainfo.value.lossy'),
      progressive: t('mediainfo.value.progressive'),
      interlaced: t('mediainfo.value.interlaced'),
      constant: t('mediainfo.value.constant'),
      variable: t('mediainfo.value.variable'),
      limited: t('mediainfo.value.limited'),
      full: t('mediainfo.value.full'),
      languageName: (code: string) => {
        const clean = normalizeLanguageCode(code);
        try {
          return displayNames?.of(clean) || code;
        } catch {
          return code;
        }
      },
      number: (value: number) => numberFormat.format(value)
    };
  }, [t, language]);

  const active = items.find(item => item.id === activeId) || null;
  const report = active?.report;

  /* ---------------------------- parsing queue --------------------------- */

  const updateItem = (id: string, patch: Partial<Item>) =>
    setItems(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));

  const parseItem = async (item: Item) => {
    updateItem(item.id, { status: 'parsing', error: undefined, errorCode: undefined });
    try {
      const parsed = await analyzeMedia(item.file);
      updateItem(item.id, { status: 'ready', report: parsed });
    } catch (error) {
      updateItem(item.id, {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        errorCode: error instanceof MediaInfoError ? error.code : 'other'
      });
    }
  };

  const enqueue = (task: () => Promise<void>) => {
    queueRef.current = queueRef.current.then(task, task);
  };

  const addFiles = (fileList: FileList | File[]) => {
    const known = new Set(itemsRef.current.map(item => fileKey(item.file)));
    const accepted: File[] = [];
    const rejected: string[] = [];

    Array.from(fileList).forEach(file => {
      const key = fileKey(file);
      if (!isMediaFile(file) || known.has(key)) {
        rejected.push(file.name);
        return;
      }
      known.add(key);
      accepted.push(file);
    });

    setSkipped(rejected);
    if (!accepted.length) return;

    const created: Item[] = accepted.map(file => ({
      id: `${fileKey(file)}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      url: track(URL.createObjectURL(file)),
      kind: guessKind(file),
      status: 'queued'
    }));

    setItems(prev => [...prev, ...created]);
    setActiveId(prev => prev ?? created[0].id);
    created.forEach(item => enqueue(() => parseItem(item)));
  };

  const removeItem = (id: string) => {
    const target = itemsRef.current.find(item => item.id === id);
    if (target && urlsRef.current.delete(target.url)) URL.revokeObjectURL(target.url);
    setItems(prev => prev.filter(item => item.id !== id));
    if (activeId === id) {
      const rest = itemsRef.current.filter(item => item.id !== id);
      setActiveId(rest.length ? rest[0].id : null);
    }
  };

  const clearAll = () => {
    itemsRef.current.forEach(item => {
      if (urlsRef.current.delete(item.url)) URL.revokeObjectURL(item.url);
    });
    setItems([]);
    setActiveId(null);
  };

  const exportAll = () => {
    const parsed = itemsRef.current.filter(item => item.report);
    if (!parsed.length) return;
    const payload = parsed.map(item => ({
      file: item.file.name,
      size: item.file.size,
      media: item.report!.raw
    }));
    download(JSON.stringify(payload, null, 2), 'mediainfo.json', 'application/json');
  };

  const loadText = (item: Item, force = false): Promise<string | null> => {
    const current = itemsRef.current.find(entry => entry.id === item.id) ?? item;
    if (current.text) return Promise.resolve(current.text);

    const pending = textPromises.current.get(item.id);
    if (pending && !force) return pending;

    updateItem(item.id, { textStatus: 'loading' });
    const task = analyzeMediaText(item.file)
      .then(text => {
        updateItem(item.id, { text, textStatus: 'ready' });
        return text;
      })
      .catch(() => {
        updateItem(item.id, { textStatus: 'error' });
        return null;
      })
      .finally(() => {
        textPromises.current.delete(item.id);
      });

    textPromises.current.set(item.id, task);
    return task;
  };

  useEffect(() => {
    if (!active || active.status !== 'ready') return;
    setTrackId('General');
    setQuery('');
  }, [activeId]);

  useEffect(() => {
    if (tab !== 'text' || !active || active.status !== 'ready') return;
    if (!active.text && active.textStatus === undefined) void loadText(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, active]);

  /* ------------------------------ helpers ------------------------------ */

  const copy = async (text: string, token: string) => {
    await copyText(text, token);
  };

  const download = (text: string, filename: string, mime = 'text/plain') => {
    downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
  };

  const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || name;

  const kindLabel = (kind: RawTrack['kind']) => t(`mediainfo.kind.${KINDS.includes(kind) ? kind.toLowerCase() : 'other'}`);

  const trackLabel = (item: RawTrack) => (item.kind === 'General' ? kindLabel('General') : `${kindLabel(item.kind)} ${item.index + 1}`);

  const canPreview = useMemo(() => {
    if (!active || active.kind === 'other' || active.previewFailed) return false;
    const element = document.createElement(active.kind === 'audio' ? 'audio' : 'video');
    if (!active.file.type) return false;
    return element.canPlayType(active.file.type) !== '';
  }, [active]);

  const selectedTrack = useMemo<RawTrack | null>(() => {
    if (!report) return null;
    if (trackId === 'General') return report.general;
    return report.tracks.find(item => item.id === trackId) ?? report.general;
  }, [report, trackId]);

  const trackFields = useMemo(() => (selectedTrack ? extractFields(selectedTrack, dict) : []), [selectedTrack, dict]);

  const fields = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return trackFields;
    return trackFields.filter(field => field.key.toLowerCase().includes(needle) || field.display.toLowerCase().includes(needle));
  }, [trackFields, query]);

  /** When searching, results from every stream are shown grouped by stream. */
  const globalMatches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || !report) return null;
    return [report.general, ...report.tracks]
      .map(track => ({
        track,
        fields: extractFields(track, dict).filter(
          field => field.key.toLowerCase().includes(needle) || field.display.toLowerCase().includes(needle)
        )
      }))
      .filter(group => group.fields.length > 0);
  }, [query, report, dict]);

  const jsonReport = useMemo(() => (report ? JSON.stringify(report.raw, null, 2) : ''), [report]);

  const stats = useMemo(() => {
    if (!report) return null;
    const derived = deriveStats(report, active?.file.size ?? 0);
    return {
      container: getGeneralString(report, 'Format') ?? '—',
      version: normalizeVersion(getGeneralString(report, 'Format_Version')),
      ...derived
    };
  }, [report, active]);

  /** Title / album / artist style tags shown above the stream list. */
  const generalTags = useMemo(() => {
    if (!report) return [];
    const general = report.general.data;
    const pick = (...keys: string[]): string | null => {
      for (const key of keys) {
        const value = general[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
      }
      return null;
    };

    const entries: [string, string][] = [];
    const push = (tag: string, value: string | null) => {
      if (value) entries.push([tag, value]);
    };

    push('title', pick('Title', 'Movie', 'Track'));
    push('album', pick('Album'));
    push('performer', pick('Performer', 'Artist', 'Album_Performer'));
    push('genre', pick('Genre'));
    const position = pick('Track_Position');
    const total = pick('Track_Position_Total');
    push('track', position ? (total ? `${position} / ${total}` : position) : null);
    push('date', pick('Recorded_Date', 'Encoded_Date', 'Tagged_Date'));
    push('comment', pick('Comment', 'Description'));
    return entries;
  }, [report]);

  /* ------------------------------- render ------------------------------ */

  const dropzone = (
    <div
      onDragOver={event => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={event => {
        event.preventDefault();
        setDragOver(false);
        if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label={t('mediainfo.upload_title')}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={`transition-all cursor-pointer rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center ${
        dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
      } ${items.length ? 'py-4' : 'py-10'}`}
    >
      <div className={`rounded-full flex items-center justify-center mb-2 text-gray-400 bg-gray-100 ${items.length ? 'w-9 h-9' : 'w-14 h-14'}`}>
        <Upload size={items.length ? 18 : 26} />
      </div>
      <p className={`font-semibold text-gray-800 ${items.length ? 'text-sm' : 'text-base'}`}>
        {items.length ? t('mediainfo.add_more') : t('mediainfo.upload_title')}
      </p>
      <p className="text-xs text-gray-500 mt-1 px-3">{t('mediainfo.upload_desc')}</p>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="video/*,audio/*,.mkv,.mk3d,.mp4,.m4v,.m4b,.mov,.avi,.flv,.webm,.wmv,.mpg,.mpeg,.m2v,.ts,.m2ts,.m2t,.mts,.3gp,.3g2,.ogv,.rmvb,.mp3,.mp2,.mpa,.flac,.wav,.m4a,.aac,.opus,.ogg,.oga,.weba,.wma,.ape,.wv,.aiff,.aif,.amr,.ac3,.dts,.dtshd,.mka,.spx,.tta,.tak"
        className="hidden"
        onChange={event => {
          if (event.target.files?.length) addFiles(event.target.files);
          event.target.value = '';
        }}
      />

      {/* Sidebar */}
      <aside className="w-full lg:w-80 shrink-0 space-y-4">
        {dropzone}

        {items.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('mediainfo.files')} · {items.length}
              </span>
              <button onClick={() => inputRef.current?.click()} className="text-primary-600 hover:text-primary-700 p-1" title={t('mediainfo.add_more')}>
                <Plus size={16} />
              </button>
            </div>
            <div className="max-h-[26rem] overflow-auto divide-y divide-gray-100">
              {items.map(item => {
                const format = item.report ? getGeneralString(item.report, 'Format') : null;
                const duration = item.report ? getTrackNumber(item.report.general, 'Duration') : null;
                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveId(item.id)}
                    className={`group flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                      item.id === activeId ? 'bg-primary-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <FileIcon kind={item.kind} active={item.id === activeId} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.file.name}</p>
                      <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
                        {item.status === 'parsing' && <Loader2 size={11} className="animate-spin shrink-0" />}
                        <span className="truncate">
                          {item.status === 'queued'
                            ? t('mediainfo.queued')
                            : item.status === 'parsing'
                              ? t('mediainfo.parsing')
                              : item.status === 'error'
                                ? t('mediainfo.error.parse')
                                : `${format || '—'} · ${formatClock(duration)} · ${formatBytes(item.file.size)}`}
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={event => {
                        event.stopPropagation();
                        removeItem(item.id);
                      }}
                      className="text-gray-300 hover:text-red-500 p-1 shrink-0"
                      title={t('mediainfo.remove_file')}
                    >
                      <X size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
            {items.length > 1 && (
              <div className="flex border-t border-gray-100 divide-x divide-gray-100">
                <button
                  onClick={exportAll}
                  className="flex-1 text-xs font-medium text-gray-500 hover:text-primary-600 flex items-center justify-center gap-1 py-2 hover:bg-primary-50 transition-colors"
                >
                  <Download size={13} /> {t('mediainfo.export_all')}
                </button>
                <button
                  onClick={clearAll}
                  className="flex-1 text-xs font-medium text-gray-500 hover:text-red-600 flex items-center justify-center gap-1 py-2 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={13} /> {t('mediainfo.clear_all')}
                </button>
              </div>
            )}
          </div>
        )}

        {skipped.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-amber-800">{t('mediainfo.skipped', { n: skipped.length })}</p>
              <p className="text-[11px] text-amber-700/80 mt-1 break-all">
                {skipped.slice(0, 3).join(' · ')}
                {skipped.length > 3 ? ' …' : ''}
              </p>
            </div>
            <button onClick={() => setSkipped([])} className="text-amber-500 hover:text-amber-700 shrink-0" title={t('common.close')}>
              <X size={13} />
            </button>
          </div>
        )}

        <div className="flex items-start gap-2 text-[11px] leading-relaxed text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-3">
          <ShieldCheck size={14} className="text-green-600 shrink-0 mt-0.5" />
          <span>{t('mediainfo.local_note')}</span>
        </div>
      </aside>

      {/* Main panel */}
      <section className="flex-1 min-w-0">
        {!active && (
          <div className="h-full min-h-[420px] border border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 mb-4">
              <FileVideo size={30} />
            </div>
            <p className="font-semibold text-gray-700">{t('mediainfo.empty.title')}</p>
            <p className="text-sm text-gray-500 mt-1 max-w-sm">{t('mediainfo.empty.desc')}</p>
          </div>
        )}

        {active && (active.status === 'parsing' || active.status === 'queued') && (
          <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-gray-500">
            <Loader2 size={28} className="animate-spin mb-3 text-primary-500" />
            <p className="text-sm">{active.status === 'queued' ? t('mediainfo.queued') : t('mediainfo.parsing')}</p>
            {active.status === 'parsing' && <p className="text-xs text-gray-400 mt-1">{t('mediainfo.loading_engine')}</p>}
          </div>
        )}

        {active && active.status === 'error' && (
          <div className="border border-red-200 bg-red-50 rounded-xl p-6">
            <p className="font-semibold text-red-700 flex items-center gap-2">
              <AlertTriangle size={18} /> {t('mediainfo.error.parse')}
            </p>
            <p className="text-sm text-red-600 mt-2 break-all font-mono">{active.error}</p>
            <p className="text-xs text-red-500 mt-3 leading-relaxed">
              {active.errorCode === 'engine'
                ? t('mediainfo.error.module')
                : active.errorCode === 'empty'
                  ? t('mediainfo.error.empty_desc')
                  : null}
            </p>
            <button
              onClick={() => enqueue(() => parseItem(active))}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-700 text-xs font-medium hover:bg-red-100"
            >
              <RotateCw size={13} /> {t('mediainfo.retry')}
            </button>
          </div>
        )}

        {active && report && stats && (
          <div className="space-y-5">
            {/* File header */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="p-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 break-all">{active.file.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {stats.container}
                    {stats.version ? ` · v${stats.version}` : ''} · {formatClock(stats.duration)} · {formatBytes(stats.fileSize)}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {KINDS.map(kind => {
                      const count = report.counts[kind];
                      if (!count || kind === 'General') return null;
                      return (
                        <Chip key={kind} tone={kind === 'Video' ? 'blue' : kind === 'Audio' ? 'green' : 'gray'}>
                          {count} × {kindLabel(kind)}
                        </Chip>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <ActionButton
                    icon={isCopied('text') ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                    label={isCopied('text') ? t('common.copied') : t('mediainfo.copy_text')}
                    onClick={async () => {
                      const text = active.text ?? (await loadText(active));
                      if (text) copy(text, 'text');
                      else setTab('text');
                    }}
                  />
                  <ActionButton
                    icon={isCopied('json') ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                    label={isCopied('json') ? t('common.copied') : t('mediainfo.copy_json')}
                    onClick={() => copy(jsonReport, 'json')}
                  />
                  <ActionButton
                    icon={<Download size={14} />}
                    label=".txt"
                    onClick={async () => {
                      const text = active.text ?? (await loadText(active));
                      if (text) download(text, `${baseName(active.file.name)}.mediainfo.txt`);
                      else setTab('text');
                    }}
                    title={t('mediainfo.download_txt')}
                  />
                  <ActionButton
                    icon={<Download size={14} />}
                    label=".json"
                    onClick={() => download(jsonReport, `${baseName(active.file.name)}.mediainfo.json`, 'application/json')}
                    title={t('mediainfo.download_json')}
                  />
                </div>
              </div>

              {active.kind !== 'other' && report.tracks.length > 0 && (
                <div className="border-t border-gray-100 bg-gray-50 p-3">
                  {active.previewFailed || !canPreview ? (
                    <p className="text-xs text-gray-500 flex items-center gap-1.5 px-1 py-2">
                      <Info size={13} /> {t('mediainfo.preview.unsupported')}
                    </p>
                  ) : active.kind === 'video' ? (
                    <video
                      key={active.url}
                      src={active.url}
                      controls
                      preload="metadata"
                      className="w-full max-h-72 rounded-lg bg-black"
                      onError={() => updateItem(active.id, { previewFailed: true })}
                    />
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                        <Music size={16} />
                      </div>
                      <audio
                        key={active.url}
                        src={active.url}
                        controls
                        preload="metadata"
                        className="w-full"
                        onError={() => updateItem(active.id, { previewFailed: true })}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-100 p-1 rounded-xl w-fit max-w-full overflow-x-auto">
              {([
                ['overview', t('mediainfo.tab.overview')],
                ['fields', t('mediainfo.tab.fields')],
                ['text', t('mediainfo.tab.text')],
                ['json', 'JSON']
              ] as [Tab, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-3.5 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                    tab === key ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Overview */}
            {tab === 'overview' && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                  <StatCard label={t('mediainfo.stat.container')} value={stats.container} hint={stats.version ? `v${stats.version}` : undefined} />
                  <StatCard
                    label={t('mediainfo.stat.duration')}
                    value={formatClock(stats.duration)}
                    hint={stats.duration ? `${stats.duration.toFixed(3)} s` : undefined}
                  />
                  <StatCard label={t('mediainfo.stat.size')} value={formatBytes(stats.fileSize)} />
                  <StatCard
                    label={t('mediainfo.stat.bitrate')}
                    value={`${stats.overallBitRateDerived ? '≈' : ''}${formatBitrate(stats.overallBitRate)}`}
                    hint={stats.overallBitRateDerived ? t('mediainfo.stat.derived') : undefined}
                  />
                  <StatCard
                    label={t('mediainfo.stat.streams')}
                    value={String(report.tracks.length)}
                    hint={KINDS.filter(kind => kind !== 'General' && report.counts[kind])
                      .map(kind => `${report.counts[kind]} ${kindLabel(kind)}`)
                      .join(' · ')}
                  />
                </div>

                {generalTags.length > 0 && (
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('mediainfo.section.tags')}</div>
                    <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {generalTags.map(([tag, value]) => (
                        <div key={tag} className="min-w-0">
                          <dt className="text-[10px] uppercase tracking-wide text-gray-400">{t(`mediainfo.tag.${tag}`)}</dt>
                          <dd className="text-sm text-gray-800 mt-0.5 break-words">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('mediainfo.section.tracks')}</span>
                    <span className="text-[11px] text-gray-400 truncate">
                      {getGeneralString(report, 'Encoded_Library', 'Encoded_Application')
                        ? `${t('mediainfo.encoded_by')} ${getGeneralString(report, 'Encoded_Library', 'Encoded_Application')}`
                        : ''}
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {report.tracks.map(item => (
                      <TrackRow
                        key={item.id}
                        track={item}
                        label={trackLabel(item)}
                        summary={summarizeTrack(item, dict)}
                        defaultLabel={t('mediainfo.badge.default')}
                        forcedLabel={t('mediainfo.badge.forced')}
                      />
                    ))}
                    {report.tracks.length === 0 && (
                      <p className="px-4 py-6 text-sm text-gray-500 text-center">{t('mediainfo.no_streams')}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Fields */}
            {tab === 'fields' && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {query.trim() === '' ? (
                    <div className="flex flex-wrap gap-1.5">
                      {[report.general, ...report.tracks].map(item => (
                        <button
                          key={item.id}
                          onClick={() => setTrackId(item.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            trackId === item.id
                              ? 'bg-primary-50 border-primary-200 text-primary-700'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {trackLabel(item)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-gray-500">{t('mediainfo.search_scope')}</span>
                  )}

                  <div className="flex items-center gap-2">
                    {query.trim() === '' && selectedTrack && (
                      <button
                        onClick={() => copy(fieldsToText(trackFields), 'track')}
                        title={t('mediainfo.copy_track')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 hover:text-primary-600"
                      >
                        {isCopied('track') ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                        {isCopied('track') ? t('common.copied') : t('mediainfo.copy_track')}
                      </button>
                    )}
                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        placeholder={t('mediainfo.search_fields')}
                        className="pl-8 pr-7 py-1.5 w-56 max-w-full text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                      />
                      {query && (
                        <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {globalMatches ? (
                  globalMatches.length === 0 ? (
                    <div className="rounded-xl border border-gray-200 bg-white py-10 text-center text-sm text-gray-500">
                      {t('mediainfo.no_match')}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {globalMatches.map(group => (
                        <div key={group.track.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                            <button
                              onClick={() => {
                                setTrackId(group.track.id);
                                setQuery('');
                              }}
                              className="text-xs font-semibold text-gray-700 hover:text-primary-600 text-left"
                            >
                              {trackLabel(group.track)}
                            </button>
                            <span className="text-[11px] text-gray-400">{t('mediainfo.fields.count', { n: group.fields.length })}</span>
                          </div>
                          <FieldTable
                            fields={group.fields}
                            tokenPrefix={group.track.id}
                            isCopied={isCopied}
                            onCopy={copy}
                            copyLabel={t('mediainfo.copy_field')}
                          />
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 text-[11px] text-gray-500">
                      <span>{t('mediainfo.fields.count', { n: fields.length })}</span>
                      {selectedTrack && <span className="font-mono text-gray-400">{selectedTrack.kind}</span>}
                    </div>
                    {fields.length === 0 ? (
                      <p className="px-4 py-8 text-sm text-gray-500 text-center">{t('mediainfo.no_match')}</p>
                    ) : (
                      <FieldTable
                        fields={fields}
                        tokenPrefix={selectedTrack?.id ?? 'track'}
                        isCopied={isCopied}
                        onCopy={copy}
                        copyLabel={t('mediainfo.copy_field')}
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* MediaInfo text report */}
            {tab === 'text' && (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden animate-fade-in">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
                    <FileTerminal size={13} /> {t('mediainfo.tab.text')}
                  </span>
                  <span className="text-[11px] text-gray-400">MediaInfoLib {String((report.raw as any)?.creatingLibrary?.version ?? '')}</span>
                </div>
                {active.text ? (
                  <pre className="p-4 text-[11px] leading-relaxed font-mono text-gray-700 whitespace-pre overflow-x-auto max-h-[32rem] overflow-y-auto">
                    {active.text}
                  </pre>
                ) : active.textStatus === 'error' ? (
                  <div className="px-4 py-10 flex flex-col items-center text-center">
                    <p className="text-sm text-red-600">{t('mediainfo.error.module')}</p>
                    <button
                      onClick={() => void loadText(active, true)}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50"
                    >
                      <RotateCw size={13} /> {t('mediainfo.retry')}
                    </button>
                  </div>
                ) : (
                  <div className="px-4 py-10 flex flex-col items-center text-gray-500">
                    <Loader2 size={22} className="animate-spin mb-2 text-primary-500" />
                    <p className="text-xs">{t('mediainfo.text.loading')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Raw JSON */}
            {tab === 'json' && (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden animate-fade-in">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
                    <FileJson size={13} /> JSON
                  </span>
                  <span className="text-[11px] text-gray-400">{active.file.name}</span>
                </div>
                <pre className="p-4 text-[11px] leading-relaxed font-mono text-gray-700 whitespace-pre overflow-auto max-h-[32rem]">
                  {jsonReport}
                </pre>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Sub components                                                      */
/* ------------------------------------------------------------------ */

const FieldTable: React.FC<{
  fields: MediaField[];
  tokenPrefix: string;
  isCopied: (token: string) => boolean;
  onCopy: (text: string, token: string) => void;
  copyLabel: string;
}> = ({ fields, tokenPrefix, isCopied, onCopy, copyLabel }) => (
  <div className="divide-y divide-gray-50">
    {fields.map(field => {
      const token = `${tokenPrefix}:${field.key}`;
      return (
        <div key={field.key} className="group grid grid-cols-[minmax(0,0.9fr)_minmax(0,2fr)_auto] gap-3 px-4 py-2 hover:bg-gray-50 items-start">
          <span className="font-mono text-[11px] text-gray-500 break-all pt-0.5">{field.key}</span>
          <span className="text-xs text-gray-800 break-words">
            {field.display}
            {field.hint && <span className="text-gray-400 ml-1.5">({field.hint})</span>}
          </span>
          <button
            onClick={() => onCopy(field.raw, token)}
            title={copyLabel}
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-gray-400 hover:text-primary-600 p-0.5"
          >
            {isCopied(token) ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
          </button>
        </div>
      );
    })}
  </div>
);

const FileIcon: React.FC<{ kind: Item['kind']; active?: boolean }> = ({ kind, active }) => (
  <div
    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
      active ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500'
    }`}
  >
    {kind === 'video' ? <FileVideo size={16} /> : kind === 'audio' ? <FileAudio size={16} /> : <FileVideo size={16} />}
  </div>
);

const Chip: React.FC<{ tone?: 'gray' | 'blue' | 'green'; children: React.ReactNode }> = ({ tone = 'gray', children }) => {
  const tones = {
    gray: 'bg-gray-50 text-gray-600 border-gray-200',
    blue: 'bg-primary-50 text-primary-700 border-primary-100',
    green: 'bg-green-50 text-green-700 border-green-100'
  } as const;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-medium ${tones[tone]}`}>{children}</span>;
};

const StatCard: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 min-w-0">
    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
    <p className="text-sm font-semibold text-gray-900 mt-1 break-words">{value}</p>
    {hint && <p className="text-[11px] text-gray-500 mt-0.5 break-words">{hint}</p>}
  </div>
);

const ActionButton: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; title?: string }> = ({ icon, label, onClick, title }) => (
  <button
    onClick={onClick}
    title={title ?? label}
    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 hover:text-primary-600 transition-colors"
  >
    {icon}
    {label}
  </button>
);

const TrackRow: React.FC<{
  track: RawTrack;
  label: string;
  summary: { headline: string; chips: string[] };
  defaultLabel: string;
  forcedLabel: string;
}> = ({ track, label, summary, defaultLabel, forcedLabel }) => {
  const icon =
    track.kind === 'Video' ? <FileVideo size={15} /> : track.kind === 'Audio' ? <Music size={15} /> : track.kind === 'Text' ? <Captions size={15} /> : <Info size={15} />;
  const tone =
    track.kind === 'Video'
      ? 'bg-primary-50 text-primary-600'
      : track.kind === 'Audio'
        ? 'bg-green-50 text-green-600'
        : 'bg-gray-100 text-gray-500';

  const title = String(track.data.Title ?? '').trim();
  const chapters = track.kind === 'Menu' ? getChapters(track) : [];

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs font-semibold text-gray-900">{label}</span>
          {summary.headline && <span className="text-xs text-gray-700 font-medium break-all">{summary.headline}</span>}
          {chapters.length > 0 && <span className="text-[11px] text-gray-500">{chapters.length}</span>}
          {isDefaultTrack(track) && <Chip tone="green">{defaultLabel}</Chip>}
          {isForcedTrack(track) && <Chip tone="blue">{forcedLabel}</Chip>}
        </div>
        {title && <p className="text-[11px] text-gray-500 mt-0.5 break-words">{title}</p>}
        {summary.chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {summary.chips.map((chip, index) => (
              <span key={`${chip}-${index}`} className="px-1.5 py-0.5 rounded bg-gray-50 border border-gray-100 text-[10px] text-gray-600 font-mono">
                {chip}
              </span>
            ))}
          </div>
        )}
        {chapters.length > 0 && (
          <div className="mt-2 max-h-44 overflow-auto rounded-lg border border-gray-100 bg-gray-50/60 divide-y divide-gray-100">
            {chapters.map((chapter, index) => (
              <div key={`${chapter.time}-${index}`} className="flex items-baseline gap-3 px-2.5 py-1.5">
                <span className="font-mono text-[10px] text-gray-400 shrink-0">{chapter.time}</span>
                <span className="text-[11px] text-gray-700 break-words">{chapter.title || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaInfoViewer;
