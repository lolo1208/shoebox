/**
 * Base64 / Base32 / URL 编解码工具的模块入口。
 * 工具注册表只依赖本文件，内部结构（主组件 / 子组件 / 示例数据）可按需演进。
 */
export { default } from './CodecTool';
export type { CodecDirection, CodecFamily, CodecOptions } from '@/lib/codec';
