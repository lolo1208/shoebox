/// <reference lib="dom" />
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Aperture,
  CalendarClock,
  Camera,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eraser,
  Eye,
  FileArchive,
  HardDrive,
  Image as ImageIcon,
  Info,
  Loader2,
  MapPin,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  User,
  X
} from 'lucide-react';
import JSZip from 'jszip';
import { useLanguage } from '@/contexts/LanguageContext';
import { useClipboard } from '@/hooks/useClipboard';
import {
  analyzeFile,
  formatBytes,
  stripMetadata,
  type ExifEntry,
  type MetaReport,
  type RiskKey,
  type StripResult,
  type TagGroup
} from '@/lib/image/exif';

interface Item {
  id: string;
  file: File;
  url: string;
  status: 'parsing' | 'ready' | 'error';
  report?: MetaReport;
  error?: string;
}

interface CleanResult extends StripResult {
  url: string;
}

type Tab = 'overview' | 'tags' | 'clean';

const GROUP_ORDER: TagGroup[] = ['camera', 'exposure', 'time', 'gps', 'image', 'other'];

const GROUP_LABEL: Record<TagGroup, string> = {
  camera: 'exif.group.camera',
  exposure: 'exif.group.exposure',
  time: 'exif.group.time',
  gps: 'exif.group.gps',
  image: 'exif.group.image',
  other: 'exif.group.other'
};

const RISK_LABEL: Record<RiskKey, string> = {
  gps: 'exif.risk.item.gps',
  thumbnail: 'exif.risk.item.thumbnail',
  serial: 'exif.risk.item.serial',
  owner: 'exif.risk.item.owner',
  software: 'exif.risk.item.software',
  makernote: 'exif.risk.item.makernote',
  xmp: 'exif.risk.item.xmp',
  comment: 'exif.risk.item.comment',
  iptc: 'exif.risk.item.iptc'
};

const hasLocationData = (report: MetaReport): boolean =>
  report.supported && (!!report.gps || report.xmp.length > 0 || report.iptc || report.locationWipes.length > 0);

const REMOVED_LABEL: Record<string, string> = {
  Comment: 'exif.removed.comment',
  'ICC profile': 'exif.removed.icc',
  'JFIF thumbnail': 'exif.removed.jfif_thumb',
  'JFIF extension': 'exif.removed.jfif_ext',
  'Text chunk': 'exif.removed.text',
  'GPS location': 'exif.removed.gps'
};

const triggerDownload = (url: string, name: string) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

const ExifTool: React.FC = () => {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<Set<string>>(new Set());

  const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [dragOver, setDragOver] = useState(false);

  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<'all' | TagGroup>('all');
  const { copy: copyText, isCopied } = useClipboard(1600);

  const [keepIcc, setKeepIcc] = useState(true);
  const [keepOrientation, setKeepOrientation] = useState(true);
  const [scope, setScope] = useState<'all' | 'location'>('all');
  const [busy, setBusy] = useState<null | 'single' | 'batch'>(null);
  const [cleanError, setCleanError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, CleanResult>>({});
  const [batch, setBatch] = useState<{ url: string; name: string; count: number } | null>(null);

  const track = (url: string) => {
    urlsRef.current.add(url);
    return url;
  };
  const untrack = (url: string) => {
    if (urlsRef.current.delete(url)) URL.revokeObjectURL(url);
  };

  useEffect(() => {
    return () => {
      urlsRef.current.forEach(url => URL.revokeObjectURL(url));
      urlsRef.current.clear();
    };
  }, []);

  // A different file may not have the same tag groups or previous clean message.
  useEffect(() => {
    setGroup('all');
    setCleanError(null);
    setNotice(null);
  }, [activeId]);

  const active = items.find(i => i.id === activeId) || null;
  const report = active?.report;
  const result = active ? results[active.id] : undefined;

  const tagMap = useMemo(() => {
    const map = new Map<string, string>();
    report?.tags.forEach(entry => {
      if (!map.has(entry.name)) map.set(entry.name, entry.value);
    });
    return map;
  }, [report]);

  const tagValue = (name: string): string | undefined => {
    const value = tagMap.get(name);
    return value && value !== '—' ? value : undefined;
  };

  const addFiles = async (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList).filter(file => file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i.test(file.name));
    if (!incoming.length) return;

    const created: Item[] = incoming.map(file => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      url: track(URL.createObjectURL(file)),
      status: 'parsing'
    }));

    setItems(prev => [...prev, ...created]);
    setActiveId(prev => prev || created[0].id);

    for (const item of created) {
      try {
        const parsed = await analyzeFile(item.file);
        setItems(prev => prev.map(x => (x.id === item.id ? { ...x, status: 'ready', report: parsed } : x)));
      } catch (error) {
        setItems(prev => prev.map(x => (
          x.id === item.id
            ? { ...x, status: 'error', error: error instanceof Error ? error.message : String(error) }
            : x
        )));
      }
    }
  };

  const removeItem = (id: string) => {
    const target = items.find(i => i.id === id);
    if (target) untrack(target.url);
    const cleaned = results[id];
    if (cleaned) {
      untrack(cleaned.url);
      setResults(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    const remaining = items.filter(i => i.id !== id);
    setItems(remaining);
    if (activeId === id) setActiveId(remaining[0]?.id || null);
  };

  const clearAll = () => {
    items.forEach(item => untrack(item.url));
    Object.values(results).forEach(r => untrack(r.url));
    if (batch) untrack(batch.url);
    setItems([]);
    setResults({});
    setBatch(null);
    setActiveId(null);
    setCleanError(null);
    setNotice(null);
    setQuery('');
    setGroup('all');
  };

  const copy = async (text: string, key: string) => {
    await copyText(text, key);
  };

  const reportJson = useMemo(() => {
    if (!report || !active) return '';
    return JSON.stringify(
      {
        file: active.file.name,
        format: report.format,
        width: report.width,
        height: report.height,
        orientation: report.orientation,
        fileSize: report.fileSize,
        metadataBytes: report.metadataBytes,
        gps: report.gps || null,
        hasThumbnail: report.hasThumbnail,
        iccProfileBytes: report.iccSize || null,
        risks: report.risks,
        tags: report.tags.map(({ name, group: g, value }) => ({ name, group: g, value })),
        xmp: report.xmp,
        comments: report.comments
      },
      null,
      2
    );
  }, [report, active]);

  const tagsText = useMemo(() => {
    if (!report) return '';
    return report.tags.map(entry => `${entry.name}\t${entry.value}`).join('\n');
  }, [report]);

  const filteredTags = useMemo(() => {
    if (!report) return [];
    const q = query.trim().toLowerCase();
    return report.tags
      .filter(entry => (group === 'all' || entry.group === group) && (!q
        || entry.name.toLowerCase().includes(q)
        || entry.value.toLowerCase().includes(q)))
      .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
  }, [report, group, query]);

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    report?.tags.forEach(entry => {
      counts[entry.group] = (counts[entry.group] || 0) + 1;
    });
    return counts;
  }, [report]);

  const cleanCurrent = async () => {
    if (!active || !report) return;
    setBusy('single');
    setCleanError(null);
    setNotice(null);
    try {
      const cleaned = await stripMetadata(active.file, report, { keepIcc, keepOrientation, scope });
      const url = track(URL.createObjectURL(cleaned.blob));
      const previous = results[active.id];
      if (previous) untrack(previous.url);
      setResults(prev => ({ ...prev, [active.id]: { ...cleaned, url } }));
      triggerDownload(url, cleaned.name);
    } catch (error) {
      setCleanError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const cleanAll = async () => {
    const ready = items.filter(i => i.report && (scope === 'all' || hasLocationData(i.report)));
    if (!ready.length) return;
    setBusy('batch');
    setCleanError(null);
    setNotice(null);
    try {
      const zip = new JSZip();
      let count = 0;
      const failed: string[] = [];
      const usedNames = new Set<string>();
      for (const item of ready) {
        if (!item.report) continue;
        try {
          const cleaned = await stripMetadata(item.file, item.report, { keepIcc, keepOrientation, scope });
          let fileName = cleaned.name;
          if (usedNames.has(fileName)) {
            const dot = fileName.lastIndexOf('.');
            fileName = dot > 0
              ? `${fileName.slice(0, dot)}-${count + 1}${fileName.slice(dot)}`
              : `${fileName}-${count + 1}`;
          }
          usedNames.add(fileName);
          zip.file(fileName, cleaned.blob);
          count++;
        } catch {
          failed.push(item.file.name);
        }
        await new Promise(resolve => window.setTimeout(resolve, 0));
      }
      if (!count) {
        setCleanError(t('exif.clean.batch_failed'));
        return;
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = track(URL.createObjectURL(blob));
      const name = `cleaned-${count}.zip`;
      if (batch) untrack(batch.url);
      setBatch({ url, name, count });
      if (failed.length) setNotice(t('exif.clean.batch_skipped', { n: failed.length }));
      triggerDownload(url, name);
    } catch (error) {
      setCleanError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const camera = [tagValue('Make'), tagValue('Model')].filter(Boolean).join(' ');
  const lens = tagValue('LensModel') || tagValue('LensSpecification');
  const iso = tagValue('PhotographicSensitivity') || tagValue('ISOSpeed');
  const exposure = [
    tagValue('ExposureTime'),
    tagValue('FNumber'),
    iso ? `ISO ${iso}` : ''
  ].filter(Boolean).join(' · ');
  const focal = [tagValue('FocalLength'), tagValue('FocalLengthIn35mmFilm')].filter(Boolean).join(' / ');
  const taken = tagValue('DateTimeOriginal') || tagValue('DateTimeDigitized') || tagValue('DateTime');
  const author = tagValue('Artist') || tagValue('Copyright') || tagValue('CameraOwnerName');
  const orientationLabel = report?.orientation
    ? `${report.orientation >= 1 && report.orientation <= 8
      ? t(`exif.orient.${report.orientation}`)
      : t('exif.unknown')} (${report.orientation})`
    : '—';
  const hasRotation = !!report?.orientation && report.orientation >= 2 && report.orientation <= 8;

  const hasRisks = !!report?.risks.length;
  const fullRemovable = !!report && (
    !report.supported
    || report.metadataBytes > 0
    || report.xmp.length > 0
    || report.comments.length > 0
    || report.hasThumbnail
    || !!report.gps
  );
  const locationRemovable = !!report && hasLocationData(report);
  const removable = scope === 'location' ? locationRemovable : fullRemovable;
  const batchCandidates = items.filter(i => i.report && (scope === 'all' || hasLocationData(i.report))).length;

  const groupTabs: ('all' | TagGroup)[] = ['all', ...GROUP_ORDER];

  const estimatedSize = useMemo(() => {
    if (!report || scope === 'location' || report.inPlaceOnly) return 0;
    let saving = report.metadataBytes;
    if (keepIcc && report.iccSize) {
      const overhead = report.format === 'JPEG' ? 4 : report.format === 'PNG' ? 12 : report.format === 'WEBP' ? 8 + (report.iccSize & 1) : 0;
      saving -= report.iccSize + overhead;
    }
    if (keepOrientation && hasRotation) {
      saving -= report.format === 'PNG' ? 38 : report.format === 'WEBP' ? 34 : 36;
    }
    return Math.max(0, report.fileSize - Math.max(0, saving));
  }, [report, keepIcc, keepOrientation, hasRotation, scope]);

  /* ---------------------------------------------------------------- */

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
      aria-label={t('exif.upload_title')}
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
      <div className={`rounded-full flex items-center justify-center mb-2 text-gray-400 ${items.length ? 'w-9 h-9 bg-gray-100' : 'w-14 h-14 bg-gray-100'}`}>
        <Upload size={items.length ? 18 : 26} />
      </div>
      <p className={`font-semibold text-gray-800 ${items.length ? 'text-sm' : 'text-base'}`}>
        {items.length ? t('exif.add_more') : t('exif.upload_title')}
      </p>
      <p className="text-xs text-gray-500 mt-1 px-3">{t('exif.upload_desc')}</p>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
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
                {t('exif.files')} · {items.length}
              </span>
              <button
                onClick={() => inputRef.current?.click()}
                className="text-primary-600 hover:text-primary-700 p-1"
                title={t('exif.add_more')}
                aria-label={t('exif.add_more')}
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="max-h-64 overflow-auto divide-y divide-gray-100">
              {items.map(item => (
                <div
                  key={item.id}
                  onClick={() => setActiveId(item.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                    item.id === activeId ? 'bg-primary-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="relative w-10 h-10 rounded-md bg-gray-100 shrink-0 overflow-hidden">
                    <ImageIcon size={16} className="absolute inset-0 m-auto text-gray-300" />
                    <img
                      src={item.url}
                      alt=""
                      className="relative w-10 h-10 rounded-md object-cover bg-gray-100"
                      onError={event => { event.currentTarget.style.visibility = 'hidden'; }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.file.name}</p>
                    <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
                      {item.status === 'parsing' && <Loader2 size={11} className="animate-spin" />}
                      <span className="truncate">
                        {item.status === 'parsing'
                          ? t('exif.parsing')
                          : item.status === 'error'
                            ? t('exif.error.parse')
                            : `${item.report ? (item.report.supported ? item.report.format : t('exif.unknown')) : '—'} · ${formatBytes(item.file.size)}`}
                      </span>
                      {item.report?.gps && <MapPin size={11} className="text-red-500 shrink-0" />}
                      {item.report?.xmp.length ? <Sparkles size={11} className="text-amber-500 shrink-0" /> : null}
                    </p>
                  </div>
                  <button
                    onClick={event => {
                      event.stopPropagation();
                      removeItem(item.id);
                    }}
                    disabled={!!busy}
                    className="text-gray-300 hover:text-red-500 p-1 disabled:opacity-30 disabled:hover:text-gray-300"
                    aria-label={`${t('exif.remove')} ${item.file.name}`}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {active && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="relative rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center h-40 overflow-hidden">
              <ImageIcon size={28} className="absolute text-gray-300" />
              <img
                src={active.url}
                alt={active.file.name}
                className="relative max-w-full max-h-full object-contain"
                onError={event => { event.currentTarget.style.visibility = 'hidden'; }}
              />
            </div>
            <p className="mt-3 text-sm font-semibold text-gray-900 break-all">{active.file.name}</p>
            <p className="text-xs text-gray-500 mt-1">
              {report ? `${report.supported ? report.format : t('exif.unknown')} · ${report.width && report.height ? `${report.width} × ${report.height} · ` : ''}${formatBytes(report.fileSize)}` : '...'}
            </p>
            {report && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {report.gps && <Badge tone="red" icon={<MapPin size={11} />}>{t('exif.badge.gps')}</Badge>}
                {report.xmp.length > 0 && <Badge tone="amber">{t('exif.badge.xmp')}</Badge>}
                {report.hasThumbnail && <Badge tone="amber">{t('exif.badge.thumb')}</Badge>}
                {report.iccSize ? <Badge tone="gray">{t('exif.badge.icc')}</Badge> : null}
                {!hasRisks && report.supported && <Badge tone="green" icon={<ShieldCheck size={11} />}>{t('exif.badge.clean')}</Badge>}
              </div>
            )}
            <button
              onClick={clearAll}
              disabled={!!busy}
              className="mt-3 w-full text-xs font-medium text-gray-500 hover:text-red-600 flex items-center justify-center gap-1 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40 disabled:hover:text-gray-500 disabled:hover:bg-transparent"
            >
              <Trash2 size={13} /> {t('exif.clear_all')}
            </button>
          </div>
        )}

        <div className="flex items-start gap-2 text-[11px] leading-relaxed text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-3">
          <ShieldCheck size={14} className="text-green-600 shrink-0 mt-0.5" />
          <span>{t('exif.local_note')}</span>
        </div>
      </aside>

      {/* Main panel */}
      <section className="flex-1 min-w-0">
        {!active && (
          <div className="h-full min-h-[420px] border border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 mb-4">
              <Eye size={32} />
            </div>
            <p className="font-semibold text-gray-700">{t('exif.empty.title')}</p>
            <p className="text-sm text-gray-500 mt-1 max-w-sm">{t('exif.empty.desc')}</p>
          </div>
        )}

        {active && active.status === 'error' && (
          <div className="border border-red-200 bg-red-50 rounded-xl p-6">
            <p className="font-semibold text-red-700 flex items-center gap-2"><ShieldAlert size={18} /> {t('exif.error.parse')}</p>
            <p className="text-sm text-red-600 mt-2 break-all">{active.error}</p>
          </div>
        )}

        {active && active.status === 'parsing' && (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-gray-500">
            <Loader2 size={28} className="animate-spin mb-3 text-primary-500" />
            <p className="text-sm">{t('exif.parsing')}</p>
          </div>
        )}

        {active && report && active.status === 'ready' && (
          <div className="space-y-5">
            {/* Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex bg-gray-100 p-1 rounded-xl">
                {([
                  ['overview', t('exif.tab.overview'), Eye],
                  ['tags', `${t('exif.tab.tags')} (${report.tags.length})`, Tag],
                  ['clean', t('exif.tab.clean'), Eraser]
                ] as [Tab, string, typeof Eye][]).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-all ${
                      tab === key ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => copy(reportJson, 'json')}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-primary-600 px-3 py-2 rounded-lg hover:bg-gray-50"
              >
                {isCopied('json') ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                {isCopied('json') ? t('common.copied') : t('exif.export')}
              </button>
            </div>

            {/* ---------------- Overview ---------------- */}
            {tab === 'overview' && (
              <div className="space-y-5 animate-fade-in">
                {!report.supported ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                      <Info size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-amber-800 text-sm">{t('exif.unsupported.title')}</p>
                      <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">{t('exif.unsupported')}</p>
                      {report.warnings.filter(warning => warning !== 'unsupported').length > 0 && (
                        <p className="text-[11px] text-amber-600 mt-1 break-all">
                          {report.warnings.filter(warning => warning !== 'unsupported').join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                ) : report.gps ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3">
                    <div className="w-9 h-9 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                      <MapPin size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-red-800 text-sm">{t('exif.risk.gps')}</p>
                      <p className="text-xs text-red-600 mt-0.5 leading-relaxed">{t('exif.risk.gps.desc')}</p>
                    </div>
                  </div>
                ) : hasRisks ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                      <ShieldAlert size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-amber-800 text-sm">{t('exif.risk.meta')}</p>
                      <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">{t('exif.risk.meta.desc')}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex gap-3">
                    <div className="w-9 h-9 rounded-lg bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                      <ShieldCheck size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-green-800 text-sm">{t('exif.risk.none')}</p>
                      <p className="text-xs text-green-700 mt-0.5 leading-relaxed">{t('exif.risk.none.desc')}</p>
                    </div>
                  </div>
                )}

                {hasRisks && (
                  <div className="flex flex-wrap gap-2">
                    {report.risks.map(risk => (
                      <span key={risk} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-gray-200 text-xs text-gray-600">
                        <ShieldAlert size={12} className="text-amber-500" /> {t(RISK_LABEL[risk])}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  <InfoCard icon={<Camera size={14} />} label={t('exif.card.camera')} value={camera || '—'} hint={lens} />
                  <InfoCard icon={<Aperture size={14} />} label={t('exif.card.exposure')} value={exposure || '—'} />
                  <InfoCard icon={<ImageIcon size={14} />} label={t('exif.card.focus')} value={focal || '—'} />
                  <InfoCard icon={<CalendarClock size={14} />} label={t('exif.card.taken')} value={taken || '—'} />
                  <InfoCard icon={<User size={14} />} label={t('exif.card.author')} value={author || '—'} />
                  <InfoCard icon={<Info size={14} />} label={t('exif.card.software')} value={tagValue('Software') || '—'} />
                </div>

                {/* GPS */}
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                    <MapPin size={14} /> {t('exif.card.gps')}
                  </div>
                  {report.gps ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-gray-50 rounded-lg px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-gray-400">{t('exif.gps.lat')}</p>
                          <p className="text-sm font-mono text-gray-900 mt-0.5">{report.gps.latitude.toFixed(6)}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-gray-400">{t('exif.gps.lng')}</p>
                          <p className="text-sm font-mono text-gray-900 mt-0.5">{report.gps.longitude.toFixed(6)}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-gray-400">{t('exif.gps.alt')}</p>
                          <p className="text-sm font-mono text-gray-900 mt-0.5">
                            {report.gps.altitude !== undefined ? `${report.gps.altitude.toFixed(1)} m` : '—'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${report.gps.latitude.toFixed(6)}&mlon=${report.gps.longitude.toFixed(6)}#map=15/${report.gps.latitude.toFixed(6)}/${report.gps.longitude.toFixed(6)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 text-xs font-medium hover:bg-primary-100"
                        >
                          <MapPin size={13} /> {t('exif.gps.open')}
                        </a>
                        <button
                          onClick={() => copy(`${report.gps!.latitude.toFixed(6)}, ${report.gps!.longitude.toFixed(6)}`, 'gps')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50"
                        >
                          {isCopied('gps') ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                          {isCopied('gps') ? t('common.copied') : t('exif.gps.copy')}
                        </button>
                        {report.gps.timestamp && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <CalendarClock size={12} /> {report.gps.timestamp}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">{t('exif.gps.none')}</p>
                  )}
                </div>

                {/* Technical summary */}
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                    <HardDrive size={14} /> {t('exif.card.file')}
                  </div>
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-sm">
                    <Summary label={t('exif.file_size')} value={formatBytes(report.fileSize)} />
                    <Summary label={t('exif.meta_size')} value={formatBytes(report.metadataBytes)} />
                    <Summary label={t('exif.card.orientation')} value={orientationLabel} />
                    <Summary label={t('exif.card.thumbnail')} value={report.hasThumbnail ? t('exif.yes') : t('exif.no')} />
                    <Summary label={t('exif.icc')} value={report.iccSize ? formatBytes(report.iccSize) : t('exif.no')} />
                    <Summary label={t('exif.dimensions')} value={report.width && report.height ? `${report.width} × ${report.height}` : '—'} />
                    <Summary label={t('exif.format')} value={report.supported ? report.format : t('exif.unknown')} />
                    <Summary label={t('exif.tab.tags')} value={String(report.tags.length)} />
                  </dl>
                </div>
              </div>
            )}

            {/* ---------------- All tags ---------------- */}
            {tab === 'tags' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="relative flex-1">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={query}
                      onChange={event => setQuery(event.target.value)}
                      placeholder={t('exif.tags.search')}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none"
                    />
                  </div>
                  <button
                    onClick={() => copy(tagsText, 'tags')}
                    disabled={!report.tags.length}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    {isCopied('tags') ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                    {isCopied('tags') ? t('common.copied') : t('exif.tags.copy')}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {groupTabs.map(key => {
                    const count = key === 'all' ? report.tags.length : groupCounts[key] || 0;
                    if (key !== 'all' && count === 0 && group !== key) return null;
                    return (
                      <button
                        key={key}
                        onClick={() => setGroup(key)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          group === key
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {key === 'all' ? t('exif.tags.group.all') : t(GROUP_LABEL[key])} · {count}
                      </button>
                    );
                  })}
                </div>

                {filteredTags.length ? (
                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.8fr)_auto] gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      <span>{t('exif.tags.col.name')}</span>
                      <span>{t('exif.tags.col.value')}</span>
                      <span className="hidden sm:block text-right">{t('exif.tags.col.tag')}</span>
                    </div>
                    <div className="max-h-[480px] overflow-auto divide-y divide-gray-100">
                      {filteredTags.map((entry, index) => (
                        <TagRow key={`${entry.group}-${entry.tag}-${index}`} entry={entry} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-gray-200 rounded-xl py-10 text-center text-sm text-gray-400">
                    {report.tags.length === 0 ? t('exif.tags.none') : t('exif.tags.empty')}
                  </div>
                )}

                {report.comments.length > 0 && (
                  <ExtraBlock title={t('exif.extra.comment')} tone="amber">
                    {report.comments.map((comment, index) => (
                      <p key={index} className="text-xs text-gray-700 whitespace-pre-wrap break-words bg-gray-50 rounded-lg p-3">{comment}</p>
                    ))}
                  </ExtraBlock>
                )}

                {report.xmp.length > 0 && (
                  <ExtraBlock title={`${t('exif.extra.xmp')} (${report.xmp.length})`} tone="amber">
                    {report.xmp.map((xmp, index) => (
                      <details key={index} className="group" open={index === 0}>
                        <summary className="cursor-pointer text-xs font-medium text-gray-600 flex items-center gap-1 select-none">
                          <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
                          {t('exif.extra.xmp')} #{index + 1} · {formatBytes(xmp.length)}
                        </summary>
                        <pre className="mt-2 max-h-64 overflow-auto text-[11px] leading-relaxed bg-gray-50 border border-gray-100 rounded-lg p-3 whitespace-pre-wrap break-all text-gray-600">
                          {xmp}
                        </pre>
                      </details>
                    ))}
                  </ExtraBlock>
                )}

                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                    <Info size={12} /> {t('exif.icc')}: {report.iccSize ? formatBytes(report.iccSize) : t('exif.no')}
                  </span>
                  {report.hasThumbnail && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      <ImageIcon size={12} /> {t('exif.card.thumbnail')}: {t('exif.yes')}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ---------------- Clean ---------------- */}
            {tab === 'clean' && (
              <div className="space-y-4 animate-fade-in max-w-3xl">
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Eraser size={17} className="text-primary-600" /> {t('exif.clean.title')}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{t('exif.clean.desc')}</p>

                  <div className="mt-4 inline-flex bg-gray-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setScope('all')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${scope === 'all' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {t('exif.scope.all')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setScope('location')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${scope === 'location' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {t('exif.scope.location')}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    {scope === 'all' ? t('exif.scope.all.desc') : t('exif.scope.location.desc')}
                  </p>

                  {scope === 'all' && !report.inPlaceOnly ? (
                    <>
                      <div className="mt-4 space-y-2">
                        <OptionRow
                          checked={keepIcc}
                          onChange={setKeepIcc}
                          title={t('exif.clean.keep_icc')}
                          desc={t('exif.clean.keep_icc.desc')}
                          disabled={!report.iccSize}
                        />
                        <OptionRow
                          checked={keepOrientation}
                          onChange={setKeepOrientation}
                          title={t('exif.clean.keep_orient')}
                          desc={hasRotation
                            ? t('exif.clean.keep_orient.desc')
                            : t('exif.clean.keep_orient.na')}
                          disabled={!hasRotation}
                        />
                      </div>

                      {(keepIcc === false && report.iccSize) || (keepOrientation === false && hasRotation) ? (
                        <div className="mt-2 space-y-1">
                          {!keepIcc && report.iccSize ? (
                            <p className="text-[11px] text-amber-600 flex items-start gap-1.5">
                              <Info size={12} className="shrink-0 mt-0.5" /> {t('exif.clean.icc_warning')}
                            </p>
                          ) : null}
                          {!keepOrientation && hasRotation ? (
                            <p className="text-[11px] text-amber-600 flex items-start gap-1.5">
                              <Info size={12} className="shrink-0 mt-0.5" /> {t('exif.clean.orient_warning')}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : scope === 'location' ? (
                    <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600 leading-relaxed">
                      {t('exif.scope.location.keep')}
                    </div>
                  ) : null}

                  {scope === 'all' && !report.inPlaceOnly ? (
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-gray-50 py-3">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400">{t('exif.clean.before')}</p>
                        <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatBytes(report.fileSize)}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 py-3">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400">{t('exif.clean.estimate')}</p>
                        <p className="text-sm font-semibold text-primary-600 mt-0.5">
                          {report.supported ? formatBytes(estimatedSize) : '—'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-gray-50 py-3">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400">{t('exif.clean.saved')}</p>
                        <p className="text-sm font-semibold text-green-600 mt-0.5">
                          {report.supported ? `−${formatBytes(Math.max(0, report.fileSize - estimatedSize))}` : '—'}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {report.inPlaceOnly && (
                    <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3 leading-relaxed">
                      {t('exif.clean.inplace_note')}
                    </p>
                  )}

                  {scope === 'location' && !report.supported && (
                    <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3 leading-relaxed">
                      {t('exif.scope.location.unsupported')}
                    </p>
                  )}

                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={cleanCurrent}
                      disabled={!!busy || !removable}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
                    >
                      {busy === 'single' ? <Loader2 size={16} className="animate-spin" /> : <Eraser size={16} />}
                      {busy === 'single' ? t('exif.clean.busy') : scope === 'location' ? t('exif.clean.run_location') : t('exif.clean.run')}
                    </button>
                    {items.length > 1 && (
                      <button
                        onClick={cleanAll}
                        disabled={!!busy || batchCandidates === 0}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-40"
                      >
                        {busy === 'batch' ? <Loader2 size={16} className="animate-spin" /> : <FileArchive size={16} />}
                        {busy === 'batch' ? t('exif.clean.busy') : scope === 'location'
                          ? t('exif.clean.run_all_location', { n: batchCandidates })
                          : t('exif.clean.run_all', { n: batchCandidates })}
                      </button>
                    )}
                  </div>

                  {!removable && (
                    <p className="mt-3 text-xs text-gray-500 flex items-center gap-1.5">
                      <Info size={13} /> {t('exif.clean.nothing')}
                    </p>
                  )}
                  {cleanError && (
                    <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 break-all">{cleanError}</p>
                  )}
                  {notice && (
                    <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">{notice}</p>
                  )}
                  {!report.supported && (
                    <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
                      {t('exif.clean.fallback')}
                    </p>
                  )}
                </div>

                {result && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                        <Check size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-green-800">{t('exif.clean.done')}</p>
                        <p className="text-xs text-green-700 mt-0.5">
                          {formatBytes(active.file.size)} → {formatBytes(result.blob.size)}
                          {result.savedBytes > 0 ? ` · ${t('exif.clean.saved')} ${formatBytes(result.savedBytes)}` : ''}
                        </p>
                        {result.inPlace && (
                          <p className="text-xs text-green-700 mt-0.5">{t('exif.clean.inplace_note')}</p>
                        )}
                        {result.removed.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {result.removed.map(label => (
                              <span key={label} className="px-2 py-0.5 rounded-full bg-white/70 border border-green-200 text-[11px] text-green-700">
                                {label === 'fallback:all'
                                  ? t('exif.clean.reencoded')
                                  : REMOVED_LABEL[label]
                                    ? t(REMOVED_LABEL[label])
                                    : label}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 mt-3">
                          <a
                            href={result.url}
                            download={result.name}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700"
                          >
                            <Download size={13} /> {t('exif.clean.download')}
                          </a>
                          <span className="inline-flex items-center text-xs text-green-700 font-mono truncate">{result.name}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {batch && (
                  <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <FileArchive size={16} className="text-primary-600" />
                      {t('exif.clean.batch_done', { n: batch.count })}
                    </div>
                    <a
                      href={batch.url}
                      download={batch.name}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Download size={13} /> {batch.name}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

const Badge: React.FC<{ tone: 'red' | 'amber' | 'green' | 'gray'; icon?: React.ReactNode; children: React.ReactNode }> = ({
  tone,
  icon,
  children
}) => {
  const tones = {
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    gray: 'bg-gray-50 text-gray-600 border-gray-200'
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${tones[tone]}`}>
      {icon}
      {children}
    </span>
  );
};

const InfoCard: React.FC<{ icon: React.ReactNode; label: string; value: string; hint?: string }> = ({ icon, label, value, hint }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 min-w-0">
    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
      {icon}
      {label}
    </div>
    <p className="text-sm font-medium text-gray-900 mt-1.5 break-words">{value}</p>
    {hint && hint !== value && <p className="text-xs text-gray-500 mt-0.5 break-words">{hint}</p>}
  </div>
);

const Summary: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="min-w-0">
    <dt className="text-[10px] uppercase tracking-wide text-gray-400">{label}</dt>
    <dd className="text-sm text-gray-800 mt-0.5 break-words">{value}</dd>
  </div>
);

const TagRow: React.FC<{ entry: ExifEntry }> = ({ entry }) => (
  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.8fr)_auto] gap-3 px-4 py-2 text-xs hover:bg-gray-50">
    <span className="font-medium text-gray-700 break-words">{entry.name}</span>
    <span className="text-gray-600 break-words" title={entry.value}>{entry.value}</span>
    <span className="hidden sm:block text-right font-mono text-[10px] text-gray-300">
      {entry.tag ? `0x${entry.tag.toString(16).padStart(4, '0')}` : '—'}
    </span>
  </div>
);

const ExtraBlock: React.FC<{ title: string; tone: 'amber'; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-2">
    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
      <Sparkles size={13} /> {title}
    </div>
    {children}
  </div>
);

const OptionRow: React.FC<{
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  desc: string;
  disabled?: boolean;
}> = ({ checked, onChange, title, desc, disabled }) => (
  <label className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
    disabled ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-gray-200 hover:bg-gray-50 cursor-pointer'
  }`}>
    <input
      type="checkbox"
      checked={checked}
      onChange={event => onChange(event.target.checked)}
      disabled={disabled}
      className="mt-0.5 w-4 h-4 accent-primary-600"
    />
    <span className="min-w-0">
      <span className="block text-sm font-medium text-gray-800">{title}</span>
      <span className="block text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</span>
    </span>
  </label>
);

export default ExifTool;
