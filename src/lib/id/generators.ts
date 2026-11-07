/**
 * 浏览器端唯一 ID 生成器：ULID、NanoID、CUID(v1) 与 CUID2。
 * 全部使用 Web Crypto 在本地生成，数据不出浏览器。
 */

import CryptoJS from 'crypto-js';

/* ------------------------------------------------------------------ */
/* 公共工具 */
/* ------------------------------------------------------------------ */

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return bytes;
}

/* ------------------------------------------------------------------ */
/* ULID */
/* ------------------------------------------------------------------ */

/** Crockford's Base32 — time ordered, excludes I/L/O/U to avoid confusion. */
export const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const MAX_RANDOM_80 = (1n << 80n) - 1n;

let lastUlidTime = -1;
let lastUlidRandom = 0n;

function encodeRandom80(value: bigint): string {
  const chars = new Array<string>(16);
  let rest = value;
  for (let i = 15; i >= 0; i--) {
    chars[i] = CROCKFORD[Number(rest & 31n)];
    rest >>= 5n;
  }
  return chars.join('');
}

function random80(): bigint {
  const bytes = randomBytes(10);
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

/**
 * 生成 ULID。同一毫秒内重复调用会递增随机部分，
 * 保证结果单调递增且不冲突。
 * 显式传入 timestamp 时按原值编码，不影响内部状态。
 */
export function generateUlid(timestamp?: number): string {
  if (timestamp !== undefined) {
    return encodeTime48(timestamp) + encodeRandom80(random80());
  }

  let time = Date.now();
  let random: bigint;

  if (time <= lastUlidTime) {
    time = lastUlidTime;
    random = lastUlidRandom + 1n;
    if (random > MAX_RANDOM_80) {
      time += 1;
      random = 0n;
    }
  } else {
    random = random80();
  }

  lastUlidTime = time;
  lastUlidRandom = random;

  return encodeTime48(time) + encodeRandom80(random);
}

function encodeTime48(time: number): string {
  const chars = new Array<string>(10);
  let rest = time;
  for (let i = 9; i >= 0; i--) {
    chars[i] = CROCKFORD[rest % 32];
    rest = Math.floor(rest / 32);
  }
  return chars.join('');
}

/** 读取 ULID 中的 48 位毫秒时间戳 */
export function ulidTimestamp(ulid: string): number | null {
  if (ulid.length !== 26) return null;
  let time = 0;
  for (let i = 0; i < 10; i++) {
    const index = CROCKFORD.indexOf(ulid[i].toUpperCase());
    if (index < 0) return null;
    time = time * 32 + index;
  }
  return time;
}

/** 将 ULID 时间戳格式化为 HH:mm:ss.SSS（本地时间） */
export function formatUlidTime(ulid: string): string {
  const ms = ulidTimestamp(ulid);
  if (ms === null) return '';
  const date = new Date(ms);
  const pad = (value: number, length = 2) => String(value).padStart(length, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(ms % 1000, 3)}`;
}

/* ------------------------------------------------------------------ */
/* NanoID */
/* ------------------------------------------------------------------ */

export const NANOID_PRESETS = {
  url: 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict',
  alphanumeric: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  lowercase: 'abcdefghijklmnopqrstuvwxyz0123456789',
  numbers: '0123456789',
} as const;

export type NanoidPreset = keyof typeof NANOID_PRESETS;

/**
 * 使用无偏拒绝采样生成 NanoID（与官方实现一致），
 * 字符集少于 2 个字符时抛错。
 */
export function generateNanoId(size = 21, alphabet: string = NANOID_PRESETS.url): string {
  const chars = Array.from(new Set(Array.from(alphabet)));
  if (chars.length < 2) throw new Error('alphabet-too-short');

  const length = Math.max(1, Math.min(512, Math.floor(size)));
  const mask = (2 << (31 - Math.clz32((chars.length - 1) | 1))) - 1;

  let id = '';
  while (id.length < length) {
    const bytes = randomBytes(Math.max(16, length - id.length));
    for (let i = 0; i < bytes.length; i++) {
      const index = bytes[i] & mask;
      if (index < chars.length) {
        id += chars[index];
        if (id.length === length) break;
      }
    }
  }
  return id;
}

/* ------------------------------------------------------------------ */
/* CUID */
/* ------------------------------------------------------------------ */

let cuidCounter = 0;
let cuidFingerprint: string | null = null;

/** 当前浏览器的 4 位 base36 指纹，每个会话只计算一次 */
function getFingerprint(): string {
  if (cuidFingerprint) return cuidFingerprint;

  const parts = [
    typeof navigator !== 'undefined' ? navigator.userAgent : '',
    typeof navigator !== 'undefined' ? navigator.language : '',
    typeof navigator !== 'undefined' ? String((navigator as Navigator & { hardwareConcurrency?: number }).hardwareConcurrency ?? '') : '',
    typeof screen !== 'undefined' ? `${screen.width}x${screen.height}x${screen.colorDepth}` : '',
    String(new Date().getTimezoneOffset()),
  ];

  const hash = CryptoJS.MD5(parts.join('#')).toString();
  let fingerprint = '';
  for (let i = 0; i < 4; i++) {
    fingerprint += (parseInt(hash.substring(i * 2, i * 2 + 2), 16) % 36).toString(36);
  }
  cuidFingerprint = fingerprint;
  return fingerprint;
}

function base36Block(): string {
  const bytes = randomBytes(4);
  let value = 0;
  for (const byte of bytes) value = value * 256 + byte;
  return (value % 36 ** 4).toString(36).padStart(4, '0');
}

/**
 * 经典 CUID：c + base36 时间戳 + 计数器 + 浏览器指纹 + 随机数，
 * 共 25 位，同源多标签页也不会冲突。
 */
export function generateCuid(): string {
  if (cuidCounter >= 36 ** 4) cuidCounter = 0;
  cuidCounter++;
  return (
    'c' +
    Date.now().toString(36) +
    cuidCounter.toString(36).padStart(4, '0') +
    getFingerprint() +
    base36Block() +
    base36Block()
  );
}

/* ------------------------------------------------------------------ */
/* CUID2 */
/* ------------------------------------------------------------------ */

let cuid2Counter = 0;

/**
 * CUID2：对计数器、随机数、时间戳、指纹与盐做 SHA3-512，
 * 再以 base36 编码。首字符必为字母，可安全用作 DOM id 或变量名。
 */
export function generateCuid2(length = 24, salt = 'shoebox'): string {
  cuid2Counter++;
  const size = Math.max(8, Math.min(32, Math.floor(length)));

  const random = CryptoJS.enc.Hex.stringify(CryptoJS.lib.WordArray.random(16));
  const input = [
    cuid2Counter.toString(36),
    random,
    Date.now().toString(36),
    getFingerprint(),
    salt,
  ].join('');

  let hash = BigInt('0x' + CryptoJS.SHA3(input, { outputLength: 512 }).toString()).toString(36);
  if (hash.length < size) {
    // 极少见：确定性扩展而不是返回过短的 ID
    while (hash.length < size) {
      hash += BigInt('0x' + CryptoJS.SHA3(hash, { outputLength: 512 }).toString()).toString(36);
    }
  }

  let id = hash.slice(0, size);
  if (!/^[a-z]/.test(id)) {
    id = String.fromCharCode(97 + (randomBytes(1)[0] % 26)) + id.slice(1);
  }
  return id;
}
