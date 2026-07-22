import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'strip-built-crossorigin',
      transformIndexHtml(html) {
        return html.replace(/\s+crossorigin(="")?/g, '');
      },
    },
  ],
  build: {
    assetsDir: 'app-assets',
    target: 'es2018',
    chunkSizeWarningLimit: 2500,
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    }
  }
})
