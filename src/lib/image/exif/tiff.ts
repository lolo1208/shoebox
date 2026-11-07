/**
 * 轻量、无依赖的 EXIF / 元数据读取与清除工具。
 *
 * 支持容器：JPEG（APP1 Exif/XMP、APP2 ICC、APP13 IPTC、COM、MPO）、
 * PNG（eXIf、tEXt、zTXt、iTXt、tIME 、iCCP）、WEBP（EXIF、XMP、ICCP、VP8X）、
 * GIF（注释扩展、XMP 应用扩展）、HEIC/AVIF（ISO BMFF 的 Exif 与 XMP）。
 *
 * 不解码像素：JPEG/PNG/WEBP/GIF 无损重建，HEIC/AVIF 原位清空元数据。
 * “仅位置”模式只清除 EXIF GPS 与 XMP/IPTC，其余元数据保留。
 */


export type TagGroup = 'camera' | 'exposure' | 'time' | 'gps' | 'image' | 'other';

export interface ExifEntry {
  tag: number;
  name: string;
  group: TagGroup;
  value: string;
}

export interface GpsInfo {
  latitude: number;
  longitude: number;
  altitude?: number;
  timestamp?: string;
}

export type RiskKey =
  | 'gps'
  | 'thumbnail'
  | 'serial'
  | 'owner'
  | 'software'
  | 'makernote'
  | 'xmp'
  | 'comment'
  | 'iptc';

export interface WipeRange {
  offset: number;
  length: number;
  label: string;
}

export interface MetaReport {
  format: string;
  mime: string;
  fileSize: number;
  width?: number;
  height?: number;
  orientation?: number;
  tags: ExifEntry[];
  xmp: string[];
  comments: string[];
  iccSize?: number;
  iptc: boolean;
  hasThumbnail: boolean;
  gps?: GpsInfo;
  metadataBytes: number;
  risks: RiskKey[];
  supported: boolean;
  /** HEIC/AVIF：原位清空元数据，不重建容器 */
  inPlaceOnly: boolean;
  /** 完整清除时移除的整项区间 */
  wipes: WipeRange[];
  /** 仅清除位置时移除的 GPS + XMP/IPTC 区间 */
  locationWipes: WipeRange[];
  warnings: string[];
}

export interface StripOptions {
  keepIcc: boolean;
  keepOrientation: boolean;
  scope?: 'all' | 'location';
}

export interface StripResult {
  blob: Blob;
  name: string;
  removed: string[];
  savedBytes: number;
  reencoded: boolean;
  inPlace: boolean;
}

/* ------------------------------------------------------------------ */
/* 标签字典 */
/* ------------------------------------------------------------------ */

interface TagDef {
  name: string;
  group: TagGroup;
}

const def = (name: string, group: TagGroup = 'other'): TagDef => ({ name, group });

const IFD_TAGS: Record<number, TagDef> = {
  0x00fe: def('NewSubfileType', 'image'),
  0x0100: def('ImageWidth', 'image'),
  0x0101: def('ImageLength', 'image'),
  0x0102: def('BitsPerSample', 'image'),
  0x0103: def('Compression', 'image'),
  0x0106: def('PhotometricInterpretation', 'image'),
  0x010e: def('ImageDescription'),
  0x010f: def('Make', 'camera'),
  0x0110: def('Model', 'camera'),
  0x0112: def('Orientation', 'image'),
  0x011a: def('XResolution', 'image'),
  0x011b: def('YResolution', 'image'),
  0x011c: def('PlanarConfiguration', 'image'),
  0x0128: def('ResolutionUnit', 'image'),
  0x012d: def('TransferFunction', 'image'),
  0x0131: def('Software'),
  0x0132: def('DateTime', 'time'),
  0x013b: def('Artist'),
  0x013e: def('WhitePoint', 'image'),
  0x013f: def('PrimaryChromaticities', 'image'),
  0x0201: def('JPEGInterchangeFormat'),
  0x0202: def('JPEGInterchangeFormatLength'),
  0x0211: def('YCbCrCoefficients', 'image'),
  0x0212: def('YCbCrSubSampling', 'image'),
  0x0213: def('YCbCrPositioning', 'image'),
  0x0214: def('ReferenceBlackWhite', 'image'),
  0x8298: def('Copyright'),
  0x83bb: def('IPTC-NAA'),
  0x8649: def('PhotoshopSettings'),
  0x8773: def('ICCProfile', 'image'),
  0x9c9b: def('XPTitle'),
  0x9c9c: def('XPComment'),
  0x9c9d: def('XPAuthor'),
  0x9c9e: def('XPKeywords'),
  0x9c9f: def('XPSubject'),
  0xa430: def('CameraOwnerName'),
  0xa431: def('SerialNumber'),
  0xa432: def('LensSpecification', 'camera'),
  0xa433: def('LensMake', 'camera'),
  0xa434: def('LensModel', 'camera'),
  0xa435: def('LensSerialNumber')
};

const EXIF_TAGS: Record<number, TagDef> = {
  0x829a: def('ExposureTime', 'exposure'),
  0x829d: def('FNumber', 'exposure'),
  0x8822: def('ExposureProgram', 'exposure'),
  0x8827: def('PhotographicSensitivity', 'exposure'),
  0x8830: def('SensitivityType', 'exposure'),
  0x8831: def('StandardOutputSensitivity', 'exposure'),
  0x8832: def('RecommendedExposureIndex', 'exposure'),
  0x8833: def('ISOSpeed', 'exposure'),
  0x8834: def('ISOSpeedLatitudeyyy', 'exposure'),
  0x8835: def('ISOSpeedLatitudezzz', 'exposure'),
  0x9000: def('ExifVersion'),
  0x9003: def('DateTimeOriginal', 'time'),
  0x9004: def('DateTimeDigitized', 'time'),
  0x9010: def('OffsetTime', 'time'),
  0x9011: def('OffsetTimeOriginal', 'time'),
  0x9012: def('OffsetTimeDigitized', 'time'),
  0x9101: def('ComponentsConfiguration'),
  0x9102: def('CompressedBitsPerPixel', 'image'),
  0x9201: def('ShutterSpeedValue', 'exposure'),
  0x9202: def('ApertureValue', 'exposure'),
  0x9203: def('BrightnessValue', 'exposure'),
  0x9204: def('ExposureBiasValue', 'exposure'),
  0x9205: def('MaxApertureValue', 'exposure'),
  0x9206: def('SubjectDistance', 'exposure'),
  0x9207: def('MeteringMode', 'exposure'),
  0x9208: def('LightSource', 'exposure'),
  0x9209: def('Flash', 'exposure'),
  0x920a: def('FocalLength', 'exposure'),
  0x9214: def('SubjectArea'),
  0x927c: def('MakerNote'),
  0x9286: def('UserComment'),
  0x9290: def('SubSecTime', 'time'),
  0x9291: def('SubSecTimeOriginal', 'time'),
  0x9292: def('SubSecTimeDigitized', 'time'),
  0x9400: def('Temperature'),
  0x9401: def('Humidity'),
  0x9402: def('Pressure'),
  0x9403: def('WaterDepth'),
  0x9404: def('Acceleration'),
  0x9405: def('CameraElevationAngle'),
  0xa000: def('FlashpixVersion'),
  0xa001: def('ColorSpace', 'image'),
  0xa002: def('PixelXDimension', 'image'),
  0xa003: def('PixelYDimension', 'image'),
  0xa004: def('RelatedSoundFile'),
  0xa20b: def('FlashEnergy', 'exposure'),
  0xa20e: def('FocalPlaneXResolution', 'exposure'),
  0xa20f: def('FocalPlaneYResolution', 'exposure'),
  0xa210: def('FocalPlaneResolutionUnit', 'exposure'),
  0xa214: def('SubjectLocation'),
  0xa215: def('ExposureIndex', 'exposure'),
  0xa217: def('SensingMethod', 'exposure'),
  0xa300: def('FileSource'),
  0xa301: def('SceneType'),
  0xa302: def('CFAPattern'),
  0xa401: def('CustomRendered', 'exposure'),
  0xa402: def('ExposureMode', 'exposure'),
  0xa403: def('WhiteBalance', 'exposure'),
  0xa404: def('DigitalZoomRatio', 'exposure'),
  0xa405: def('FocalLengthIn35mmFilm', 'exposure'),
  0xa406: def('SceneCaptureType', 'exposure'),
  0xa407: def('GainControl', 'exposure'),
  0xa408: def('Contrast', 'exposure'),
  0xa409: def('Saturation', 'exposure'),
  0xa40a: def('Sharpness', 'exposure'),
  0xa40b: def('DeviceSettingDescription'),
  0xa40c: def('SubjectDistanceRange', 'exposure'),
  0xa420: def('ImageUniqueID'),
  0xa430: def('CameraOwnerName'),
  0xa431: def('BodySerialNumber'),
  0xa432: def('LensSpecification', 'camera'),
  0xa433: def('LensMake', 'camera'),
  0xa434: def('LensModel', 'camera'),
  0xa435: def('LensSerialNumber'),
  0xa460: def('CompositeImage'),
  0xa461: def('SourceImageNumberOfCompositeImage'),
  0xa462: def('SourceExposureTimesOfCompositeImage'),
  0xa500: def('Gamma', 'image')
};

const GPS_TAGS: Record<number, TagDef> = {
  0x0000: def('GPSVersionID', 'gps'),
  0x0001: def('GPSLatitudeRef', 'gps'),
  0x0002: def('GPSLatitude', 'gps'),
  0x0003: def('GPSLongitudeRef', 'gps'),
  0x0004: def('GPSLongitude', 'gps'),
  0x0005: def('GPSAltitudeRef', 'gps'),
  0x0006: def('GPSAltitude', 'gps'),
  0x0007: def('GPSTimeStamp', 'gps'),
  0x0008: def('GPSSatellites', 'gps'),
  0x0009: def('GPSStatus', 'gps'),
  0x000a: def('GPSMeasureMode', 'gps'),
  0x000b: def('GPSDOP', 'gps'),
  0x000c: def('GPSSpeedRef', 'gps'),
  0x000d: def('GPSSpeed', 'gps'),
  0x000e: def('GPSTrackRef', 'gps'),
  0x000f: def('GPSTrack', 'gps'),
  0x0010: def('GPSImgDirectionRef', 'gps'),
  0x0011: def('GPSImgDirection', 'gps'),
  0x0012: def('GPSMapDatum', 'gps'),
  0x0013: def('GPSDestLatitudeRef', 'gps'),
  0x0014: def('GPSDestLatitude', 'gps'),
  0x0015: def('GPSDestLongitudeRef', 'gps'),
  0x0016: def('GPSDestLongitude', 'gps'),
  0x0017: def('GPSDestBearingRef', 'gps'),
  0x0018: def('GPSDestBearing', 'gps'),
  0x0019: def('GPSDestDistanceRef', 'gps'),
  0x001a: def('GPSDestDistance', 'gps'),
  0x001b: def('GPSProcessingMethod', 'gps'),
  0x001c: def('GPSAreaInformation', 'gps'),
  0x001d: def('GPSDateStamp', 'gps'),
  0x001e: def('GPSDifferential', 'gps'),
  0x001f: def('GPSHPositioningError', 'gps')
};

const INTEROP_TAGS: Record<number, TagDef> = {
  0x0001: def('InteroperabilityIndex'),
  0x0002: def('InteroperabilityVersion')
};

export type DictKind = 'ifd' | 'exif' | 'gps' | 'interop';

const DICTS: Record<DictKind, Record<number, TagDef>> = {
  ifd: IFD_TAGS,
  exif: EXIF_TAGS,
  gps: GPS_TAGS,
  interop: INTEROP_TAGS
};

const POINTER_TAGS = new Set([0x8769, 0x8825, 0xa005]);

/* ------------------------------------------------------------------ */
/* 字节读取工具 */
/* ------------------------------------------------------------------ */

export const TYPE_SIZE: Record<number, number> = {
  1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 13: 4
};

export const readU16BE = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
export const readU32BE = (b: Uint8Array, o: number) =>
  ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
export const readU16LE = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
export const readU32LE = (b: Uint8Array, o: number) =>
  (b[o] + (b[o + 1] << 8) + (b[o + 2] << 16) + (b[o + 3] << 24)) >>> 0;
export const readU24LE = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);

export const ascii = (b: Uint8Array, o: number, len: number) => {
  let s = '';
  for (let i = 0; i < len && o + i < b.length; i++) s += String.fromCharCode(b[o + i]);
  return s;
};

export const startsWith = (b: Uint8Array, o: number, s: string) => {
  if (o + s.length > b.length) return false;
  for (let i = 0; i < s.length; i++) if (b[o + i] !== s.charCodeAt(i)) return false;
  return true;
};

export const u8FromString = (s: string) => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
};

export const utf8 = (b: Uint8Array, o: number, len: number) => {
  try {
    return new TextDecoder('utf-8').decode(b.subarray(o, o + len));
  } catch {
    return ascii(b, o, len);
  }
};

const trimNum = (n: number): string => {
  if (!isFinite(n)) return String(n);
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 10000) / 10000);
};

/* ------------------------------------------------------------------ */
/* 值格式化 */
/* ------------------------------------------------------------------ */

export const ORIENTATION_NAMES: Record<number, string> = {
  1: 'Normal',
  2: 'Mirror horizontal',
  3: 'Rotate 180°',
  4: 'Mirror vertical',
  5: 'Mirror horizontal + rotate 270° CW',
  6: 'Rotate 90° CW',
  7: 'Mirror horizontal + rotate 90° CW',
  8: 'Rotate 270° CW'
};

const EXPOSURE_PROGRAM: Record<number, string> = {
  0: 'Not defined',
  1: 'Manual',
  2: 'Program AE',
  3: 'Aperture priority',
  4: 'Shutter priority',
  5: 'Creative program',
  6: 'Action program',
  7: 'Portrait mode',
  8: 'Landscape mode'
};

const METERING_MODE: Record<number, string> = {
  0: 'Unknown',
  1: 'Average',
  2: 'Center-weighted average',
  3: 'Spot',
  4: 'Multi-spot',
  5: 'Pattern',
  6: 'Partial',
  255: 'Other'
};

const LIGHT_SOURCE: Record<number, string> = {
  0: 'Unknown',
  1: 'Daylight',
  2: 'Fluorescent',
  3: 'Tungsten',
  4: 'Flash',
  9: 'Fine weather',
  10: 'Cloudy',
  11: 'Shade',
  12: 'Daylight fluorescent',
  13: 'Day white fluorescent',
  14: 'Cool white fluorescent',
  15: 'White fluorescent',
  17: 'Standard light A',
  18: 'Standard light B',
  19: 'Standard light C',
  20: 'D55',
  21: 'D65',
  22: 'D75',
  23: 'D50',
  24: 'ISO studio tungsten',
  255: 'Other'
};

const SENSING_METHOD: Record<number, string> = {
  1: 'Not defined',
  2: 'One-chip color area',
  3: 'Two-chip color area',
  4: 'Three-chip color area',
  5: 'Color sequential area',
  7: 'Trilinear',
  8: 'Color sequential linear'
};

export const normalizeExifDate = (v: string): string => {
  const m = v.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`;
  const d = v.match(/^(\d{4}):(\d{2}):(\d{2})$/);
  if (d) return `${d[1]}-${d[2]}-${d[3]}`;
  return v;
};

const decodeUserComment = (b: Uint8Array, o: number, len: number, little = true): string => {
  const head = ascii(b, o, Math.min(8, len));
  const body = b.subarray(o + 8, o + len);
  if (head.startsWith('ASCII')) {
    return new TextDecoder('utf-8').decode(body).replace(/\0+$/, '').trim();
  }
  if (head.startsWith('UNICODE')) {
    const bomLe = body[0] === 0xff && body[1] === 0xfe;
    const bomBe = body[0] === 0xfe && body[1] === 0xff;
    const useLittle = bomLe || (!bomBe && little);
    const start = bomLe || bomBe ? 2 : 0;
    let s = '';
    for (let i = start; i + 1 < body.length; i += 2) {
      const code = useLittle ? body[i] | (body[i + 1] << 8) : (body[i] << 8) | body[i + 1];
      if (!code) break;
      s += String.fromCharCode(code);
    }
    return s.trim();
  }
  const fallback = new TextDecoder('utf-8').decode(body).replace(/\0+/g, ' ').trim();
  return fallback;
};

const decodeUtf16 = (b: Uint8Array, o: number, len: number): string => {
  let s = '';
  for (let i = 0; i + 1 < len; i += 2) {
    const code = b[o + i] | (b[o + i + 1] << 8);
    if (!code) break;
    s += String.fromCharCode(code);
  }
  return s;
};

const flashText = (v: number): string => {
  if (v === 0) return 'No flash';
  const parts: string[] = [];
  parts.push(v & 1 ? 'Fired' : 'Did not fire');
  const ret = (v >> 1) & 3;
  if (ret === 2) parts.push('no return detected');
  if (ret === 3) parts.push('return detected');
  if (v & 0x40) parts.push('red-eye reduction');
  if (v & 0x20) parts.push('no flash function');
  return parts.join(', ');
};

const dms = (values: number[]): string => {
  const [d = 0, m = 0, s = 0] = values;
  return `${trimNum(d)}° ${trimNum(m)}' ${trimNum(s)}"`;
};

export const dmsToDecimal = (values: number[], ref?: string): number => {
  const [d = 0, m = 0, s = 0] = values;
  let dec = d + m / 60 + s / 3600;
  if (ref === 'S' || ref === 'W') dec = -dec;
  return dec;
};

export const formatGpsTime = (values: number[]): string => {
  const [h = 0, m = 0, s = 0] = values;
  const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');
  const sec = s % 1 === 0 ? pad(s) : s.toFixed(2).padStart(5, '0');
  return `${pad(h)}:${pad(m)}:${sec} UTC`;
};

export interface TiffState {
  tags: ExifEntry[];
  orientation?: number;
  hasThumbnail: boolean;
  gps: {
    lat?: number[];
    latRef?: string;
    lng?: number[];
    lngRef?: string;
    alt?: number;
    altRef?: number;
    time?: number[];
    date?: string;
  };
  hasMakerNote: boolean;
}

export const createTiffState = (): TiffState => ({ tags: [], hasThumbnail: false, gps: {}, hasMakerNote: false });

/* ------------------------------------------------------------------ */
/* TIFF / EXIF 解析 */
/* ------------------------------------------------------------------ */

interface TiffCtx {
  bytes: Uint8Array;
  base: number;
  little: boolean;
  length: number;
}

const readU16 = (ctx: TiffCtx, off: number): number =>
  ctx.little
    ? readU16LE(ctx.bytes, ctx.base + off)
    : readU16BE(ctx.bytes, ctx.base + off);

const readU32 = (ctx: TiffCtx, off: number): number =>
  ctx.little
    ? readU32LE(ctx.bytes, ctx.base + off)
    : readU32BE(ctx.bytes, ctx.base + off);

function readNumbers(ctx: TiffCtx, type: number, count: number, off: number): number[] {
  const out: number[] = [];
  const b = ctx.bytes;
  const base = ctx.base;
  for (let i = 0; i < count; i++) {
    const o = base + off;
    switch (type) {
      case 1:
      case 7:
        out.push(b[o + i]);
        break;
      case 6:
        out.push((b[o + i] << 24) >> 24);
        break;
      case 3:
        out.push(ctx.little ? readU16LE(b, o + i * 2) : readU16BE(b, o + i * 2));
        break;
      case 8:
        out.push((ctx.little ? readU16LE(b, o + i * 2) : readU16BE(b, o + i * 2)) << 16 >> 16);
        break;
      case 4:
      case 13:
        out.push(ctx.little ? readU32LE(b, o + i * 4) : readU32BE(b, o + i * 4));
        break;
      case 9:
        out.push((ctx.little ? readU32LE(b, o + i * 4) : readU32BE(b, o + i * 4)) | 0);
        break;
      case 5: {
        const n = ctx.little ? readU32LE(b, o + i * 8) : readU32BE(b, o + i * 8);
        const d = ctx.little ? readU32LE(b, o + i * 8 + 4) : readU32BE(b, o + i * 8 + 4);
        out.push(d === 0 ? 0 : n / d);
        break;
      }
      case 10: {
        const n = (ctx.little ? readU32LE(b, o + i * 8) : readU32BE(b, o + i * 8)) | 0;
        const d = (ctx.little ? readU32LE(b, o + i * 8 + 4) : readU32BE(b, o + i * 8 + 4)) | 0;
        out.push(d === 0 ? 0 : n / d);
        break;
      }
      case 11: {
        const dv = new DataView(b.buffer, b.byteOffset + o + i * 4, 4);
        out.push(dv.getFloat32(0, ctx.little));
        break;
      }
      case 12: {
        const dv = new DataView(b.buffer, b.byteOffset + o + i * 8, 8);
        out.push(dv.getFloat64(0, ctx.little));
        break;
      }
      default:
        return out;
    }
  }
  return out;
}

function valueOffset(ctx: TiffCtx, entryOff: number, type: number, count: number): { off: number; len: number } | null {
  const size = TYPE_SIZE[type];
  if (!size) return null;
  if (count > 2_000_000) return null;
  const len = size * count;
  if (len <= 4) return { off: entryOff + 8, len };
  const off = readU32(ctx, entryOff + 8);
  if (off < 0 || off + len > ctx.length) return null;
  return { off, len };
}

function formatEntry(
  kind: DictKind,
  tag: number,
  type: number,
  count: number,
  nums: number[],
  ctx: TiffCtx,
  off: number,
  len: number
): string {
  const b = ctx.bytes;
  const absolute = ctx.base + off;
  const first = nums[0] ?? 0;

  if (type === 2) {
    const end = Math.min(len, 512);
    const text = utf8(b, absolute, end).replace(/\0.*$/, '').trim();
    if (tag === 0x0132 || tag === 0x9003 || tag === 0x9004 || tag === 0x001d) {
      return normalizeExifDate(text);
    }
    return text;
  }

  if (type === 1 || type === 7) {
    if (tag === 0x9286 || tag === 0x001b) {
      const t = decodeUserComment(b, absolute, len, ctx.little);
      return t || `[${len} bytes]`;
    }
    if (tag === 0x9101 && count === 4) {
      const map: Record<number, string> = { 0: '-', 1: 'Y', 2: 'Cb', 3: 'Cr', 4: 'R', 5: 'G', 6: 'B' };
      return nums.map(n => map[n] || String(n)).join('');
    }
    if (tag === 0x0000 && kind === 'gps' && count === 4) {
      return nums.slice(0, 4).join('.');
    }
    if (tag === 0x0005 && kind === 'gps') {
      return first === 1 ? 'Below sea level' : 'Above sea level';
    }
    if (tag === 0xa300 || tag === 0xa301) {
      return String(first);
    }
    if (tag === 0x9c9b || tag === 0x9c9c || tag === 0x9c9d || tag === 0x9c9e || tag === 0x9c9f) {
      return decodeUtf16(b, absolute, len);
    }
    if (count > 64 || tag === 0x927c) {
      return `[${len} bytes of binary data]`;
    }
    return nums.map(n => n.toString(16).padStart(2, '0')).join(' ');
  }

  const values = nums;
  const v = first;

  switch (tag) {
    case 0x0112:
      return `${ORIENTATION_NAMES[v] || 'Unknown'} (${v})`;
    case 0x0103:
      if (v === 1) return 'Uncompressed';
      if (v === 6) return 'JPEG (old-style)';
      if (v === 7) return 'JPEG';
      return String(v);
    case 0x0128:
    case 0xa210:
      if (v === 2) return 'inches';
      if (v === 3) return 'centimeters';
      return String(v);
    case 0x0213:
      if (v === 1) return 'Centered';
      if (v === 2) return 'Co-sited';
      return String(v);
    case 0x829a: {
      if (v > 0 && v < 1) return `1/${Math.round(1 / v)} s`;
      return `${trimNum(v)} s`;
    }
    case 0x829d:
      return `f/${trimNum(v)}`;
    case 0x9202:
    case 0x9205:
      return `f/${trimNum(Math.pow(2, v / 2))} (APEX ${trimNum(v)})`;
    case 0x9201: {
      const seconds = Math.pow(2, -v);
      return seconds < 1 ? `1/${Math.round(1 / seconds)} s (APEX ${trimNum(v)})` : `${trimNum(seconds)} s`;
    }
    case 0x9204:
      return `${v > 0 ? '+' : ''}${trimNum(v)} EV`;
    case 0x920a:
      return `${trimNum(v)} mm`;
    case 0xa405:
      return `${trimNum(v)} mm (35mm equivalent)`;
    case 0xa432: {
      if (values.length >= 4) {
        return `${trimNum(values[0])}–${trimNum(values[1])} mm, f/${trimNum(values[2])}–${trimNum(values[3])}`;
      }
      return values.map(trimNum).join(', ');
    }
    case 0x9206:
      return `${trimNum(v)} m`;
    case 0xa404:
      return `${trimNum(v)}×`;
    case 0x9102:
      return `${trimNum(v)} bits/pixel`;
    case 0x8822:
      return `${EXPOSURE_PROGRAM[v] || 'Unknown'} (${v})`;
    case 0x9207:
      return `${METERING_MODE[v] || 'Unknown'} (${v})`;
    case 0x9208:
      return `${LIGHT_SOURCE[v] || 'Unknown'} (${v})`;
    case 0x9209:
      return `${flashText(v)} (${v})`;
    case 0xa001:
      if (v === 1) return 'sRGB';
      if (v === 65535) return 'Uncalibrated';
      return String(v);
    case 0xa217:
      return `${SENSING_METHOD[v] || 'Unknown'} (${v})`;
    case 0xa401:
      return v === 1 ? 'Custom process' : 'Normal process';
    case 0xa402:
      return v === 1 ? 'Manual exposure' : v === 2 ? 'Auto bracket' : 'Auto exposure';
    case 0xa403:
      return v === 0 ? 'Auto' : v === 1 ? 'Manual' : String(v);
    case 0xa406:
      return v === 0 ? 'Standard' : v === 1 ? 'Landscape' : v === 2 ? 'Portrait' : v === 3 ? 'Night scene' : String(v);
    case 0xa407:
      return ['None', 'Low gain up', 'High gain up', 'Low gain down', 'High gain down'][v] || String(v);
    case 0xa408:
    case 0xa409:
    case 0xa40a:
      return v === 0 ? 'Normal' : v === 1 ? 'Low' : v === 2 ? 'High' : String(v);
    case 0xa40c:
      return ['Unknown', 'Macro', 'Close view', 'Distant view'][v] || String(v);
    case 0xa300:
      return 'Digital still camera';
    case 0xa301:
      return 'Directly photographed';
    case 0x9000:
    case 0xa000:
      return ascii(b, absolute, Math.min(len, 16)).replace(/\0.*$/, '');
    case 0x0132:
    case 0x9003:
    case 0x9004:
      return normalizeExifDate(utf8(b, absolute, Math.min(len, 32)).replace(/\0.*$/, '').trim());
    case 0x9010:
    case 0x9011:
    case 0x9012:
    case 0x9290:
    case 0x9291:
    case 0x9292:
      return utf8(b, absolute, Math.min(len, 32)).replace(/\0.*$/, '').trim();
    case 0x0001:
      if (kind === 'gps') return utf8(b, absolute, Math.min(len, 8)).replace(/\0.*$/, '').trim();
      return utf8(b, absolute, Math.min(len, 32)).replace(/\0.*$/, '').trim();
    case 0x0002:
    case 0x0004:
      return `${dms(values)} (${trimNum(dmsToDecimal(values))})`;
    case 0x0014:
    case 0x0016:
      return dms(values);
    case 0x0006:
      return `${trimNum(v)} m`;
    case 0x0005:
      return v === 1 ? 'Below sea level' : 'Above sea level';
    case 0x0007:
      return formatGpsTime(values);
    case 0x0003:
      return String.fromCharCode(...values.slice(0, 3)).replace(/\0/g, '').trim() || String(v);
    case 0x0009:
      return v === 65 ? 'Measurement active' : v === 86 ? 'Measurement void' : String(v);
    case 0x000a:
      return v === 2 ? '2-D measurement' : v === 3 ? '3-D measurement' : String(v);
    case 0x000c:
      return v === 75 ? 'km/h' : v === 77 ? 'mph' : v === 78 ? 'knots' : String(v);
    case 0x0010:
    case 0x000e:
    case 0x0017:
      return v === 84 ? 'True north' : v === 77 ? 'Magnetic north' : String(v);
    case 0x000f:
    case 0x0011:
    case 0x0018:
      return `${trimNum(v)}°`;
    case 0x001a:
      return `${trimNum(v)} km`;
    case 0x001d:
      return normalizeExifDate(utf8(b, absolute, Math.min(len, 16)).replace(/\0.*$/, '').trim());
    case 0x001e:
      return v === 1 ? 'Differential correction applied' : 'No differential correction';
    case 0x001f:
      return `${trimNum(v)} m`;
    case 0x000b:
      return trimNum(v);
    default:
      break;
  }

  if (kind === 'gps') {
    return values.map(trimNum).join(', ');
  }

  return values.length > 1 ? values.map(trimNum).join(', ') : trimNum(v);
}

function parseIfd(ctx: TiffCtx, offset: number, kind: DictKind, state: TiffState, depth: number): number {
  if (depth > 4 || offset <= 0 || offset + 2 > ctx.length) return 0;
  const count = readU16(ctx, offset);
  if (count <= 0 || count > 1024 || offset + 2 + count * 12 + 4 > ctx.length) return 0;

  const dict = DICTS[kind];

  for (let i = 0; i < count; i++) {
    const entryOff = offset + 2 + i * 12;
    const tag = readU16(ctx, entryOff);
    const type = readU16(ctx, entryOff + 2);
    const valueCount = readU32(ctx, entryOff + 4);
    if (valueCount === 0) continue;

    if (POINTER_TAGS.has(tag)) {
      const sub = readU32(ctx, entryOff + 8);
      if (tag === 0x8769) parseIfd(ctx, sub, 'exif', state, depth + 1);
      else if (tag === 0x8825) parseIfd(ctx, sub, 'gps', state, depth + 1);
      else parseIfd(ctx, sub, 'interop', state, depth + 1);
      continue;
    }

    const loc = valueOffset(ctx, entryOff, type, valueCount);
    if (!loc) continue;

    let nums: number[] = [];
    if (type !== 2) {
      nums = readNumbers(ctx, type, valueCount, loc.off);
    }

    const info = dict[tag];
    const name = info?.name || `${kind === 'gps' ? 'GPS ' : ''}Tag 0x${tag.toString(16).padStart(4, '0')}`;
    const group: TagGroup = info?.group || 'other';

    let value: string;
    try {
      value = formatEntry(kind, tag, type, valueCount, nums, ctx, loc.off, loc.len);
    } catch {
      value = `[${loc.len} bytes]`;
    }
    if (!value) value = '—';

    state.tags.push({ tag, name, group, value });

    if (kind === 'ifd' && tag === 0x0112) state.orientation = nums[0];
    if (tag === 0x927c) state.hasMakerNote = true;
    if (tag === 0x0201) state.hasThumbnail = true;

    if (kind === 'gps') {
      const g = state.gps;
      const refText = (tag === 0x0001 || tag === 0x0003)
        ? (type === 2
            ? utf8(ctx.bytes, ctx.base + loc.off, Math.min(loc.len, 4)).replace(/\0.*$/, '').trim()
            : String.fromCharCode(nums[0] || 0).trim())
        : '';
      if (tag === 0x0001) g.latRef = refText;
      if (tag === 0x0003) g.lngRef = refText;
      if (tag === 0x0002) g.lat = nums;
      if (tag === 0x0004) g.lng = nums;
      if (tag === 0x0006) g.alt = nums[0];
      if (tag === 0x0005) g.altRef = nums[0];
      if (tag === 0x0007) g.time = nums;
      if (tag === 0x001d) {
        g.date = utf8(ctx.bytes, ctx.base + loc.off, Math.min(loc.len, 16)).replace(/\0.*$/, '').trim();
      }
    }
  }

  const next = offset + 2 + count * 12;
  return readU32(ctx, next);
}

export function parseTiff(bytes: Uint8Array, base: number, state: TiffState): void {
  if (base + 8 > bytes.length) return;
  const order = ascii(bytes, base, 2);
  const little = order === 'II';
  if (!little && order !== 'MM') return;
  const magic = little ? readU16LE(bytes, base + 2) : readU16BE(bytes, base + 2);
  if (magic !== 42) return;

  const ctx: TiffCtx = { bytes, base, little, length: bytes.length - base };
  const ifd0 = readU32(ctx, 4);
  if (ifd0 <= 0) return;

  const next = parseIfd(ctx, ifd0, 'ifd', state, 0);
  if (next > 0) state.hasThumbnail = true;
}
