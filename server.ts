import compression from 'compression';
import express from 'express';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'path';
import { createServer as createViteServer } from 'vite';

type ReviewRecord = {
  id: string;
  review?: unknown;
};

type NeighborhoodPayload = {
  token: string;
  version: string;
  sourceHash: string;
  generatedAt: string;
  omitted?: unknown;
  policy?: unknown;
  stats: Record<string, unknown>;
  records: ReviewRecord[];
  events: Array<{
    id: string;
    action: string;
    at: string;
    review?: unknown;
    suggestionShown?: boolean;
    reviewContext?: unknown;
  }>;
};

type SavedState = {
  reviews: Record<string, unknown>;
  events: NeighborhoodPayload['events'];
  token: string;
};

const baseDataPath = path.join(process.cwd(), 'public', 'data', 'da-costa-block', 'neighbourhood.json');
const reviewStatePath = path.join(process.cwd(), 'public', 'data', 'da-costa-block', 'neighbourhood-review.json');

const reviewToken = randomUUID();
const defaultState: SavedState = { reviews: {}, events: [], token: reviewToken };

const safeReadJson = async <T>(filePath: string, fallback: T): Promise<T> => {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
};

const readNeighborhoodBase = async (): Promise<Omit<NeighborhoodPayload, 'token' | 'events'>> => {
  return safeReadJson(baseDataPath, { version: 'da-costa-neighbourhood/1', sourceHash: '', generatedAt: new Date().toISOString(), stats: {}, records: [] } as Omit<NeighborhoodPayload, 'token' | 'events'>);
};

const readReviewState = async (): Promise<SavedState> => safeReadJson(reviewStatePath, defaultState);

const writeReviewState = async (state: SavedState): Promise<void> => {
  await fs.mkdir(path.dirname(reviewStatePath), { recursive: true });
  await fs.writeFile(reviewStatePath, JSON.stringify(state, null, 2), 'utf8');
};

const buildPayload = async (): Promise<NeighborhoodPayload> => {
  const baseData = await readNeighborhoodBase();
  const state = await readReviewState();

  const records = baseData.records.map((record: ReviewRecord) => {
    const review = state.reviews[record.id];
    return { ...record, review: review ?? record.review ?? null };
  });
  return {
    ...baseData,
    token: reviewToken,
    events: state.events,
    records,
  };
};

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
  app.get('/api/neighbourhood', async (_req, res) => {
    try {
      const payload = await buildPayload();
      res.json(payload);
    } catch (error) {
      console.error('Failed to read neighbourhood payload:', error);
      res.status(500).json({ error: 'Failed to load neighbourhood data' });
    }
  });
  app.post('/api/neighbourhood/review', async (req, res) => {
    const token = req.get('x-review-token');
    if (token !== reviewToken) {
      res.status(403).json({ error: 'Invalid review token' });
      return;
    }
    const { id, decision, suggestionShown, reviewContext } = req.body ?? {};
    if (typeof id !== 'string' || !decision || typeof decision !== 'object') {
      res.status(400).json({ error: 'Invalid review payload' });
      return;
    }
    try {
      const base = await readNeighborhoodBase();
      if (!base.records.some((record: ReviewRecord) => record.id === id)) {
        res.status(404).json({ error: 'Record not found' });
        return;
      }
      const state = await readReviewState();
      state.reviews[id] = decision;
      state.events.push({
        id,
        action: 'review',
        at: new Date().toISOString(),
        review: decision,
        suggestionShown: Boolean(suggestionShown),
        reviewContext,
      });
      await writeReviewState(state);
      const payload = await buildPayload();
      res.json({ ok: true, saved: payload.events.length, token: payload.token });
    } catch (error) {
      console.error('Failed to save review:', error);
      res.status(500).json({ error: 'Failed to save review' });
    }
  });
  app.post('/api/neighbourhood/undo', async (req, res) => {
    const token = req.get('x-review-token');
    if (token !== reviewToken) {
      res.status(403).json({ error: 'Invalid review token' });
      return;
    }
    const { id } = req.body ?? {};
    if (typeof id !== 'string') {
      res.status(400).json({ error: 'Invalid undo payload' });
      return;
    }
    try {
      const state = await readReviewState();
      const hadReview = Boolean(state.reviews[id]);
      delete state.reviews[id];
      state.events.push({
        id,
        action: 'undo',
        at: new Date().toISOString(),
      });
      if (hadReview) await writeReviewState(state);
      res.json({ ok: true, token: state.token });
    } catch (error) {
      console.error('Failed to undo review:', error);
      res.status(500).json({ error: 'Failed to undo review' });
    }
  });
  app.post('/api/neighbourhood/import', async (req, res) => {
    const token = req.get('x-review-token');
    if (token !== reviewToken) {
      res.status(403).json({ error: 'Invalid review token' });
      return;
    }
    const incoming = req.body;
    const imported: Record<string, unknown> = {};
    if (incoming?.reviews && typeof incoming.reviews === 'object') {
      Object.assign(imported, incoming.reviews);
    } else if (Array.isArray(incoming?.records)) {
      for (const item of incoming.records) {
        if (item?.id && item.review) imported[item.id] = item.review;
      }
    }
    if (!Object.keys(imported).length) {
      res.status(400).json({ error: 'No review payload to import' });
      return;
    }
    const state = await readReviewState();
    for (const [recordId, review] of Object.entries(imported)) {
      state.reviews[recordId] = review;
    }
    state.events.push({
      id: 'import',
      action: 'import',
      at: new Date().toISOString(),
      review: Object.keys(imported),
    });
    await writeReviewState(state);
    res.json({ ok: true });
  });
  app.get('/api/neighbourhood/export', async (_req, res) => {
    try {
      const payload = await buildPayload();
      const reviewed = payload.records.filter((record) => record.review);
      res.json({ ...payload, records: reviewed });
    } catch (error) {
      console.error('Failed to export reviews:', error);
      res.status(500).json({ error: 'Failed to export neighbourhood reviews' });
    }
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
