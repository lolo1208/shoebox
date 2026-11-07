/** 浏览器端图片加载助手（按需复用，避免各工具重复实现） */

/** 通过 URL / ObjectURL / DataURL 加载为可绘制的 HTMLImageElement */
export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
    image.decoding = 'async';
    image.src = src;
  });
}
