/**
 * MediaInfo helpers: thin wrapper around mediainfo.js (WASM) plus the
 * formatting layer used by the standalone media info viewer.
 *
 * Everything runs in the browser. Only the small WASM binary is fetched from
 * a CDN, the media file itself never leaves the device.
 */

import MediaInfoFactory from 'mediainfo.js';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type TrackKind = 'General' | 'Video' | 'Audio' | 'Text' | 'Image' | 'Menu' | 'Other';

export interface RawTrack {
  kind: TrackKind;
  /** 同类型轨道中的序号（General 恒为 0） */
  index: number;
  data: Record<string, unknown>;
  /** 章节 / 唯一 ID，便于作为键与查找 */
  id: string;
}

export interface MediaReport {
  general: RawTrack;
  tracks: RawTrack[];
  counts: Partial<Record<TrackKind, number>>;
  raw: Record<string, unknown>;
}

export interface MediaField {
  key: string;
  /** 可读值（带单位、已翻译的枚举等） */
  display: string;
  /** 辅助表示，例如时长的时钟格式 */
  hint?: string;
  /** MediaInfoLib 返回的原始值 */
  raw: string;
}

/** formatFieldValue 使用的翻译词典 */
export interface ValueDict {
  yes: string;
  no: string;
  lossless: string;
  lossy: string;
  progressive: string;
  interlaced: string;
  constant: string;
  variable: string;
  limited: string;
  full: string;
  languageName: (code: string) => string;
  number: (value: number) => string;
}

export type MediaInfoErrorCode = 'empty' | 'engine';

/** 区分“文件无流”与“WASM 引擎不可用” */
export class MediaInfoError extends Error {
  readonly code: MediaInfoErrorCode;

  constructor(code: MediaInfoErrorCode, message: string) {
    super(message);
    this.name = 'MediaInfoError';
    this.code = code;
  }
}

/* ------------------------------------------------------------------ */
/* MediaInfo 引擎 */
/* ------------------------------------------------------------------ */

const WASM_SOURCES = [
  'https://unpkg.com/mediainfo.js@0.2.2/dist/MediaInfoModule.wasm',
  'https://cdn.jsdelivr.net/npm/mediainfo.js@0.2.2/dist/MediaInfoModule.wasm'
];

type ResultFormat = 'object' | 'text';

let workingSource: string | null = null;
const instances = new Map<ResultFormat, Promise<any>>();

async function createInstance(format: ResultFormat): Promise<any> {
  const candidates = workingSource
    ? [workingSource, ...WASM_SOURCES.filter(url => url !== workingSource)]
    : [...WASM_SOURCES];

  let lastError: unknown = null;
  for (const url of candidates) {
    try {
      const instance = await MediaInfoFactory({
        format,
        full: false,
        chunkSize: 4 * 1024 * 1024,
        locateFile: () => url
      });
      workingSource = url;
      return instance;
    } catch (error) {
      lastError = error;
    }
  }
  throw new MediaInfoError(
    'engine',
    lastError instanceof Error ? lastError.message : 'MediaInfo WASM module failed to load'
  );
}

function getInstance(format: ResultFormat): Promise<any> {
  const cached = instances.get(format);
  if (cached) return cached;
  const promise = createInstance(format);
  instances.set(format, promise);
  // 丢弃损坏实例，便于后续重试（如网络恢复后）
  promise.catch(() => instances.delete(format));
  return promise;
}

const readChunk = (file: File) => (chunkSize: number, offset: number) =>
  new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => {
      const buffer = event.target?.result as ArrayBuffer | undefined;
      if (buffer) resolve(new Uint8Array(buffer));
      else reject(new Error('Unable to read media data'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read media data'));
    reader.readAsArrayBuffer(file.slice(offset, offset + chunkSize));
  });

/**
 * The WASM instance keeps internal state, so analyses must not overlap.
 * Every call is chained behind the previous one.
 */
let analysisChain: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = analysisChain.then(task, task);
  analysisChain = run.catch(() => undefined);
  return run;
}

/* ------------------------------------------------------------------ */
/* 分析 */
/* ------------------------------------------------------------------ */

const KIND_ORDER: TrackKind[] = ['Video', 'Audio', 'Text', 'Image', 'Menu', 'Other'];

const asKind = (value: unknown): TrackKind => {
  const type = String(value ?? '');
  if (type === 'General' || type === 'Video' || type === 'Audio') return type;
  if (type === 'Text' || type === 'Image' || type === 'Menu') return type;
  return 'Other';
};

export function isMediaFile(file: File): boolean {
  if (file.type.startsWith('video/') || file.type.startsWith('audio/')) return true;
  return /(\.(mkv|mk3d|mp4|m4v|m4b|m4r|mov|avi|flv|webm|wmv|mpg|mpeg|m2v|ts|m2ts|m2t|mts|3gp|3g2|ogv|rmvb|vob|mp3|mp2|mpa|flac|wav|m4a|aac|opus|ogg|oga|weba|wma|ape|wv|aiff|aif|amr|ac3|dts|dtshd|mka|spx|tta|tak|caf|dsf|dff))$/i.test(
    file.name
  );
}

export function guessKind(file: File): 'video' | 'audio' | 'other' {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (/\.(mp3|mp2|mpa|flac|wav|m4a|m4b|m4r|aac|opus|ogg|oga|weba|wma|ape|wv|aiff|aif|amr|ac3|dts|dtshd|mka|spx|tta|tak|caf|dsf|dff)$/i.test(file.name)) return 'audio';
  if (/\.(mkv|mk3d|mp4|m4v|mov|avi|flv|webm|wmv|mpg|mpeg|m2v|ts|m2ts|m2t|mts|3gp|3g2|ogv|rmvb|vob)$/i.test(file.name)) return 'video';
  return 'other';
}

/** 用于避免重复解析同一文件的标识 */
export const fileKey = (file: File): string => `${file.name}|${file.size}|${file.lastModified}`;

export function analyzeMedia(file: File): Promise<MediaReport> {
  return serialize(async () => {
    const mediainfo = await getInstance('object');
    const result = await mediainfo.analyzeData(() => file.size, readChunk(file));

    const medias = result?.media;
    const list = medias ? (Array.isArray(medias.track) ? medias.track : medias.track ? [medias.track] : []) : [];
    if (!list.length) throw new MediaInfoError('empty', 'No media information found in this file');

    const counters: Partial<Record<TrackKind, number>> = {};
    const tracks: RawTrack[] = [];
    let general: RawTrack = { kind: 'General', index: 0, data: {}, id: 'General' };

    list.forEach((entry: Record<string, unknown>) => {
      const kind = asKind(entry['@type']);
      const index = counters[kind] ?? 0;
      counters[kind] = index + 1;
      const track: RawTrack = {
        kind,
        index,
        data: entry,
        id: `${kind}-${index}`
      };
      if (kind === 'General') general = track;
      else tracks.push(track);
    });

    // 保持稳定的轨道顺序（视频、音频、字幕……）
    tracks.sort((a, b) => {
      const diff = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
      return diff !== 0 ? diff : a.index - b.index;
    });

    return { general, tracks, counts: counters, raw: result };
  });
}

export function analyzeMediaText(file: File): Promise<string> {
  return serialize(async () => {
    const mediainfo = await getInstance('text');
    const text = await mediainfo.analyzeData(() => file.size, readChunk(file));
    return typeof text === 'string' ? text : String(text ?? '');
  });
}

/* ------------------------------------------------------------------ */
/* 字段提取 */
/* ------------------------------------------------------------------ */

const SKIP_KEYS = new Set([
  '@type',
  '@typeorder',
  '@ref',
  'extra',
  'StreamKind',
  'StreamKind/String',
  'StreamKindID',
  'StreamKindPos',
  'StreamCount'
]);

/** 优先展示顺序，其余按字母序追加 */
const FIELD_ORDER: Record<TrackKind, string[]> = {
  General: [
    'Format',
    'Format/Info',
    'Format_Version',
    'Format_Profile',
    'FileSize',
    'Duration',
    'OverallBitRate',
    'OverallBitRate_Mode',
    'FrameRate',
    'FrameCount',
    'StreamSize',
    'HeaderSize',
    'DataSize',
    'FooterSize',
    'IsStreamable',
    'FileExtension',
    'Encoded_Date',
    'Encoded_Application',
    'Encoded_Library',
    'Writing_Application',
    'UniqueID',
    'Title',
    'Album',
    'Performer',
    'Genre',
    'Comment',
    'VideoCount',
    'AudioCount',
    'TextCount',
    'ImageCount',
    'MenuCount',
    'OtherCount'
  ],
  Video: [
    'ID',
    'Format',
    'Format/Info',
    'Format_Profile',
    'Format_Level',
    'Format_Settings_CABAC',
    'Format_Settings_RefFrames',
    'Format_Settings_GOP',
    'CodecID',
    'Duration',
    'BitRate',
    'BitRate_Mode',
    'BitRate_Maximum',
    'Width',
    'Height',
    'DisplayAspectRatio',
    'PixelAspectRatio',
    'FrameRate_Mode',
    'FrameRate',
    'FrameRate_Num',
    'FrameRate_Den',
    'FrameCount',
    'ColorSpace',
    'ChromaSubsampling',
    'BitDepth',
    'ScanType',
    'Bits-(Pixel*Frame)',
    'colour_description_present',
    'colour_range',
    'ColorPrimaries',
    'TransferCharacteristics',
    'MatrixCoefficients',
    'StreamSize',
    'Language',
    'Title',
    'Default',
    'Forced',
    'Encoded_Library'
  ],
  Audio: [
    'ID',
    'Format',
    'Format/Info',
    'Format_Version',
    'Format_Profile',
    'Format_Settings',
    'CodecID',
    'Duration',
    'BitRate_Mode',
    'BitRate',
    'BitRate_Maximum',
    'Channels',
    'ChannelPositions',
    'ChannelLayout',
    'SamplingRate',
    'SamplingCount',
    'SamplesPerFrame',
    'BitDepth',
    'Compression_Mode',
    'StreamSize',
    'Language',
    'Title',
    'Default',
    'Forced',
    'Encoded_Library'
  ],
  Text: ['ID', 'Format', 'Format/Info', 'CodecID', 'Duration', 'BitRate', 'StreamSize', 'Language', 'Title', 'Default', 'Forced'],
  Image: ['ID', 'Format', 'Format/Info', 'Width', 'Height', 'BitDepth', 'ColorSpace', 'Compression_Mode', 'StreamSize', 'Title', 'Language'],
  Menu: ['ID', 'Format', 'Duration', 'Chapters_Pos_Begin', 'Chapters_Pos_End', 'List', 'Title', 'Language'],
  Other: []
};

export function extractFields(track: RawTrack, dict: ValueDict): MediaField[] {
  const fields: MediaField[] = [];

  const push = (key: string, value: unknown) => {
    const raw = stringifyRaw(value);
    if (raw === '') return;
    const displayKey = chapterKeyToTime(key) ?? key;
    const formatted = formatFieldValue(key, value, dict);
    fields.push({ key: displayKey, raw, display: formatted?.display ?? raw, hint: formatted?.hint });
  };

  Object.entries(track.data).forEach(([key, value]) => {
    if (key === 'extra' && value && typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([innerKey, innerValue]) => push(`extra.${innerKey}`, innerValue));
      return;
    }
    if (SKIP_KEYS.has(key) || key.endsWith('/String')) return;
    push(key, value);
  });

  const order = FIELD_ORDER[track.kind] ?? [];
  const rank = new Map(order.map((key, position) => [key, position]));
  return fields.sort((a, b) => {
    const extraA = a.key.startsWith('extra.');
    const extraB = b.key.startsWith('extra.');
    if (extraA !== extraB) return extraA ? 1 : -1;
    const ra = rank.get(a.key) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b.key) ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return a.key.localeCompare(b.key);
  });
}

/** MediaInfo 章节键转换：extra._00_01_02_500 → 00:01:02.500 */
const chapterKeyToTime = (key: string): string | null => {
  const match = /^(?:extra\.)?_?(\d{2})_(\d{2})_(\d{2})_(\d{3})$/.exec(key);
  if (!match) return null;
  return `${match[1]}:${match[2]}:${match[3]}.${match[4]}`;
};

export interface ChapterEntry {
  time: string;
  seconds: number;
  title: string;
}

/** MediaInfo 以 Menu 轨道和时间为键暴露章节 */
export function getChapters(track: RawTrack): ChapterEntry[] {
  const extra = track.data.extra;
  if (!extra || typeof extra !== 'object') return [];

  const chapters: ChapterEntry[] = [];
  Object.entries(extra as Record<string, unknown>).forEach(([key, value]) => {
    const time = chapterKeyToTime(key) ?? (/^\d{2}:\d{2}:\d{2}\.\d{3}$/.test(key) ? key : null);
    if (!time) return;
    const [clock, ms] = time.split('.');
    const [h, m, s] = clock.split(':').map(Number);
    chapters.push({
      time,
      seconds: h * 3600 + m * 60 + s + Number(ms) / 1000,
      title: stringifyRaw(value)
    });
  });

  return chapters.sort((a, b) => a.seconds - b.seconds);
}

export const fieldsToText = (fields: MediaField[]): string =>
  fields.map(field => `${field.key}: ${field.display}${field.hint ? ` (${field.hint})` : ''}`).join('\n');

function stringifyRaw(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(item => stringifyRaw(item)).filter(Boolean).join(' / ');
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[object]';
    }
  }
  return String(value);
}

export function getGeneralString(report: MediaReport, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = report.general.data[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value);
  }
  return null;
}

export function getTrackNumber(track: RawTrack, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = toNumber(track.data[key]);
    if (value !== null) return value;
  }
  return null;
}

/** Version 2 → 2，用于 v… 徽标 */
export function normalizeVersion(version: string | null): string | null {
  if (!version) return null;
  const cleaned = version.replace(/^version\s*/i, '').trim();
  return cleaned || null;
}

/**
 * Bitrate of a single stream. MediaInfo omits it for some containers (e.g. MKV),
 * so fall back to stream size / duration and finally bits-per-pixel-frame.
 */
export function resolveBitrate(track: RawTrack): { value: number; derived: boolean } | null {
  const direct = getTrackNumber(track, 'BitRate', 'BitRate_Nominal', 'BitRate_Encoded');
  if (direct && direct > 0) return { value: direct, derived: false };

  const streamSize = getTrackNumber(track, 'StreamSize', 'StreamSize_Encoded');
  const duration = getTrackNumber(track, 'Duration');
  if (streamSize && duration && duration > 0) return { value: (streamSize * 8) / duration, derived: true };

  const bitsPerPixelFrame = getTrackNumber(track, 'BitsPixel_Frame', 'Bits-(Pixel*Frame)');
  const width = getTrackNumber(track, 'Width');
  const height = getTrackNumber(track, 'Height');
  const frameRate = getTrackNumber(track, 'FrameRate', 'FrameRate_Original');
  if (bitsPerPixelFrame && width && height && frameRate) {
    return { value: bitsPerPixelFrame * width * height * frameRate, derived: true };
  }

  return null;
}

export interface DerivedStats {
  duration: number | null;
  fileSize: number;
  overallBitRate: number | null;
  overallBitRateDerived: boolean;
}

/** 容器级数值，缺失时使用合理回退值 */
export function deriveStats(report: MediaReport, fallbackSize: number): DerivedStats {
  let duration = getTrackNumber(report.general, 'Duration');
  if (duration === null) {
    const durations = report.tracks
      .map(track => getTrackNumber(track, 'Duration', 'Source_Duration'))
      .filter((value): value is number => value !== null && value > 0);
    if (durations.length) duration = Math.max(...durations);
  }

  const fileSize = getTrackNumber(report.general, 'FileSize') ?? fallbackSize;
  const direct = getTrackNumber(report.general, 'OverallBitRate', 'OverallBitRate_Nominal');
  if (direct && direct > 0) {
    return { duration, fileSize, overallBitRate: direct, overallBitRateDerived: false };
  }

  const derived = duration && duration > 0 && fileSize ? (fileSize * 8) / duration : null;
  return { duration, fileSize, overallBitRate: derived, overallBitRateDerived: derived !== null };
}

/** 常用 ISO 639-2/B 转 ISO 639-1，便于 Intl.DisplayNames 解析 */
const LANGUAGE_ALIASES: Record<string, string> = {
  chi: 'zh',
  zho: 'zh',
  eng: 'en',
  jpn: 'ja',
  kor: 'ko',
  fre: 'fr',
  fra: 'fr',
  ger: 'de',
  deu: 'de',
  spa: 'es',
  ita: 'it',
  rus: 'ru',
  por: 'pt',
  ara: 'ar',
  hin: 'hi',
  tha: 'th',
  vie: 'vi',
  ind: 'id',
  tur: 'tr',
  pol: 'pl',
  swe: 'sv',
  nor: 'no',
  nob: 'nb',
  dan: 'da',
  fin: 'fi',
  dut: 'nl',
  nld: 'nl',
  cze: 'cs',
  ces: 'cs',
  gre: 'el',
  ell: 'el',
  heb: 'he',
  ukr: 'uk',
  hun: 'hu',
  rum: 'ro',
  ron: 'ro',
  slo: 'sk',
  slk: 'sk',
  may: 'ms',
  msa: 'ms',
  per: 'fa',
  fas: 'fa',
  tam: 'ta',
  tel: 'te',
  ben: 'bn',
  cat: 'ca',
  srp: 'sr',
  hrv: 'hr',
  bul: 'bg',
  lit: 'lt',
  lav: 'lv',
  est: 'et',
  slv: 'sl',
  isl: 'is',
  fil: 'tl'
};

export function normalizeLanguageCode(code: string): string {
  const clean = code.trim().toLowerCase();
  if (!clean) return code;
  return LANGUAGE_ALIASES[clean] ?? clean;
}

/* ------------------------------------------------------------------ */
/* 值格式化 */
/* ------------------------------------------------------------------ */

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
  return null;
};

export const formatBytes = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '—';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unit]}`;
};

export const formatBitrate = (bps: number | null | undefined): string => {
  if (bps === null || bps === undefined || !Number.isFinite(bps) || bps <= 0) return '—';
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(bps >= 10_000_000 ? 1 : 2)} Mb/s`;
  return `${Math.round(bps / 1000)} kb/s`;
};

export const formatClock = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '—';
  const totalMs = Math.round(seconds * 1000);
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  const pad = (value: number, length = 2) => String(value).padStart(length, '0');
  const base = hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
  return ms > 0 ? `${base}.${pad(ms, 3)}` : base;
};

export const formatSamplingRate = (hz: number | null | undefined): string => {
  if (hz === null || hz === undefined || !Number.isFinite(hz) || hz <= 0) return '—';
  if (hz >= 1000) return `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)} kHz`;
  return `${hz} Hz`;
};

const ASPECTS: [string, number][] = [
  ['1:1', 1],
  ['4:3', 4 / 3],
  ['3:2', 3 / 2],
  ['16:9', 16 / 9],
  ['16:10', 16 / 10],
  ['1.85:1', 1.85],
  ['2.35:1', 2.35],
  ['2.39:1', 2.39]
];

const commonAspect = (ratio: number): string | null => {
  for (const [label, value] of ASPECTS) {
    if (Math.abs(value - ratio) < 0.02) return label;
  }
  return null;
};

export function formatFieldValue(key: string, value: unknown, dict: ValueDict): { display: string; hint?: string } | null {
  const text = stringifyRaw(value).trim();
  if (!text) return null;

  // 时长（秒）
  if (/^(Source_)?Duration/.test(key)) {
    const seconds = toNumber(value);
    if (seconds !== null) return { display: `${seconds.toFixed(3)} s`, hint: formatClock(seconds) };
  }

  // 大小（字节）
  if (/(^|_)(FileSize|StreamSize|HeaderSize|DataSize|FooterSize)(_|$)/.test(key) || /^Source_StreamSize/.test(key)) {
    const bytes = toNumber(value);
    if (bytes !== null) return { display: formatBytes(bytes), hint: `${dict.number(bytes)} B` };
  }

  if (key === 'BitRate_Mode' || key === 'OverallBitRate_Mode') {
    if (/^vbr$/i.test(text)) return { display: `${dict.variable} (VBR)` };
    if (/^cbr$/i.test(text)) return { display: `${dict.constant} (CBR)` };
  }

  if (/BitRate/.test(key)) {
    const bps = toNumber(value);
    if (bps !== null) return { display: formatBitrate(bps), hint: `${dict.number(bps)} b/s` };
  }

  if (key === 'FrameRate_Mode') {
    if (/^cfr$/i.test(text)) return { display: `${dict.constant} (CFR)` };
    if (/^vfr$/i.test(text)) return { display: `${dict.variable} (VFR)` };
  }

  if (/^FrameRate(_|$)/.test(key) && key !== 'FrameRate_Mode' && !key.endsWith('_Num') && !key.endsWith('_Den')) {
    const fps = toNumber(value);
    if (fps !== null) return { display: `${fps.toFixed(3)} FPS` };
  }

  if (/^(Stored_|Sampled_)?(Width|Height)(_|$)/.test(key) || /^(Width|Height)_/.test(key)) {
    const px = toNumber(value);
    if (px !== null) return { display: `${px} px` };
  }

  if (key === 'SamplingRate' || key === 'Source_SamplingRate' || key === 'SamplingRate_Original') {
    const hz = toNumber(value);
    if (hz !== null) return { display: formatSamplingRate(hz) };
  }

  if (key === 'BitDepth' || key === 'BitDepth_Detected' || key === 'BitDepth_Stored') {
    const bits = toNumber(value);
    if (bits !== null) return { display: `${bits} bit` };
  }

  if (key === 'Channels' || key === 'Channels_Original') {
    const channels = toNumber(value);
    if (channels !== null) return { display: `${channels} ch` };
  }

  if (key === 'StreamSize_Proportion') {
    const proportion = toNumber(value);
    if (proportion !== null) return { display: `${(proportion * 100).toFixed(1)} %` };
  }

  if (key.startsWith('DisplayAspectRatio') || key.startsWith('PixelAspectRatio')) {
    const ratio = toNumber(value);
    if (ratio !== null) {
      const hint = commonAspect(ratio);
      return { display: ratio.toFixed(3), hint: hint ? `${hint}:1` : undefined };
    }
  }

  if (key === 'Compression_Ratio' || key === 'Bits-(Pixel*Frame)' || key === 'BitsPixel_Frame') {
    const ratio = toNumber(value);
    if (ratio !== null) return { display: ratio.toFixed(3) };
  }

  if (key === 'Compression_Mode') {
    if (/^lossless$/i.test(text)) return { display: dict.lossless };
    if (/^lossy$/i.test(text)) return { display: dict.lossy };
  }

  if (key === 'ScanType') {
    if (/^progressive$/i.test(text)) return { display: dict.progressive };
    if (/^interlaced$/i.test(text)) return { display: dict.interlaced };
  }

  if (key === 'colour_range') {
    if (/^limited$/i.test(text)) return { display: dict.limited };
    if (/^full$/i.test(text)) return { display: dict.full };
  }

  if (key === 'Language' || key === 'Language_String') {
    const parts = text.split(/\s*\/\s*/).filter(Boolean);
    if (parts.length) {
      return { display: parts.map(code => `${code} · ${dict.languageName(code)}`).join(' / ') };
    }
  }

  if (key === 'Delay' || key === 'Video_Delay' || key.startsWith('Delay_')) {
    const ms = toNumber(value);
    if (ms !== null && !key.endsWith('_Source')) return { display: `${dict.number(ms)} ms` };
  }

  if (['FrameCount', 'SamplingCount', 'Count', 'ElementCount', 'SamplesPerFrame'].includes(key)) {
    const count = toNumber(value);
    if (count !== null) return { display: dict.number(count) };
  }

  if (text === 'Yes') return { display: dict.yes };
  if (text === 'No') return { display: dict.no };

  return null;
}

/* ------------------------------------------------------------------ */
/* 轨道摘要（供概览卡片使用） */
/* ------------------------------------------------------------------ */

export interface TrackSummary {
  headline: string;
  chips: string[];
}

const formatLabel = (track: RawTrack): string => {
  const format = String(track.data.Format ?? '').trim();
  const profile = String(track.data['Format_Profile'] ?? '').trim();
  const level = String(track.data['Format_Level'] ?? '').trim();
  let label = format || String(track.data.CodecID ?? '').trim() || '—';
  if (profile) label += profile.includes('@') || !level ? ` ${profile}` : ` ${profile}@L${level}`;
  else if (level) label += ` @L${level}`;
  return label;
};

const detectedHdr = (track: RawTrack): string | null => {
  const transfer = String(track.data.TransferCharacteristics ?? track.data.transfer_characteristics ?? '').toUpperCase();
  if (!transfer) return null;
  if (transfer.includes('PQ') || transfer.includes('2084')) return 'HDR10';
  if (transfer.includes('HLG') || transfer.includes('2086')) return 'HLG';
  return null;
};

export function summarizeTrack(track: RawTrack, dict: ValueDict): TrackSummary {
  const chips: string[] = [];
  const headline = track.kind === 'Menu' ? '' : formatLabel(track);

  const pushBitrate = () => {
    const resolved = resolveBitrate(track);
    if (resolved) chips.push(`${resolved.derived ? '≈' : ''}${formatBitrate(resolved.value)}`);
  };

  if (track.kind === 'Video') {
    const width = getTrackNumber(track, 'Width');
    const height = getTrackNumber(track, 'Height');
    if (width && height) chips.push(`${width}×${height}`);

    const fps = getTrackNumber(track, 'FrameRate', 'FrameRate_Original');
    if (fps) chips.push(`${fps.toFixed(3)} FPS`);

    pushBitrate();

    const bitDepth = getTrackNumber(track, 'BitDepth');
    if (bitDepth) chips.push(`${bitDepth} bit`);

    const chroma = String(track.data.ChromaSubsampling ?? '').trim();
    if (chroma) chips.push(chroma);

    if (/interlaced/i.test(String(track.data.ScanType ?? ''))) chips.push(dict.interlaced);
    const hdr = detectedHdr(track);
    if (hdr) chips.push(hdr);
  }

  if (track.kind === 'Audio') {
    const channels = getTrackNumber(track, 'Channels');
    if (channels) chips.push(`${channels} ch`);

    const samplingRate = getTrackNumber(track, 'SamplingRate');
    if (samplingRate) chips.push(formatSamplingRate(samplingRate));

    pushBitrate();

    const bitDepth = getTrackNumber(track, 'BitDepth');
    if (bitDepth) chips.push(`${bitDepth} bit`);

    if (/^lossless$/i.test(String(track.data.Compression_Mode ?? ''))) chips.push(dict.lossless);
  }

  if (track.kind === 'Text') {
    pushBitrate();
  }

  if (track.kind === 'Image') {
    const width = getTrackNumber(track, 'Width');
    const height = getTrackNumber(track, 'Height');
    if (width && height) chips.push(`${width}×${height}`);
    const bitDepth = getTrackNumber(track, 'BitDepth');
    if (bitDepth) chips.push(`${bitDepth} bit`);
  }

  if (track.kind === 'Menu') {
    return { headline, chips };
  }

  const language = String(track.data.Language ?? '').trim();
  if (language) {
    chips.push(
      language
        .split(/\s*\/\s*/)
        .filter(Boolean)
        .map(code => dict.languageName(code))
        .join(' / ')
    );
  }

  return { headline, chips };
}

export const isDefaultTrack = (track: RawTrack): boolean => /^yes$/i.test(String(track.data.Default ?? ''));
export const isForcedTrack = (track: RawTrack): boolean => /^yes$/i.test(String(track.data.Forced ?? ''));
