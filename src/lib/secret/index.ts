/**
 * 密码 / 随机密钥生成门面。
 * UI 只依赖本文件，字符集、取样与编码的实现细节留在各自模块。
 */

export * from './types';
export { AMBIGUOUS_CHARACTERS, buildCharset, SYMBOL_CHARSETS, type CharsetBuild } from './charset';
export { countSecretSpace, fallingFactorial, log2Exact, type SecretSpaceOptions } from './combinations';
export { clampInteger, KEY_BYTES, PASSWORD_LENGTH, SECRET_COUNT } from './limits';
export { generatePasswordBatch } from './password';
export { encodeKeyBytes, generateKeyBatch, keyEntropyBits } from './key';
export {
  classifyStrength,
  CRACK_GUESSES_PER_SECOND,
  estimateCrackTime,
  formatCrackValue,
  strengthProgress,
  type CrackEstimate,
  type CrackTimeUnit,
  type StrengthLevel,
} from './entropy';
