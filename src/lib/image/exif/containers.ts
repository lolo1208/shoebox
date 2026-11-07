/**
 * 各容器的元数据解析：JPEG、PNG、WEBP、GIF、HEIC/AVIF。
 * 只读取结构，不解码像素。
 */

import {
  type DictKind,
  type MetaReport,
  type TiffState,
  type WipeRange,
  ascii,
  TYPE_SIZE,
  createTiffState,
  parseTiff,
  readU16BE,
  readU24LE,
  readU32BE,
  readU32LE,
  readU16LE,
  startsWith,
  utf8,
  u8FromString,
} from './tiff';

/* ------------------------------------------------------------------ */
/* JPEG 容器 */
/* ------------------------------------------------------------------ */

const isSofMarker = (m: number) =>
  m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;

export function parseJpeg(b: Uint8Array, report: MetaReport, state: TiffState): void {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) throw new Error('Not a JPEG file');
  report.format = 'JPEG';
  report.mime = 'image/jpeg';

  let pos = 2;
  let safety = 0;
  while (pos + 1 < b.length && safety++ < 20000) {
    if (b[pos] !== 0xff) {
      pos++;
      continue;
    }
    const marker = b[pos + 1];
    if (marker === 0xff) {
      pos++;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      pos += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break;
    if (pos + 4 > b.length) break;

    const len = readU16BE(b, pos + 2);
    if (len < 2) break;
    const end = pos + 2 + len;
    if (end > b.length) break;
    const payload = pos + 4;
    const payloadLen = len - 2;

    if (marker >= 0xe0 && marker <= 0xef) {
      const app = marker - 0xe0;
      if (app === 0) {
        // JFIF 头：保留密度信息，同时标记内嵌缩略图
        if (startsWith(b, payload, 'JFIF\0') && payloadLen >= 14) {
          const tw = b[payload + 12];
          const th = b[payload + 13];
          if (tw && th) {
            report.hasThumbnail = true;
            report.metadataBytes += tw * th * 3;
          }
        }
      } else if (app === 1) {
        report.metadataBytes += len + 2;
        if (startsWith(b, payload, 'Exif\0\0')) {
          parseTiff(b, payload + 6, state);
        } else if (startsWith(b, payload, 'http://ns.adobe.com/xap/1.0/\0')) {
          const xmp = utf8(b, payload + 29, payloadLen - 29).replace(/\0+$/, '');
          if (xmp.trim()) report.xmp.push(xmp);
        } else if (startsWith(b, payload, 'http://ns.adobe.com/xmp/extension/\0')) {
          const xmp = utf8(b, payload + 75, Math.max(0, payloadLen - 75)).replace(/\0+$/, '');
          if (xmp.trim()) report.xmp.push(xmp);
        }
      } else if (app === 2) {
        if (startsWith(b, payload, 'ICC_PROFILE\0')) {
          report.iccSize = (report.iccSize || 0) + payloadLen;
          report.metadataBytes += len + 2;
        } else {
          report.metadataBytes += len + 2;
        }
      } else if (app === 13) {
        if (payloadLen > 14 && startsWith(b, payload, 'Photoshop 3.0\0')) report.iptc = true;
        report.metadataBytes += len + 2;
      } else if (app === 14) {
        // Adobe APP14 携带 CMYK 色彩变换，需保留
      } else {
        report.metadataBytes += len + 2;
      }
    } else if (marker === 0xfe) {
      report.metadataBytes += len + 2;
      const comment = utf8(b, payload, payloadLen).replace(/\0+$/, '').trim();
      if (comment) report.comments.push(comment);
    } else if (isSofMarker(marker) && payloadLen >= 5) {
      report.height = readU16BE(b, payload + 1);
      report.width = readU16BE(b, payload + 3);
    }

    pos = end;
  }
}

/* ------------------------------------------------------------------ */
/* PNG 容器 */
/* ------------------------------------------------------------------ */

async function inflate(bytes: Uint8Array, maxBytes = 2 * 1024 * 1024): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined' || bytes.length === 0) return bytes;
  try {
    const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || !value.length) continue;
      const remaining = maxBytes - total;
      if (remaining <= 0) {
        await reader.cancel().catch(() => undefined);
        break;
      }
      const chunk = value.length > remaining ? value.subarray(0, remaining) : value;
      chunks.push(chunk);
      total += chunk.length;
      if (total >= maxBytes) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  } catch {
    return bytes;
  }
}

export async function parsePng(b: Uint8Array, report: MetaReport, state: TiffState): Promise<void> {
  report.format = 'PNG';
  report.mime = 'image/png';

  let pos = 8;
  let safety = 0;
  while (pos + 12 <= b.length && safety++ < 100000) {
    if (report.tags.length > 5000 || report.xmp.length > 100) {
      report.warnings.push('metadata limit reached');
      break;
    }
    const len = readU32BE(b, pos);
    const type = ascii(b, pos + 4, 4);
    const dataStart = pos + 8;
    const dataEnd = dataStart + len;
    if (dataEnd + 4 > b.length) break;
    const total = len + 12;

    switch (type) {
      case 'IHDR':
        report.width = readU32BE(b, dataStart);
        report.height = readU32BE(b, dataStart + 4);
        break;
      case 'eXIf': {
        report.metadataBytes += total;
        const base = startsWith(b, dataStart, 'Exif\0\0') ? dataStart + 6 : dataStart;
        parseTiff(b, base, state);
        break;
      }
      case 'tEXt': {
        report.metadataBytes += total;
        let zero = dataStart;
        while (zero < dataEnd && b[zero] !== 0) zero++;
        const key = ascii(b, dataStart, zero - dataStart);
        const value = utf8(b, zero + 1, dataEnd - zero - 1).replace(/\0+$/, '').trim();
        if (key && value) {
          if (key === 'XML:com.adobe.xmp') report.xmp.push(value);
          else state.tags.push({ tag: 0, name: key, group: 'other', value });
        }
        break;
      }
      case 'zTXt': {
        report.metadataBytes += total;
        let zero = dataStart;
        while (zero < dataEnd && b[zero] !== 0) zero++;
        const key = ascii(b, dataStart, zero - dataStart);
        if (zero + 2 <= dataEnd) {
          const inflated = await inflate(b.subarray(zero + 2, dataEnd));
          const value = utf8(inflated, 0, inflated.length).replace(/\0+$/, '').trim();
          if (key && value) state.tags.push({ tag: 0, name: key, group: 'other', value });
        }
        break;
      }
      case 'iTXt': {
        report.metadataBytes += total;
        let zero = dataStart;
        while (zero < dataEnd && b[zero] !== 0) zero++;
        const key = ascii(b, dataStart, zero - dataStart);
        if (zero + 3 <= dataEnd) {
          const compressed = b[zero + 1] === 1;
          let cursor = zero + 3;
          while (cursor < dataEnd && b[cursor] !== 0) cursor++;
          cursor++;
          while (cursor < dataEnd && b[cursor] !== 0) cursor++;
          cursor++;
          let payload = b.subarray(cursor, dataEnd);
          if (compressed) payload = await inflate(payload);
          const value = utf8(payload, 0, payload.length).replace(/\0+$/, '').trim();
          if (key && value) {
            if (key === 'XML:com.adobe.xmp') report.xmp.push(value);
            else state.tags.push({ tag: 0, name: key, group: 'other', value });
          }
        }
        break;
      }
      case 'tIME': {
        report.metadataBytes += total;
        if (len >= 7) {
          const year = readU16BE(b, dataStart);
          const month = String(b[dataStart + 2]).padStart(2, '0');
          const day = String(b[dataStart + 3]).padStart(2, '0');
          const hh = String(b[dataStart + 4]).padStart(2, '0');
          const mm = String(b[dataStart + 5]).padStart(2, '0');
          const ss = String(b[dataStart + 6]).padStart(2, '0');
          state.tags.push({ tag: 0, name: 'LastModificationTime', group: 'time', value: `${year}-${month}-${day} ${hh}:${mm}:${ss} UTC` });
        }
        break;
      }
      case 'iCCP': {
        report.iccSize = (report.iccSize || 0) + len;
        report.metadataBytes += total;
        break;
      }
      case 'IEND':
        pos = dataEnd + 4;
        continue;
      default:
        break;
    }

    pos = dataEnd + 4;
  }

  // eXIf 可能不存在，方向信息也可能只存在于文本块
  if (!report.width || !report.height) report.warnings.push('Image dimensions not found');
}

/* ------------------------------------------------------------------ */
/* WEBP 容器 */
/* ------------------------------------------------------------------ */

export function parseWebp(b: Uint8Array, report: MetaReport, state: TiffState): void {
  if (ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') throw new Error('Not a WEBP file');
  report.format = 'WEBP';
  report.mime = 'image/webp';

  let pos = 12;
  let safety = 0;
  while (pos + 8 <= b.length && safety++ < 10000) {
    const fourcc = ascii(b, pos, 4);
    const size = readU32LE(b, pos + 4);
    const dataStart = pos + 8;
    const dataEnd = dataStart + size;
    if (dataEnd > b.length) break;

    if (fourcc === 'VP8X') {
      if (size >= 10) {
        report.width = readU24LE(b, dataStart + 4) + 1;
        report.height = readU24LE(b, dataStart + 7) + 1;
      }
    } else if (fourcc === 'VP8 ' && size >= 10) {
      if (b[dataStart + 3] === 0x9d && b[dataStart + 4] === 0x01 && b[dataStart + 5] === 0x2a) {
        report.width = readU16LE(b, dataStart + 6) & 0x3fff;
        report.height = readU16LE(b, dataStart + 8) & 0x3fff;
      }
    } else if (fourcc === 'VP8L' && size >= 5) {
      if (b[dataStart] === 0x2f) {
        const b0 = b[dataStart + 1];
        const b1 = b[dataStart + 2];
        const b2 = b[dataStart + 3];
        const b3 = b[dataStart + 4];
        report.width = 1 + (((b1 & 0x3f) << 8) | b0);
        report.height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | (b1 >> 6));
      }
    } else if (fourcc === 'EXIF') {
      report.metadataBytes += size + 8 + (size & 1);
      const base = startsWith(b, dataStart, 'Exif\0\0') ? dataStart + 6 : dataStart;
      parseTiff(b, base, state);
    } else if (fourcc === 'XMP ') {
      report.metadataBytes += size + 8 + (size & 1);
      const value = utf8(b, dataStart, size).replace(/\0+$/, '').trim();
      if (value) report.xmp.push(value);
    } else if (fourcc === 'ICCP') {
      report.iccSize = (report.iccSize || 0) + size;
      report.metadataBytes += size + 8 + (size & 1);
    }

    pos = dataEnd + (size & 1);
  }
}

/* ------------------------------------------------------------------ */
/* GIF 容器 */
/* ------------------------------------------------------------------ */

export const skipGifSubBlocks = (b: Uint8Array, pos: number): number => {
  let p = pos;
  while (p < b.length) {
    const len = b[p];
    p += 1 + len;
    if (len === 0) break;
  }
  return Math.min(p, b.length);
};

export function readGifSubBlocks(b: Uint8Array, pos: number): { data: Uint8Array; end: number } {
  const chunks: Uint8Array[] = [];
  let p = pos;
  while (p < b.length) {
    const len = b[p];
    p++;
    if (len === 0) break;
    chunks.push(b.subarray(p, p + len));
    p += len;
  }
  const size = chunks.reduce((n, c) => n + c.length, 0);
  const data = new Uint8Array(size);
  let o = 0;
  for (const c of chunks) {
    data.set(c, o);
    o += c.length;
  }
  return { data, end: Math.min(p, b.length) };
}

export function parseGif(b: Uint8Array, report: MetaReport): void {
  const header = ascii(b, 0, 6);
  if (header !== 'GIF87a' && header !== 'GIF89a') throw new Error('Not a GIF file');
  report.format = 'GIF';
  report.mime = 'image/gif';
  report.width = readU16LE(b, 6);
  report.height = readU16LE(b, 8);

  const flags = b[10];
  let pos = 13;
  if (flags & 0x80) pos += 3 * (2 << (flags & 7));

  let safety = 0;
  while (pos < b.length && safety++ < 100000) {
    const block = b[pos];
    if (block === 0x3b) break;
    if (block === 0x21 && pos + 2 <= b.length) {
      const label = b[pos + 1];
      if (label === 0xfe) {
        const sub = readGifSubBlocks(b, pos + 2);
        const text = utf8(sub.data, 0, sub.data.length).replace(/\0+$/, '').trim();
        if (text) report.comments.push(text);
        report.metadataBytes += sub.end - pos;
        pos = sub.end;
        continue;
      }
      if (label === 0xff && pos + 2 < b.length) {
        const blockSize = b[pos + 2];
        const appId = ascii(b, pos + 3, Math.min(blockSize, 11));
        const sub = readGifSubBlocks(b, pos + 3 + blockSize);
        if (appId.startsWith('XMP DataXMP')) {
          const text = utf8(sub.data, 0, sub.data.length).replace(/\0+$/, '').trim();
          if (text) report.xmp.push(text);
          report.metadataBytes += sub.end - pos;
        }
        pos = sub.end;
        continue;
      }
      pos = skipGifSubBlocks(b, pos + 2);
      continue;
    }
    if (block === 0x2c) {
      pos += 10;
      if (pos > b.length) break;
      const lflags = b[pos - 1];
      if (lflags & 0x80) pos += 3 * (2 << (lflags & 7));
      pos += 1;
      pos = skipGifSubBlocks(b, pos);
      continue;
    }
    break;
  }
}

/* ------------------------------------------------------------------ */
/* HEIC / AVIF 容器（ISO BMFF） */
/* ------------------------------------------------------------------ */

interface BmffBox {
  type: string;
  start: number;
  contentStart: number;
  end: number;
}

function readBmffBoxes(b: Uint8Array, start: number, end: number): BmffBox[] {
  const boxes: BmffBox[] = [];
  let pos = start;
  let safety = 0;
  while (pos + 8 <= end && safety++ < 20000) {
    let size = readU32BE(b, pos);
    const type = ascii(b, pos + 4, 4);
    let header = 8;
    if (size === 1) {
      if (pos + 16 > end) break;
      size = readU32BE(b, pos + 8) * 4294967296 + readU32BE(b, pos + 12);
      header = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < header || pos + size > end) break;
    boxes.push({ type, start: pos, contentStart: pos + header, end: pos + size });
    pos += size;
  }
  return boxes;
}

const readU64BE = (b: Uint8Array, o: number): number =>
  readU32BE(b, o) * 4294967296 + readU32BE(b, o + 4);

function readVarBE(b: Uint8Array, o: number, size: number): number {
  if (size === 0) return 0;
  if (size === 1) return b[o];
  if (size === 2) return readU16BE(b, o);
  if (size === 4) return readU32BE(b, o);
  if (size === 8) return readU64BE(b, o);
  return 0;
}

const nullEnd = (b: Uint8Array, start: number, end: number): number => {
  let pos = start;
  while (pos < end && b[pos] !== 0) pos++;
  return pos;
};

export function heifBrand(b: Uint8Array): 'HEIC' | 'AVIF' | null {
  if (b.length < 12 || ascii(b, 4, 4) !== 'ftyp') return null;
  const ftyp = readBmffBoxes(b, 0, Math.min(b.length, 128)).find(box => box.type === 'ftyp');
  if (!ftyp) return null;
  const brands = ascii(b, ftyp.contentStart, Math.min(ftyp.end - ftyp.contentStart, 64));
  if (/avif|avis/.test(brands)) return 'AVIF';
  if (/heic|heix|hevc|heim|heis|hevm|hevs|mif1|msf1/.test(brands)) return 'HEIC';
  return null;
}

interface HeifItem {
  id: number;
  type: string;
  name: string;
  contentType: string;
  method: number;
  baseOffset: number;
  extents: { offset: number; length: number }[];
}

function parseHeifItemInfo(b: Uint8Array, box: BmffBox, items: Map<number, HeifItem>): void {
  const version = b[box.contentStart];
  let pos = box.contentStart + 4;
  const count = version === 0 ? readU16BE(b, pos) : readU32BE(b, pos);
  pos += version === 0 ? 2 : 4;
  if (count > 10000) return;

  for (const child of readBmffBoxes(b, pos, box.end)) {
    if (child.type !== 'infe') continue;
    const v = b[child.contentStart];
    let p = child.contentStart + 4;
    let id = 0;
    let type = '';
    let name = '';
    let contentType = '';

    if (v >= 2) {
      id = v === 3 ? readU32BE(b, p) : readU16BE(b, p);
      p += v === 3 ? 4 : 2;
      p += 2;
      type = ascii(b, p, 4);
      p += 4;
      const nameEnd = nullEnd(b, p, child.end);
      name = ascii(b, p, nameEnd - p);
      p = nameEnd + 1;
      if (type === 'mime' && p < child.end) {
        const ctEnd = nullEnd(b, p, child.end);
        contentType = ascii(b, p, ctEnd - p);
      }
    } else {
      id = readU16BE(b, p);
      p += 4;
      const nameEnd = nullEnd(b, p, child.end);
      name = ascii(b, p, nameEnd - p);
      p = nameEnd + 1;
      if (p < child.end) {
        const ctEnd = nullEnd(b, p, child.end);
        contentType = ascii(b, p, ctEnd - p);
      }
    }

    const existing = items.get(id);
    items.set(id, {
      id,
      type,
      name,
      contentType,
      method: existing?.method ?? 0,
      baseOffset: existing?.baseOffset ?? 0,
      extents: existing?.extents ?? []
    });
  }
}

function parseHeifItemLocations(b: Uint8Array, box: BmffBox, items: Map<number, HeifItem>): void {
  const version = b[box.contentStart];
  let pos = box.contentStart + 4;
  if (pos + 2 > box.end) return;
  const offsetSize = b[pos] >> 4;
  const lengthSize = b[pos] & 0x0f;
  pos++;
  const baseOffsetSize = b[pos] >> 4;
  const indexSize = version === 1 || version === 2 ? b[pos] & 0x0f : 0;
  pos++;

  const count = version < 2 ? readU16BE(b, pos) : readU32BE(b, pos);
  pos += version < 2 ? 2 : 4;
  if (count > 10000) return;

  for (let n = 0; n < count; n++) {
    if (pos + 4 > box.end) break;
    const id = version < 2 ? readU16BE(b, pos) : readU32BE(b, pos);
    pos += version < 2 ? 2 : 4;
    let method = 0;
    if (version === 1 || version === 2) {
      method = readU16BE(b, pos) & 0x0f;
      pos += 2;
    }
    pos += 2;
    const baseOffset = readVarBE(b, pos, baseOffsetSize);
    pos += baseOffsetSize;
    if (pos + 2 > box.end) break;
    const extentCount = readU16BE(b, pos);
    pos += 2;
    const extents: { offset: number; length: number }[] = [];
    for (let e = 0; e < extentCount && e < 1000; e++) {
      if (indexSize) pos += indexSize;
      const offset = readVarBE(b, pos, offsetSize);
      pos += offsetSize;
      const length = readVarBE(b, pos, lengthSize);
      pos += lengthSize;
      if (length > 0) extents.push({ offset, length });
      if (pos > box.end) break;
    }
    const existing = items.get(id);
    if (existing) {
      existing.method = method;
      existing.baseOffset = baseOffset;
      existing.extents = extents;
    } else {
      items.set(id, { id, type: '', name: '', contentType: '', method, baseOffset, extents });
    }
  }
}

function parseHeifProperties(b: Uint8Array, box: BmffBox, report: MetaReport): void {
  const ipco = readBmffBoxes(b, box.contentStart, box.end).find(child => child.type === 'ipco');
  if (!ipco) return;
  for (const property of readBmffBoxes(b, ipco.contentStart, ipco.end)) {
    if (property.type !== 'ispe') continue;
    const width = readU32BE(b, property.contentStart + 4);
    const height = readU32BE(b, property.contentStart + 8);
    if (width * height > (report.width || 0) * (report.height || 0)) {
      report.width = width;
      report.height = height;
    }
  }
}

function readHeifItem(
  b: Uint8Array,
  item: HeifItem,
  idatStart: number
): { bytes: Uint8Array; ranges: { offset: number; length: number }[] } {
  if (item.method === 2) return { bytes: new Uint8Array(0), ranges: [] };
  const chunks: Uint8Array[] = [];
  const ranges: { offset: number; length: number }[] = [];
  for (const extent of item.extents) {
    const start = (item.method === 1 ? idatStart : 0) + item.baseOffset + extent.offset;
    const end = start + extent.length;
    if (start < 0 || end > b.length || end <= start) continue;
    ranges.push({ offset: start, length: end - start });
    chunks.push(b.subarray(start, end));
  }
  if (!chunks.length) return { bytes: new Uint8Array(0), ranges: [] };
  const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return { bytes, ranges };
}

/** 查找 TIFF/EXIF 块中的 GPS 数据区间 */
export function findGpsRanges(bytes: Uint8Array, tiffBase: number, limit = bytes.length): WipeRange[] {
  const end = Math.min(bytes.length, limit);
  if (tiffBase < 0 || tiffBase + 8 > end) return [];
  const order = ascii(bytes, tiffBase, 2);
  const little = order === 'II';
  if (!little && order !== 'MM') return [];
  const u16 = (off: number) => (little ? readU16LE(bytes, tiffBase + off) : readU16BE(bytes, tiffBase + off));
  const u32 = (off: number) => (little ? readU32LE(bytes, tiffBase + off) : readU32BE(bytes, tiffBase + off));
  if (u16(2) !== 42) return [];

  const ifd0 = u32(4);
  if (!ifd0 || tiffBase + ifd0 + 2 > end) return [];
  const count = u16(ifd0);
  if (count <= 0 || count > 4096) return [];

  let gpsEntry = -1;
  let gpsOffset = 0;
  for (let i = 0; i < count; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (tiffBase + entry + 12 > end) break;
    if (u16(entry) === 0x8825) {
      gpsEntry = entry;
      gpsOffset = u32(entry + 8);
      break;
    }
  }
  if (gpsEntry < 0) return [];

  const ranges: WipeRange[] = [];
  ranges.push({ offset: tiffBase + gpsEntry + 8, length: 4, label: 'GPS location' });
  if (!gpsOffset || tiffBase + gpsOffset + 2 > end) return ranges;

  const gpsCount = u16(gpsOffset);
  if (gpsCount <= 0 || gpsCount > 4096) return ranges;
  const ifdLength = 2 + gpsCount * 12 + 4;
  if (tiffBase + gpsOffset + ifdLength <= end) {
    ranges.push({ offset: tiffBase + gpsOffset, length: ifdLength, label: 'GPS location' });
  }

  for (let i = 0; i < gpsCount; i++) {
    const entry = gpsOffset + 2 + i * 12;
    if (tiffBase + entry + 12 > end) break;
    const type = u16(entry + 2);
    const valueCount = u32(entry + 4);
    const size = TYPE_SIZE[type];
    if (!size || valueCount > 1000000) continue;
    const length = size * valueCount;
    if (length <= 4) continue;
    const offset = u32(entry + 8);
    if (offset > 0 && tiffBase + offset + length <= end) {
      ranges.push({ offset: tiffBase + offset, length, label: 'GPS location' });
    }
  }
  return ranges;
}

export function parseHeif(b: Uint8Array, report: MetaReport, state: TiffState): void {
  const format = heifBrand(b);
  if (!format) throw new Error('Not a HEIC/AVIF file');
  report.format = format;
  report.mime = format === 'AVIF' ? 'image/avif' : 'image/heic';
  report.inPlaceOnly = true;

  const meta = readBmffBoxes(b, 0, b.length).find(box => box.type === 'meta');
  if (!meta) {
    report.warnings.push('HEIF meta box not found');
    return;
  }

  const metaBoxes = readBmffBoxes(b, meta.contentStart + 4, meta.end);
  const idat = metaBoxes.find(box => box.type === 'idat');
  const idatStart = idat ? idat.contentStart : 0;
  const items = new Map<number, HeifItem>();

  const iinf = metaBoxes.find(box => box.type === 'iinf');
  if (iinf) parseHeifItemInfo(b, iinf, items);
  const iloc = metaBoxes.find(box => box.type === 'iloc');
  if (iloc) parseHeifItemLocations(b, iloc, items);
  const iprp = metaBoxes.find(box => box.type === 'iprp');
  if (iprp) parseHeifProperties(b, iprp, report);

  let foundExif = false;
  let foundXmp = false;

  for (const item of items.values()) {
    if (!item.extents.length) continue;
    const data = readHeifItem(b, item, idatStart);
    if (!data.bytes.length || !data.ranges.length) continue;
    const type = item.type.toLowerCase();
    const name = item.name.toLowerCase();
    const contentType = item.contentType.toLowerCase();

    const isExif = type === 'exif' || name === 'exif';
    const isXmp = (type === 'mime' && (contentType.includes('rdf+xml') || contentType.includes('xmp'))) || name === 'xmp';
    const isIptc = type === 'iptc' || contentType.includes('iptc');

    if (isExif) {
      foundExif = true;
      report.metadataBytes += data.bytes.length;
      for (const range of data.ranges) report.wipes.push({ ...range, label: 'EXIF' });

      const payload = data.bytes;
      let tiffRel = -1;
      if (payload.length >= 8) {
        const marker = ascii(payload, 0, 2);
        if (marker === 'II' || marker === 'MM') tiffRel = 0;
        else if (ascii(payload, 0, 4) === 'Exif') tiffRel = 6;
        else if (payload.length >= 4) {
          const offset = readU32BE(payload, 0);
          tiffRel = 4 + offset;
          if (startsWith(payload, tiffRel, 'Exif\0\0')) tiffRel += 6;
        }
      }
      if (tiffRel < 0 || tiffRel + 8 > payload.length) continue;

      if (data.ranges.length === 1) {
        parseTiff(b, data.ranges[0].offset + tiffRel, state);
        report.locationWipes.push(...findGpsRanges(b, data.ranges[0].offset + tiffRel, data.ranges[0].offset + data.ranges[0].length));
      } else {
        parseTiff(payload, tiffRel, state);
        for (const range of data.ranges) report.locationWipes.push({ ...range, label: 'EXIF' });
      }
    } else if (isXmp) {
      foundXmp = true;
      const text = utf8(data.bytes, 0, data.bytes.length).replace(/\0+$/, '').trim();
      if (text) report.xmp.push(text);
      report.metadataBytes += data.bytes.length;
      for (const range of data.ranges) {
        report.wipes.push({ ...range, label: 'XMP' });
        report.locationWipes.push({ ...range, label: 'XMP' });
      }
    } else if (isIptc) {
      report.iptc = true;
      report.metadataBytes += data.bytes.length;
      for (const range of data.ranges) {
        report.wipes.push({ ...range, label: 'IPTC / Photoshop' });
        report.locationWipes.push({ ...range, label: 'IPTC / Photoshop' });
      }
    }

    if (name.includes('thumbnail') || type === 'thmb') report.hasThumbnail = true;
  }

  if (!foundExif && !foundXmp) report.warnings.push('No EXIF/XMP items found');
}
