
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Vendor chunk layout for the production build (name -> packages it contains).
// 工具都是懒加载的，库按“工具簇”拆分，避免打开一个小工具却拖下整个 vendor 包。
const CHUNK_GROUPS: Array<[string, string[]]> = [
  ['vendor-react', ['react', 'react-dom', 'scheduler']],
  ['vendor-ui', ['lucide-react']],
  ['vendor-crypto', ['crypto-js']],
  ['vendor-markdown', ['marked', 'highlight.js']],
  ['vendor-image', ['html2canvas', 'upng-js', 'qrcode']],
  ['vendor-data', ['js-yaml', 'lunar-javascript', 'lodash']],
  ['vendor-zip', ['jszip']],
  ['vendor-media', ['mediainfo.js', '@ffmpeg/ffmpeg', '@ffmpeg/util', 'jsmediatags', 'browser-id3-writer']],
  // 注意：@imgly/background-removal 故意不单独分包，让它直接进入 BackgroundRemover 的 chunk。
  // 否则 rolldown 会把几 KB 的共享 runtime helper 合并进这个小 chunk，
  // 导致它重新变成首屏静态依赖。
];

// Resolves the owning package name of a module id, e.g.
// /x/node_modules/.pnpm/react@18.3.1/node_modules/react/index.js -> react
function packageNameFromId(id: string): string | undefined {
  const normalized = id.replace(/\\/g, '/');
  const marker = 'node_modules/';
  const index = normalized.lastIndexOf(marker);
  if (index === -1) return;
  const rest = normalized.slice(index + marker.length);
  const segments = rest.split('/');
  if (segments[0]?.startsWith('@')) return `${segments[0]}/${segments[1]}`;
  return segments[0];
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'mock-node-modules',
      resolveId(id) {
        // Intercept requests for the aliases defined in resolve.alias
        if (id === 'virtual:buffer' || id === 'virtual:long') {
          return '\0' + id;
        }
      },
      load(id) {
        if (id === '\0virtual:buffer') {
          // Minimal Buffer mock to satisfy imports
          return `
            export const Buffer = {
              isBuffer: () => false,
              from: (data) => data instanceof Uint8Array ? data : new Uint8Array(data),
              alloc: (size) => new Uint8Array(size),
              concat: (arr) => {
                 let len = 0;
                 for (let i = 0; i < arr.length; i++) len += arr[i].length;
                 const out = new Uint8Array(len);
                 let offset = 0;
                 for (let i = 0; i < arr.length; i++) {
                   out.set(arr[i], offset);
                   offset += arr[i].length;
                 }
                 return out;
              }
            };
            export default Buffer;
          `;
        }
        if (id === '\0virtual:long') {
          // Minimal Long mock
          return `
            export default {
              fromBits: () => 0,
              fromNumber: () => 0,
              fromString: () => 0
            };
          `;
        }
      }
    },
    {
      name: 'remove-cdn-on-build',
      transformIndexHtml(html) {
        // Only run this during build
        if (process.env.NODE_ENV === 'production') {
          // CDN 版 Tailwind 与 importmap 只在无本地构建的正网环境需要，
          // 打包后它们只会增加首屏解析/远程请求开销，因此一并移除。
          return html
            .replace(/<script[^>]*id="dev-cdn"[^>]*>[\s\S]*?<\/script>/g, '')
            .replace(/<script type="importmap">[\s\S]*?<\/script>/g, '');
        }
        return html;
      },
    },
    {
      name: 'block-wasm-emission',
      resolveId(id) {
        // Intercept .wasm imports from libraries (like onnxruntime-web)
        if (id.endsWith('.wasm')) {
          return id;
        }
      },
      load(id) {
        if (id.endsWith('.wasm')) {
          // Return a mock export. This prevents Vite from processing the file as an asset
          // via standard import mechanisms.
          return 'export default "/mock-wasm-path"'; 
        }
      },
      generateBundle(_options, bundle) {
        // This is the safety net: Iterate through all generated assets and delete any .wasm files.
        // This catches files referenced via new URL('...', import.meta.url) which bypass the load hook.
        for (const fileName in bundle) {
          if (fileName.endsWith('.wasm')) {
            console.log('Forcefully removing WASM asset from build:', fileName);
            delete bundle[fileName];
          }
        }
      }
    }
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'buffer': 'virtual:buffer',
      'long': 'virtual:long'
    }
  },
  base: './',
  // FFmpeg's worker entry must be served as a real module, not rewritten by dep optimization.
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  build: {
    rollupOptions: {
      output: {
        // Rolldown (Vite 8) only accepts the function form of manualChunks.
        manualChunks(id) {
          // Vite 的 preload 辅助函数是公共模块，必须单独成块；
          // 否则会被并入某个懒加载 vendor 包，导致整个包被迫在首屏加载。
          if (id.includes('vite/preload-helper')) return 'vite-runtime';
          const pkg = packageNameFromId(id);
          if (!pkg) return;
          return CHUNK_GROUPS.find(([, packages]) => packages.includes(pkg))?.[0];
        },
      },
    },
    chunkSizeWarningLimit: 800,
  }
});
