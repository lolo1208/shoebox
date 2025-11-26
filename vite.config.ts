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
          'vendor-video': ['mediainfo.js'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});