
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
          return html.replace(/<script[^>]*id="dev-cdn"[^>]*>[\s\S]*?<\/script>/g, '');
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
      'buffer': 'virtual:buffer',
      'long': 'virtual:long'
    }
  },
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['lucide-react'],
          'vendor-utils': ['crypto-js', 'marked', 'qrcode', 'upng-js', 'html2canvas', 'highlight.js', 'lunar-javascript'],
          'vendor-zip': ['jszip'],
          'vendor-media': ['mediainfo.js', '@ffmpeg/ffmpeg', '@ffmpeg/util'],
          'vendor-ai': ['@imgly/background-removal']
        },
      },
    },
    chunkSizeWarningLimit: 800,
  }
});
