/**
 * PDF 模块的公共类型。
 *
 * 该层只描述「文档 → 字节」需要的形状，不依赖 React，也不假设图片从哪里来：
 * 图片光栅化与压缩由调用方（@/lib/image/convert）完成后传入已编码位图。
 */

/** 页面尺寸（点，1pt = 1/72 英寸） */
export interface PdfPageBox {
  width: number;
  height: number;
}

/**
 * 页面内的矩形。
 *
 * 坐标系为「左上角原点、y 轴向下」，与 canvas 一致：
 * 本项目每页都是一张整页位图，因而不需要在渲染阶段做 y 轴翻转。
 */
export interface PdfPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 纸张预设标识；'fit' 表示页面尺寸跟随图片 */
export type PdfPageSize = 'fit' | 'a4' | 'a5' | 'letter' | 'legal';

/** 纸张方向；'auto' 根据图片横竖自动选择 */
export type PdfOrientation = 'auto' | 'portrait' | 'landscape';

/** 图片在页面内容区中的适配方式 */
export type PdfFitMode = 'contain' | 'cover' | 'stretch';

/** Bitmap 的编码方式：JPEG（DCTDecode）或无损 RGB（FlateDecode） */
export type PdfImageFilter = 'DCTDecode' | 'FlateDecode';

/** 已编码、可直接写入 PDF 的位图数据 */
export interface PdfImageData {
  width: number;
  height: number;
  /** 每像素位深，当前仅支持 8 */
  bitsPerComponent: number;
  colorSpace: 'DeviceRGB' | 'DeviceGray';
  /** null 表示未压缩的原始像素 */
  filter: PdfImageFilter | null;
  data: Uint8Array;
}

/** 一页：整页铺满位图 + 纸张尺寸 */
export interface PdfPageInput {
  box: PdfPageBox;
  /** 位图会等比拉伸到整页大小，排版在光栅化阶段完成 */
  image: PdfImageData;
}

/** 文档元信息（写入 Info 字典） */
export interface PdfDocumentMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  /** PDF 日期字符串，形如 D:20260101120000 */
  creationDate?: string;
}
