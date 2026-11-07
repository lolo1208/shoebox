import type { CodecDirection, CodecFamily } from '@/lib/codec';

/** 各编码族的示例输入，按方向区分：编码示例为原文，解码示例为已编码文本 */
export const CODEC_SAMPLES: Record<CodecFamily, Record<CodecDirection, string>> = {
  base64: {
    encode: 'Shoebox 鞋盒 · 本地 Base64 编解码',
    decode: 'QmFzZTY0IOino+eggeekuuS+i++8mlNob2Vib3gg6Z6L55uSIOKchQ==',
  },
  base32: {
    encode: 'Base32 示例：Shoebox 鞋盒',
    decode: 'IJQXGZJTGIQORJ5D46QIDZ5EXLSL5C7PXSNFG2DPMVRG66BA5GPIXZ43SI======',
  },
  url: {
    encode: 'https://example.com/搜索?q=Shoebox 鞋盒&lang=zh-CN',
    decode: 'https%3A%2F%2Fexample.com%2F%E6%90%9C%E7%B4%A2%3Fq%3DShoebox%20%E9%9E%8B%E7%9B%92%26lang%3Dzh-CN',
  },
};
