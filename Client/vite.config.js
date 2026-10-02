import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5080',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    cssMinify: true,
    rollupOptions: {
      output: {
        // React + router rarely change — keep them in their own long-cached chunk
        manualChunks: {
          react: ['react', 'react-dom', 'react-dom/client', 'react-router', 'react-router-dom'],
        },
      },
    },
  },
});
