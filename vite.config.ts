import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { apiDevPlugin } from './api-dev-plugin.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    appType: 'spa',
    base: './',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), tailwindcss(), apiDevPlugin(env)],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
