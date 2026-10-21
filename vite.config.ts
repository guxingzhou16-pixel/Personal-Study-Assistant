import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'content-security-policy',
      transformIndexHtml(html, context) {
        return html.replace(
          '__SCRIPT_POLICY__',
          context.server ? "'self' 'unsafe-inline'" : "'self'",
        );
      },
    },
  ],
  clearScreen: false,
  base: './',
  server: {
    port: 1420,
    strictPort: true,
    host: '127.0.0.1',
    watch: {
      ignored: [
        '**/artifacts/**',
        '**/release/**',
        '**/coverage/**',
        '**/test-results/**',
        '**/playwright-report/**',
        '**/user-data/**',
        '**/dist-electron/**',
        '**/markitdown-*/**',
      ],
    },
  },
  envPrefix: ['VITE_'],
  build: { target: 'es2022' },
  test: { include: ['electron/**/*.test.ts', 'src/**/*.test.ts'] },
});
