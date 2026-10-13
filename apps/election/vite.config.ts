import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

export default defineConfig({
  // Electron loads production HTML through file://, so assets must be relative.
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  // 与 Web 端一致，兼容共享包的 CommonJS 产物。
  optimizeDeps: {
    include: ['@lecpunch/shared']
  },
  build: {
    commonjsOptions: {
      include: [/@lecpunch\/shared/, /node_modules/]
    }
  }
});
