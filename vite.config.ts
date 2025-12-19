import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        broadcaster: resolve(__dirname, 'broadcaster.html'),
        viewer: resolve(__dirname, 'viewer.html'),
        broadcasterJs: resolve(__dirname, 'broadcaster.js'),
        viewerJs: resolve(__dirname, 'viewer.js'),
        app: resolve(__dirname, 'app.js'),
      },
    },
  },
});
