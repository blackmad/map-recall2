import compression from 'compression';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // The Amsterdam extracts are large JSON: streets-routing.json alone is
  // 9.7 MB raw and 1.3 MB gzipped, and it is fetched on every route. Nothing
  // was compressing it.
  app.use(compression());
  app.use(express.json());

  // API routes
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    // Vite's SPA fallback otherwise rewrites this directory URL to the React
    // root index. Serve the standalone vanilla-JS prototype first.
    const canalDrivePath = path.join(process.cwd(), 'public', 'canal-drive');
    app.use('/canal-drive', express.static(canalDrivePath, {
      index: 'index.html',
      // Canal Recall still uses unversioned browser bundles. Require
      // revalidation so a normal refresh cannot keep an obsolete HUD/player
      // renderer after a deploy or local rebuild.
      setHeaders: (response) => response.setHeader('Cache-Control', 'no-cache'),
    }));

    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
