
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
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
  // This ensures assets use relative paths (./) instead of absolute paths (/)
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['lucide-react'],
          'vendor-utils': ['crypto-js', 'marked', 'qrcode', 'upng-js', 'html2canvas'],
          'vendor-zip': ['jszip'],
          'vendor-media': ['mediainfo.js', '@ffmpeg/ffmpeg', '@ffmpeg/util'],
          'vendor-ai': ['@xenova/transformers', '@imgly/background-removal'],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  }
});