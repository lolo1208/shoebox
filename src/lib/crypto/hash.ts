/// <reference lib="dom" />
/**
 * 哈希计算工具：MD5（crypto-js）与 SHA-1/256/384/512（Web Crypto）及对应 HMAC。
 * 所有计算均在本地完成。
 */

import CryptoJS from 'crypto-js';

export { formatBytes } from '@/lib/format';

export type HashAlgo = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';
export type OutputFormat = 'hex' | 'HEX' | 'base64';

export const HASH_ALGOS: HashAlgo[] = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

export const ALGO_BITS: Record<HashAlgo, number> = {
  MD5: 128,
  'SHA-1': 160,
  'SHA-256': 256,
  'SHA-384': 384,
  'SHA-512': 512,
};

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

/** 十六进制摘要转为目标输出格式 */
export function formatDigest(hex: string, format: OutputFormat): string {
  if (format === 'HEX') return hex.toUpperCase();
  if (format === 'base64') return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Hex.parse(hex));
  return hex.toLowerCase();
}

/** 当前格式下摘要长度的简短标签 */
export function digestLength(bits: number, format: OutputFormat): number {
  if (format === 'hex' || format === 'HEX') return (bits / 4) | 0;
  return Math.ceil(bits / 8 / 3) * 4;
}

const subtle = (): SubtleCrypto => {
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : undefined;
  if (!cryptoObj?.subtle) throw new Error('Web Crypto API is not available');
  return cryptoObj.subtle;
};

async function digestBytes(algo: Exclude<HashAlgo, 'MD5'>, data: ArrayBuffer | Uint8Array): Promise<string> {
  const buffer = await subtle().digest(algo, data as BufferSource);
  return toHex(buffer);
}

async function hmacBytes(
  algo: Exclude<HashAlgo, 'MD5'>,
  key: string,
  data: ArrayBuffer | Uint8Array
): Promise<string> {
  const cryptoKey = await subtle().importKey(
    'raw',
    encoder.encode(key) as BufferSource,
    { name: 'HMAC', hash: algo },
    false,
    ['sign']
  );
  const signature = await subtle().sign('HMAC', cryptoKey, data as BufferSource);
  return toHex(signature);
}

/* ------------------------------------------------------------------ */
/* 文本 */
/* ------------------------------------------------------------------ */

/** 单算法哈希字符串，返回小写十六进制摘要 */
export async function hashText(text: string, algo: HashAlgo, key = ''): Promise<string> {
  const hmac = key.length > 0;
  if (algo === 'MD5') {
    return (hmac ? CryptoJS.HmacMD5(text, key) : CryptoJS.MD5(text)).toString(CryptoJS.enc.Hex);
  }
  const bytes = encoder.encode(text);
  return hmac ? hmacBytes(algo, key, bytes) : digestBytes(algo, bytes);
}

/** 一次计算多个算法的字符串哈希 */
export async function hashTextBatch(
  text: string,
  algos: HashAlgo[],
  key = ''
): Promise<Partial<Record<HashAlgo, string>>> {
  const entries = await Promise.all(
    algos.map(async (algo) => [algo, await hashText(text, algo, key)] as const)
  );
  return Object.fromEntries(entries) as Partial<Record<HashAlgo, string>>;
}

/* ------------------------------------------------------------------ */
/* 文件 */
/* ------------------------------------------------------------------ */

const CHUNK_SIZE = 4 * 1024 * 1024;

/** 分块计算 MD5，避免大文件一次性占用内存 */
async function md5FileChunked(file: File, onProgress?: (ratio: number) => void): Promise<string> {
  const hasher = CryptoJS.algo.MD5.create();
  const chunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

  for (let index = 0; index < chunks; index++) {
    const start = index * CHUNK_SIZE;
    const blob = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));
    const buffer = await blob.arrayBuffer();
    if (buffer.byteLength > 0) hasher.update(CryptoJS.lib.WordArray.create(buffer));
    onProgress?.((index + 1) / chunks);
    // 分块之间让出主线程，保证进度条刷新
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return hasher.finalize().toString(CryptoJS.enc.Hex);
}

/** 分块读取文件，保证进度更新且不阻塞主线程（Web Crypto 仍需完整缓冲区）。 */
async function readWholeFile(file: File, onProgress?: (ratio: number) => void): Promise<Uint8Array> {
  const buffer = new Uint8Array(file.size);
  if (file.size === 0) return buffer;

  const chunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  for (let index = 0; index < chunks; index++) {
    const start = index * CHUNK_SIZE;
    const blob = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));
    const part = await blob.arrayBuffer();
    buffer.set(new Uint8Array(part), start);
    onProgress?.((index + 1) / chunks);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return buffer;
}

/** 计算文件哈希：无密钥 MD5 分块流式处理，其余算法与 HMAC 走 Web Crypto 一次性读取。 */
export async function hashFileBatch(
  file: File,
  algos: HashAlgo[],
  key = '',
  onProgress?: (percent: number) => void
): Promise<Partial<Record<HashAlgo, string>>> {
  const hmac = key.length > 0;
  const wantsMd5 = algos.includes('MD5');
  const shaAlgos = algos.filter((algo): algo is Exclude<HashAlgo, 'MD5'> => algo !== 'MD5');
  const results: Partial<Record<HashAlgo, string>> = {};

  const needsWholeFile = shaAlgos.length > 0 || (wantsMd5 && hmac);
  const md5Streams = wantsMd5 && !hmac;
  // 进度条按流式 MD5 与完整读取两阶段分配
  const md5Share = md5Streams ? (needsWholeFile ? 0.4 : 1) : 0;

  if (md5Streams) {
    results.MD5 = await md5FileChunked(file, (ratio) => onProgress?.(Math.round(ratio * md5Share * 100)));
  }

  if (needsWholeFile) {
    const bytes = await readWholeFile(file, (ratio) =>
      onProgress?.(Math.round((md5Share + (1 - md5Share) * ratio) * 100))
    );
    if (wantsMd5 && hmac) {
      results.MD5 = CryptoJS.HmacMD5(CryptoJS.lib.WordArray.create(bytes), key).toString(CryptoJS.enc.Hex);
    }
    for (const algo of shaAlgos) {
      results[algo] = hmac ? await hmacBytes(algo, key, bytes) : await digestBytes(algo, bytes);
    }
  }

  onProgress?.(100);
  return results;
}

