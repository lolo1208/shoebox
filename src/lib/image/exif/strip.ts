/**
 * 元数据清除：无损重写 JPEG/PNG/WEBP/GIF，原位清空 HEIC/AVIF 的 Exif/XMP。
 */

import { formatBytes } from '@/lib/format';
import {
  type MetaReport,
  type StripOptions,
  type StripResult,
  u8FromString,
  ascii,
  startsWith,
  readU16BE,
  readU32BE,
  readU32LE,
} from './tiff';
import { findGpsRanges, readGifSubBlocks, skipGifSubBlocks } from './containers';

const concat = (parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
};

const minimalTiff = (orientation: number): Uint8Array => {
  const tiff = new Uint8Array(26);
  tiff[0] = 0x49;
  tiff[1] = 0x49;
  tiff[2] = 0x2a;
  tiff[3] = 0x00;
  tiff[4] = 0x08;
  tiff[8] = 0x01;
  tiff[10] = 0x12;
  tiff[11] = 0x01;
  tiff[12] = 0x03;
  tiff[14] = 0x01;
  tiff[18] = orientation & 0xff;
  tiff[19] = (orientation >> 8) & 0xff;
  return tiff;
};

const orientationApp1 = (orientation: number): Uint8Array => {
  const tiff = minimalTiff(orientation);
  const payload = 6 + tiff.length;
  const seg = new Uint8Array(4 + payload);
  seg[0] = 0xff;
  seg[1] = 0xe1;
  seg[2] = ((payload + 2) >> 8) & 0xff;
  seg[3] = (payload + 2) & 0xff;
  seg.set(u8FromString('Exif\0\0'), 4);
  seg.set(tiff, 10);
  return seg;
};

/** 遍历熵编码数据找到 EOI，从而丢弃追加的垃圾数据 */
function findJpegEnd(b: Uint8Array, start: number): number {
  let pos = start;
  while (pos + 1 < b.length) {
    if (b[pos] !== 0xff) {
      pos++;
      continue;
    }
    const marker = b[pos + 1];
    if (marker === 0x00) {
      pos += 2;
      continue;
    }
    if (marker === 0xff) {
      pos++;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      pos += 2;
      continue;
    }
    if (marker === 0xd9) return pos + 2;
    if (pos + 4 > b.length) return b.length;
    const len = (b[pos + 2] << 8) | b[pos + 3];
    if (len < 2) return b.length;
    pos += 2 + len;
  }
  return b.length;
}

/** MPO 立体图与手机动态照片会追加第二张图或视频 */
function hasAttachedMedia(rest: Uint8Array): boolean {
  if (rest.length < 8) return false;
  if (rest[0] === 0xff && rest[1] === 0xd8) return true;
  return ascii(rest, 4, 4) === 'ftyp' || ascii(rest, 0, 4) === 'ftyp';
}

const isRotated = (orientation?: number): boolean => !!orientation && orientation >= 2 && orientation <= 8;

function stripJpeg(b: Uint8Array, orientation: number | undefined, opts: StripOptions): { bytes: Uint8Array; removed: string[] } {
  if (b[0] !== 0xff || b[1] !== 0xd8) throw new Error('Not a JPEG file');
  const scope = opts.scope ?? 'all';
  if (scope === 'location') b = b.slice();
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  const removed = new Set<string>();

  const keepOrientation = scope === 'all' && !!opts.keepOrientation && isRotated(orientation);
  const orientationSeg = keepOrientation ? orientationApp1(orientation as number) : null;
  let orientationInserted = false;

  let pos = 2;
  let safety = 0;
  while (pos + 1 < b.length && safety++ < 20000) {
    if (b[pos] !== 0xff) {
      parts.push(b.subarray(pos));
      break;
    }
    const marker = b[pos + 1];
    if (marker === 0xff) {
      parts.push(b.subarray(pos, pos + 1));
      pos++;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      parts.push(b.subarray(pos, pos + 2));
      pos += 2;
      continue;
    }
    if (marker === 0xd9) {
      // 丢弃 JPEG 流真正结束之后的所有内容
      parts.push(b.subarray(pos, pos + 2));
      break;
    }
    if (marker === 0xda) {
      const imageEnd = findJpegEnd(b, pos);
      parts.push(b.subarray(pos, imageEnd));
      let cursor = imageEnd;
      // MPO 立体对会追加额外 JPEG 帧，同样需要清理元数据
      while (cursor + 1 < b.length && b[cursor] === 0xff && b[cursor + 1] === 0xd8) {
        const frameEnd = findJpegEnd(b, cursor + 2);
        try {
          const frame = stripJpeg(b.subarray(cursor, frameEnd), undefined, { ...opts, keepOrientation: false });
          parts.push(frame.bytes);
          frame.removed.forEach(label => removed.add(label));
        } catch {
          // 次级帧损坏时保留内容，不做删除
          parts.push(b.subarray(cursor, frameEnd));
        }
        if (frameEnd <= cursor) break;
        cursor = frameEnd;
      }
      // 保留合法的附加媒体（如动态照片视频），丢弃任意尾随数据
      if (hasAttachedMedia(b.subarray(cursor))) parts.push(b.subarray(cursor));
      break;
    }
    if (pos + 4 > b.length) {
      parts.push(b.subarray(pos));
      break;
    }
    const len = readU16BE(b, pos + 2);
    if (len < 2) {
      parts.push(b.subarray(pos));
      break;
    }
    const end = pos + 2 + len;
    if (end > b.length) {
      parts.push(b.subarray(pos));
      break;
    }
    const payload = pos + 4;
    const payloadLen = len - 2;
    let keep = true;

    if (marker >= 0xe0 && marker <= 0xef) {
      const app = marker - 0xe0;
      if (app === 0) {
        if (scope === 'location') {
          // JFIF 数据不含位置信息，保持原样
        } else if (startsWith(b, payload, 'JFIF\0') && payloadLen >= 14) {
          const tw = b[payload + 12];
          const th = b[payload + 13];
          if (tw && th) {
            const trimmed = new Uint8Array(18);
            trimmed[0] = 0xff;
            trimmed[1] = 0xe0;
            trimmed[3] = 16;
            trimmed.set(b.subarray(payload, payload + 14), 4);
            trimmed[16] = 0;
            trimmed[17] = 0;
            parts.push(trimmed);
            keep = false;
            removed.add('JFIF thumbnail');
          }
        } else if (startsWith(b, payload, 'JFXX\0')) {
          keep = false;
          removed.add('JFIF extension');
        } else if (payloadLen > 0) {
          keep = false;
          removed.add('APP0');
        }
      } else if (app === 1) {
        const isExif = startsWith(b, payload, 'Exif\0\0');
        const isXmp = startsWith(b, payload, 'http://ns.adobe.com/xap/1.0/\0')
          || startsWith(b, payload, 'http://ns.adobe.com/xmp/extension/\0');
        if (scope === 'location') {
          if (isExif) {
            for (const range of findGpsRanges(b, payload + 6, end)) {
              const start = Math.max(0, range.offset);
              const stop = Math.min(b.length, range.offset + range.length);
              if (stop > start) {
                b.fill(0, start, stop);
                removed.add('GPS location');
              }
            }
          } else if (isXmp) {
            keep = false;
            removed.add('XMP');
          }
        } else {
          keep = false;
          if (isExif) removed.add('EXIF');
          else if (isXmp) removed.add('XMP');
          else removed.add('APP1');
        }
      } else if (app === 2) {
        if (scope === 'location') {
          // ICC 等 APP2 数据不属于位置元数据
        } else if (startsWith(b, payload, 'ICC_PROFILE\0')) {
          if (!opts.keepIcc) {
            keep = false;
            removed.add('ICC profile');
          }
        } else {
          keep = false;
          removed.add('APP2');
        }
      } else if (app === 13) {
        keep = false;
        removed.add('IPTC / Photoshop');
      } else if (scope === 'all' && (app === 12 || app === 15)) {
        keep = false;
        removed.add(`APP${app}`);
      }
      // 保留 APP0（JFIF）与 APP14（Adobe 色彩变换）
    } else if (marker === 0xfe) {
      if (scope === 'all') {
        keep = false;
        removed.add('Comment');
      }
    }

    if (keep) parts.push(b.subarray(pos, end));
    if (orientationSeg && !orientationInserted && marker === 0xe0) {
      parts.push(orientationSeg);
      orientationInserted = true;
    }
    pos = end;
  }

  // APP0 放在最前，保证 JFIF 兼容性
  if (orientationSeg && !orientationInserted) parts.splice(1, 0, orientationSeg);

  return { bytes: concat(parts), removed: Array.from(removed) };
}

/* PNG 块 CRC-32 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function makePngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(u8FromString(type), 4);
  out.set(data, 8);
  const crcInput = new Uint8Array(4 + data.length);
  crcInput.set(u8FromString(type), 0);
  crcInput.set(data, 4);
  view.setUint32(8 + data.length, crc32(crcInput));
  return out;
}

const pngKeyword = (b: Uint8Array, start: number, end: number): string => {
  let pos = start;
  while (pos < end && b[pos] !== 0) pos++;
  return ascii(b, start, pos - start);
};

function stripPng(b: Uint8Array, orientation: number | undefined, opts: StripOptions): { bytes: Uint8Array; removed: string[] } {
  if (!(b[0] === 0x89 && ascii(b, 1, 3) === 'PNG')) throw new Error('Not a PNG file');
  const scope = opts.scope ?? 'all';
  if (scope === 'location') b = b.slice();
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  const removed = new Set<string>();
  const metadataTypes = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

  let pos = 8;
  let insertedOrientation = false;
  let safety = 0;
  while (pos + 12 <= b.length && safety++ < 100000) {
    const len = readU32BE(b, pos);
    const type = ascii(b, pos + 4, 4);
    const end = pos + 12 + len;
    if (end > b.length) {
      parts.push(b.subarray(pos));
      break;
    }
    const dataStart = pos + 8;
    const dataEnd = dataStart + len;
    const chunk = b.subarray(pos, end);

    let keep = true;
    let replacement: Uint8Array | null = null;
    if (scope === 'location') {
      if (type === 'eXIf') {
        const base = startsWith(b, dataStart, 'Exif\0\0') ? dataStart + 6 : dataStart;
        const ranges = findGpsRanges(b, base, dataEnd);
        if (ranges.length) {
          for (const range of ranges) {
            const start = Math.max(0, range.offset);
            const stop = Math.min(b.length, range.offset + range.length);
            if (stop > start) b.fill(0, start, stop);
          }
          removed.add('GPS location');
          replacement = makePngChunk('eXIf', b.subarray(dataStart, dataEnd));
          keep = false;
        }
      } else if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
        if (pngKeyword(b, dataStart, dataEnd) === 'XML:com.adobe.xmp') {
          keep = false;
          removed.add('XMP');
        }
      }
    } else if (metadataTypes.has(type)) {
      keep = false;
      if (type === 'eXIf') removed.add('EXIF');
      else if (type === 'tIME') removed.add('tIME');
      else removed.add('Text chunk');
    } else if (type === 'iCCP' && !opts.keepIcc) {
      keep = false;
      removed.add('ICC profile');
    }

    if (keep) {
      parts.push(chunk);
      if (scope === 'all' && type === 'IHDR' && !insertedOrientation && opts.keepOrientation && isRotated(orientation)) {
        parts.push(makePngChunk('eXIf', minimalTiff(orientation as number)));
        insertedOrientation = true;
      }
    }
    if (replacement) parts.push(replacement);

    pos = end;
    if (type === 'IEND') break;
  }

  return { bytes: concat(parts), removed: Array.from(removed) };
}

function stripWebp(b: Uint8Array, orientation: number | undefined, opts: StripOptions): { bytes: Uint8Array; removed: string[] } {
  if (ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') throw new Error('Not a WEBP file');
  const scope = opts.scope ?? 'all';
  const chunks: { fourcc: string; data: Uint8Array }[] = [];
  const removed = new Set<string>();
  let hasIcc = false;
  let hasExif = false;

  let pos = 12;
  let safety = 0;
  while (pos + 8 <= b.length && safety++ < 10000) {
    const fourcc = ascii(b, pos, 4);
    const size = readU32LE(b, pos + 4);
    const dataStart = pos + 8;
    if (dataStart + size > b.length) break;
    const data = b.subarray(dataStart, dataStart + size);

    let keep = true;
    if (fourcc === 'EXIF') {
      if (scope === 'location') {
        const patched = new Uint8Array(data);
        const base = startsWith(patched, 0, 'Exif\0\0') ? 6 : 0;
        for (const range of findGpsRanges(patched, base)) {
          const start = Math.max(0, range.offset);
          const stop = Math.min(patched.length, range.offset + range.length);
          if (stop > start) {
            patched.fill(0, start, stop);
            removed.add('GPS location');
          }
        }
        chunks.push({ fourcc, data: patched });
        hasExif = true;
        keep = false;
      } else {
        keep = false;
        removed.add('EXIF');
      }
    } else if (fourcc === 'XMP ') {
      keep = false;
      removed.add('XMP');
    } else if (fourcc === 'ICCP' && scope === 'all' && !opts.keepIcc) {
      keep = false;
      removed.add('ICC profile');
    }

    if (keep) {
      if (fourcc === 'ICCP') hasIcc = true;
      if (fourcc === 'EXIF') hasExif = true;
      chunks.push({ fourcc, data });
    }

    pos = dataStart + size + (size & 1);
  }

  const vp8xIndex = chunks.findIndex(chunk => chunk.fourcc === 'VP8X');
  // 简单格式 WebP 没有 VP8X，无法正确标记元数据
  const addOrientation = !!(scope === 'all' && opts.keepOrientation && isRotated(orientation) && vp8xIndex >= 0);
  if (addOrientation) {
    chunks.push({ fourcc: 'EXIF', data: minimalTiff(orientation as number) });
  }

  // 保持 VP8X 特性标志与保留的块一致
  if (vp8xIndex >= 0 && chunks[vp8xIndex].data.length >= 1) {
    const patched = new Uint8Array(chunks[vp8xIndex].data);
    patched[0] &= ~0x04; // XMP is removed in every mode
    if (scope === 'all') {
      patched[0] &= ~0x08; // EXIF removed
      if (addOrientation) patched[0] |= 0x08;
    } else if (hasExif) {
      patched[0] |= 0x08;
    } else {
      patched[0] &= ~0x08;
    }
    if (hasIcc) patched[0] |= 0x20;
    else patched[0] &= ~0x20;
    chunks[vp8xIndex] = { fourcc: 'VP8X', data: patched };
  }

  const bodyParts: Uint8Array[] = [u8FromString('WEBP')];
  for (const chunk of chunks) {
    const header = new Uint8Array(8);
    header.set(u8FromString(chunk.fourcc), 0);
    new DataView(header.buffer).setUint32(4, chunk.data.length, true);
    bodyParts.push(header);
    bodyParts.push(chunk.data);
    if (chunk.data.length & 1) bodyParts.push(new Uint8Array(1));
  }
  const body = concat(bodyParts);
  const riff = new Uint8Array(8);
  riff.set(u8FromString('RIFF'), 0);
  new DataView(riff.buffer).setUint32(4, body.length, true);
  return { bytes: concat([riff, body]), removed: Array.from(removed) };
}

function stripGif(b: Uint8Array, scope: 'all' | 'location' = 'all'): { bytes: Uint8Array; removed: string[] } {
  const header = ascii(b, 0, 6);
  if (header !== 'GIF87a' && header !== 'GIF89a') throw new Error('Not a GIF file');
  const parts: Uint8Array[] = [];
  const removed = new Set<string>();

  const flags = b[10];
  let pos = 13;
  if (flags & 0x80) pos += 3 * (2 << (flags & 7));
  if (pos > b.length) pos = b.length;
  parts.push(b.subarray(0, pos));

  let safety = 0;
  while (pos < b.length && safety++ < 100000) {
    const block = b[pos];
    if (block === 0x3b) {
      parts.push(b.subarray(pos));
      break;
    }
    if (block === 0x21 && pos + 2 <= b.length) {
      const label = b[pos + 1];
      const start = pos;
      if (label === 0xfe) {
        const sub = readGifSubBlocks(b, pos + 2);
        if (scope === 'all') {
          removed.add('Comment');
          pos = sub.end;
          continue;
        }
        pos = sub.end;
        parts.push(b.subarray(start, pos));
        continue;
      }
      if (label === 0xff && pos + 2 < b.length) {
        const blockSize = b[pos + 2];
        const appId = ascii(b, pos + 3, Math.min(blockSize, 11));
        const sub = readGifSubBlocks(b, pos + 3 + blockSize);
        if (appId.startsWith('XMP DataXMP')) {
          removed.add('XMP');
          pos = sub.end;
          continue;
        }
        pos = sub.end;
        parts.push(b.subarray(start, pos));
        continue;
      }
      pos = skipGifSubBlocks(b, pos + 2);
      parts.push(b.subarray(start, pos));
      continue;
    }
    if (block === 0x2c) {
      const start = pos;
      pos += 10;
      if (pos > b.length) {
        parts.push(b.subarray(start));
        break;
      }
      const lflags = b[pos - 1];
      if (lflags & 0x80) pos += 3 * (2 << (lflags & 7));
      pos += 1;
      pos = skipGifSubBlocks(b, pos);
      parts.push(b.subarray(start, pos));
      continue;
    }
    parts.push(b.subarray(pos));
    break;
  }

  return { bytes: concat(parts), removed: Array.from(removed) };
}

async function reencodeToPng(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Failed to encode PNG'))), 'image/png');
  });
}

const cleanName = (name: string, ext: string): string => {
  const base = name.replace(/\.[^.]+$/, '') || 'image';
  return `${base}_clean.${ext}`;
};

export async function stripMetadata(file: File, report: MetaReport, opts: StripOptions): Promise<StripResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let out: Uint8Array;
  let removed: string[] = [];
  let mime = report.mime;
  let ext = 'bin';

  if (report.format === 'JPEG') {
    const res = stripJpeg(bytes, report.orientation, opts);
    out = res.bytes;
    removed = res.removed;
    mime = 'image/jpeg';
    ext = 'jpg';
  } else if (report.format === 'PNG') {
    const res = stripPng(bytes, report.orientation, opts);
    out = res.bytes;
    removed = res.removed;
    mime = 'image/png';
    ext = 'png';
  } else if (report.format === 'WEBP') {
    const res = stripWebp(bytes, report.orientation, opts);
    out = res.bytes;
    removed = res.removed;
    mime = 'image/webp';
    ext = 'webp';
  } else if (report.format === 'GIF') {
    const res = stripGif(bytes, opts.scope ?? 'all');
    out = res.bytes;
    removed = res.removed;
    mime = 'image/gif';
    ext = 'gif';
  } else if (report.inPlaceOnly) {
    const scope = opts.scope ?? 'all';
    const ranges = scope === 'location' ? report.locationWipes : report.wipes;
    const inPlaceExt = report.format === 'AVIF' ? 'avif' : 'heic';
    if (!ranges.length) {
      return {
        blob: new Blob([bytes as unknown as BlobPart], { type: report.mime }),
        name: cleanName(file.name, inPlaceExt),
        removed: [],
        savedBytes: 0,
        reencoded: false,
        inPlace: true
      };
    }
    const patched = bytes.slice();
    const labels = new Set<string>();
    for (const range of ranges) {
      const start = Math.max(0, range.offset);
      const end = Math.min(patched.length, range.offset + range.length);
      if (end > start) {
        patched.fill(0, start, end);
        labels.add(range.label);
      }
    }
    return {
      blob: new Blob([patched as unknown as BlobPart], { type: report.mime }),
      name: cleanName(file.name, inPlaceExt),
      removed: Array.from(labels),
      savedBytes: 0,
      reencoded: false,
      inPlace: true
    };
  } else {
    const blob = await reencodeToPng(file);
    return {
      blob,
      name: cleanName(file.name, 'png'),
      removed: ['fallback:all'],
      savedBytes: file.size - blob.size,
      reencoded: true,
      inPlace: false
    };
  }

  const blob = new Blob([out as unknown as BlobPart], { type: mime });
  return {
    blob,
    name: cleanName(file.name, ext),
    removed,
    savedBytes: file.size - blob.size,
    reencoded: false,
    inPlace: false
  };
}

