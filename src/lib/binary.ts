/**
 * 二进制辅助。
 */

/**
 * 把 Uint8Array 交给 Blob 构造函数。
 *
 * TypeScript 5.7 起 `Uint8Array<ArrayBufferLike>` 与 `BlobPart` 不再直接兼容
 * （SharedArrayBuffer 可能不可转移），这里做一次显式转换，运行时无开销。
 */
export function asBlobPart(bytes: Uint8Array): BlobPart {
  return bytes as unknown as BlobPart;
}
