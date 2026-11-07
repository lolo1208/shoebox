/**
 * 图片转换工具的公共类型。
 *
 * 该模块不依赖 React / DOM：UI 层与逻辑层共用同一份数据形状，
 * 页面排版所需的 PDF 类型统一从 @/lib/pdf 透出，避免两处定义漂移。
 */

import type { PdfFitMode, PdfOrientation, PdfPageSize } from '@/lib/pdf';

/** 图片输出格式 */
export type ImageFormat = 'jpeg' | 'png' | 'webp';

/** 导出目标：单张/批量图片，或合并为一个 PDF */
export type ConvertTarget = 'image' | 'pdf';

/** PDF 内位图的压缩方式 */
export type PdfCompression = 'jpeg' | 'lossless';

/** 固定纸张栅格化时使用的渲染分辨率 */
export type PdfRenderDpi = 96 | 150 | 300;

/** 图片输出参数 */
export interface ImageOutputOptions {
  format: ImageFormat;
  /** JPEG / WebP 质量，范围 0.1–1 */
  quality: number;
  /** 是否用 UPNG 做调色板量化压缩（仅 PNG） */
  pngCompress: boolean;
  /** 量化后的颜色数（仅 PNG 压缩时生效） */
  pngColors: number;
}

/** PDF 输出参数 */
export interface PdfOutputOptions {
  pageSize: PdfPageSize;
  orientation: PdfOrientation;
  /** 页边距（毫米） */
  marginMm: number;
  fit: PdfFitMode;
  /** 固定纸张的渲染分辨率；'fit' 纸张始终按原图像素输出 */
  dpi: PdfRenderDpi;
  compression: PdfCompression;
  /** JPEG 压缩质量 */
  quality: number;
  /** 文档标题，同时作为下载文件名主部 */
  title: string;
}

/** 持久化到本地存储的完整设置 */
export interface ConverterSettings {
  target: ConvertTarget;
  image: ImageOutputOptions;
  pdf: PdfOutputOptions;
}

/** 导入队列中的一张图片 */
export interface SourceImage {
  id: string;
  /** 原始文件；导出时按需解码，不在内存中常驻位图 */
  file: File;
  /** 列表缩略图的 ObjectURL（小尺寸 JPEG），生命周期由队列统一管理 */
  thumbnailUrl: string;
  name: string;
  /** 字节数 */
  size: number;
  /** 按 EXIF 方向校正后的像素宽度 */
  width: number;
  /** 按 EXIF 方向校正后的像素高度 */
  height: number;
}

/** 单个输出文件 */
export interface ConversionArtifact {
  blob: Blob;
  fileName: string;
}

/** 一次导出任务的最终结果 */
export interface ExportResult extends ConversionArtifact {
  mime: string;
  /** 结果中包含的图片数量 */
  count: number;
}

/** 导出过程回调；ratio 为 0–1 的单调递增进度 */
export interface ExportHandlers {
  onProgress?: (ratio: number) => void;
  /** 每处理完一项检查一次；返回 true 则以 ConversionError('cancelled') 中断 */
  shouldCancel?: () => boolean;
}
