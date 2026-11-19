/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    // Server tests start a real MongoDB, which takes a few seconds the first time.
    test: { testTimeout: 30000, hookTimeout: 120000 },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // The browser talks only to this origin; API calls are passed on to the server.
      proxy: { '/api': 'http://127.0.0.1:3004' },
    },
  };
});
