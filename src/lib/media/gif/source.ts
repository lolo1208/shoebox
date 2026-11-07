/**
 * 源视频校验与探测。
 *
 * 只使用浏览器原生 <video> 元数据，不上传文件、不依赖 WASM；
 * GIF 的帧率由用户指定，因此无需像抽帧工具那样额外估算源帧率。
 */

import type { GifSourceInfo } from './types';

/** 常见的视频扩展名（部分容器 MIME 为空，需要靠扩展名兜底） */
const VIDEO_EXTENSION = /\.(mp4|m4v|webm|ogv|ogg|mov|mkv|avi|flv|wmv|3gp|ts|m2ts|mpg|mpeg)$/i;

/** 判断文件是否可能是视频（最终能否解码以 <video> / ffmpeg 为准） */
export function isVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true;
  return VIDEO_EXTENSION.test(file.name);
}

/** 读取已加载元数据的视频信息 */
export function readSourceInfo(video: HTMLVideoElement): GifSourceInfo {
  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
  return {
    duration,
    width: video.videoWidth || 0,
    height: video.videoHeight || 0,
  };
}

/**
 * 提取安全的扩展名（含点号）。
 * ffmpeg 主要靠内容探测格式，但保留扩展名能让个别容器/分离器更稳定。
 */
export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) return '';
  const ext = fileName.slice(dot).toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : '';
}
