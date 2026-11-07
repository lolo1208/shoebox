/**
 * 图片主色调提取（调色板生成）模块入口。
 *
 * 工具注册表只依赖本文件；提取算法位于 @/lib/image/palette，
 * 展示组件与 hooks 可在本目录内独立演进。
 */
export { default } from './PaletteExtractor';
export { DEFAULT_PALETTE_OPTIONS, MAX_PALETTE_COUNT, MIN_PALETTE_COUNT } from './constants';
