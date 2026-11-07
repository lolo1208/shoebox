/**
 * 透明图片的棋盘格底纹。
 *
 * 各图片工具此前各自内联了一份相同的 base64 SVG，统一到这里，
 * 需要时直接用于 `backgroundImage`：
 *
 *   <div style={{ backgroundImage: CHECKERBOARD_BACKGROUND }} />
 */

/** 20×20 的 SVG 纹理：10% 不透明度的黑白棋盘格 */
export const CHECKERBOARD_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyMCcgaGVpZ2h0PScyMCcgZmlsbC1vcGFjaXR5PScwLjEnPjxyZWN0IHg9JzEwJyB3aWR0aD0nMTAnIGhlaWdodD0nMTAnIC8+PHJlY3QgeT0nMTAnIHdpZHRoPScxMCcgaGVpZ2h0PScxMCcgLz48L3N2Zz4=';

/** 可直接赋给 `backgroundImage` 的 CSS 值 */
export const CHECKERBOARD_BACKGROUND = `url("${CHECKERBOARD_DATA_URL}")`;
