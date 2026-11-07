/**
 * 图片转换（图片格式 / PDF）模块入口。
 *
 * 工具注册表只依赖本文件；转换与排版逻辑位于 @/lib/image/convert，
 * PDF 序列化位于 @/lib/pdf，展示组件与 hooks 可在本目录内独立演进。
 */
export { default } from './ImageConverter';
export { SETTINGS_STORAGE_KEY } from './constants';
