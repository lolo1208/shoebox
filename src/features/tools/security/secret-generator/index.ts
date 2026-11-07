/**
 * 密码 / 随机密钥生成器模块入口。
 *
 * 工具注册表只依赖本文件；生成算法位于 `@/lib/secret`，
 * 面板组件与状态 hooks 可在本目录内独立演进。
 */
export { default } from './SecretGenerator';
export {
  DEFAULT_KEY_OPTIONS,
  DEFAULT_PASSWORD_OPTIONS,
  KEY_PRESETS,
  PASSWORD_PRESETS,
  resolvePasswordPresetId,
  type KeyPreset,
  type PasswordPreset,
} from './constants';
