import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages serves this repo from a /map-recall2/ subpath, but the
  // Firebase Hosting sites each serve from their own domain root. Keying this
  // off GITHUB_ACTIONS gave every CI build the Pages subpath, so the deploy
  // target has to say so explicitly.
  base: process.env.DEPLOY_TARGET === 'github-pages' ? '/map-recall2/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
