import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // `vite build --mode quiz` is the Map Quest copy served at /quiz/ on the
  // Canal Recall site (scripts/assemble-canalrecall-site.mjs). public/ is
  // already copied into dist/ by the default build, and the canal site serves
  // the extracts and canal-drive assets from its own root, so this build ships
  // only the app (src/mapQuestSite.ts points it at the root-level files).
  const quiz = mode === 'quiz';
  return {
    // GitHub Pages serves this repo from a /map-recall2/ subpath, but the
    // Firebase Hosting sites each serve from their own domain root. Keying this
    // off GITHUB_ACTIONS gave every CI build the Pages subpath, so the deploy
    // target has to say so explicitly.
    base: quiz ? '/quiz/' : process.env.DEPLOY_TARGET === 'github-pages' ? '/map-recall2/' : '/',
    plugins: [react(), tailwindcss()],
    // Source maps for Sentry without serving them: `hidden` omits the
    // sourceMappingURL comment; the deploy workflow uploads, then deletes them.
    build: quiz
      ? { outDir: 'dist-quiz', emptyOutDir: true, copyPublicDir: false, sourcemap: 'hidden' }
      : { sourcemap: 'hidden' },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
    },
  };
});
