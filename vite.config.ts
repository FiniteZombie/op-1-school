import { execSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves 404.html for unknown paths, so a copy of the app shell
// lets deep links like /op-1-school/dev/spine?dev load and route client-side.
function spaFallback404(): Plugin {
  let outDir = 'dist';
  return {
    name: 'op-1-school:spa-fallback-404',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'));
    },
  };
}

// The bug report's `commit` (`__APP_COMMIT__`, src/env.d.ts): CI's commit, else the checkout's.
function buildCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown';
  }
}

// placeholder: the dark theme's background (`THEME_COLORS.dark` in src/ui/theme.ts,
// `--op-bg` in src/ui/tokens.css), until the owner picks the palette.
const themeColor = '#111111';

export default defineConfig({
  base: '/op-1-school/',
  define: {
    __APP_COMMIT__: JSON.stringify(buildCommit()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'op-1-school',
        short_name: 'op-1-school',
        display: 'standalone',
        theme_color: themeColor,
        background_color: themeColor,
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globIgnores: ['404.html'],
        navigateFallback: 'index.html',
      },
    }),
    spaFallback404(),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
});
