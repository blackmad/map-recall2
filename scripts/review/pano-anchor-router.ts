/** Serves the pano anchor task, the raw panorama bytes, and saved anchors.
 *
 * This is the human control-point workflow the registration gate has been
 * missing: the browser shows predicted world->pixel markers on the raw
 * equirectangular panorama and the reviewer accepts or corrects them. Saved
 * anchors are project data, not cache, and are written atomically.
 */
import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const TASK_PATH = 'public/canal-drive/data/pano-anchor-task.json';
const RAW_DIR = '.cache/city-appearance/shared-panoramas';
const ANCHORS_PATH = 'src/canalRecall/facade/fixtures/panorama-anchors.json';
const PANO_ID = /^[A-Za-z0-9_-]+$/;

type StoredAnchor = {
  panoramaId: string;
  markerId: string;
  kind: string;
  buildingId: string;
  address: string;
  world: { x: number; y: number; z: number; datum: string };
  predicted: [number, number];
  pixel: [number, number];
  residualPx: number;
  status: 'accepted' | 'corrected' | 'skipped';
  cameraModelId: string;
  reviewedAt: string;
};

const finitePair = (value: unknown): [number, number] | null =>
  Array.isArray(value) && value.length === 2 && value.every((v) => typeof v === 'number' && Number.isFinite(v))
    ? [value[0], value[1]]
    : null;

async function readAnchors(): Promise<{ version: number; cameraModelId: string; updatedAt: string | null; anchors: StoredAnchor[] }> {
  try {
    const data = JSON.parse(await fs.readFile(ANCHORS_PATH, 'utf8'));
    if (!Array.isArray(data.anchors)) throw new Error('invalid anchors file');
    return data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { version: 1, cameraModelId: 'unknown', updatedAt: null, anchors: [] };
  }
}

async function writeAnchors(data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(ANCHORS_PATH), { recursive: true });
  const temp = `${ANCHORS_PATH}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(data, null, 2) + '\n');
  await fs.rename(temp, ANCHORS_PATH);
}

export function panoAnchorRouter() {
  const router = Router();

  router.get('/task', async (_req, res) => {
    try {
      const bytes = await fs.readFile(TASK_PATH);
      res.type('application/json').send(bytes);
    } catch {
      res.status(404).json({ error: 'No anchor task. Run: npx tsx scripts/review/build-pano-anchor-task.ts' });
    }
  });

  router.get('/task/:name', async (req, res) => {
    const { name } = req.params;
    if (!/^[a-z0-9-]+$/.test(name)) {
      res.status(400).json({ error: 'Invalid task name' });
      return;
    }
    try {
      const bytes = await fs.readFile(`public/canal-drive/data/pano-anchor-task-${name}.json`);
      res.type('application/json').send(bytes);
    } catch {
      res.status(404).json({ error: `No anchor task '${name}'` });
    }
  });

  router.get('/pano/:panoramaId', async (req, res) => {
    const { panoramaId } = req.params;
    if (!PANO_ID.test(panoramaId)) {
      res.status(400).json({ error: 'Invalid panorama id' });
      return;
    }
    try {
      const file = path.resolve(RAW_DIR, `${panoramaId}.jpg`);
      const bytes = await fs.readFile(file);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      res.setHeader('ETag', `"${createHash('sha256').update(bytes).digest('hex').slice(0, 24)}"`);
      res.send(bytes);
    } catch {
      res.status(404).json({ error: 'Panorama not cached' });
    }
  });

  router.get('/anchors', async (_req, res) => {
    try {
      res.json(await readAnchors());
    } catch {
      res.status(500).json({ error: 'Failed to read anchors' });
    }
  });

  router.post('/save', async (req, res) => {
    const { panoramaId, cameraModelId, markers } = req.body ?? {};
    if (typeof panoramaId !== 'string' || !PANO_ID.test(panoramaId) || !Array.isArray(markers) || !markers.length) {
      res.status(400).json({ error: 'Invalid anchor save payload' });
      return;
    }
    try {
      const incoming: StoredAnchor[] = [];
      const removals: string[] = [];
      for (const marker of markers) {
        const pixel = finitePair(marker?.pixel);
        const predicted = finitePair(marker?.predicted);
        const world = marker?.world;
        if (
          typeof marker?.markerId !== 'string' ||
          !pixel || !predicted ||
          !world || typeof world.x !== 'number' || typeof world.y !== 'number' || typeof world.z !== 'number' ||
          !['pending', 'accepted', 'corrected', 'skipped'].includes(marker?.status)
        ) {
          res.status(400).json({ error: `Invalid marker ${String(marker?.markerId)}` });
          return;
        }
        if (marker.status === 'pending') { removals.push(`${panoramaId}|${marker.markerId}`); continue; }
        incoming.push({
          panoramaId,
          markerId: marker.markerId,
          kind: String(marker.kind ?? ''),
          buildingId: String(marker.buildingId ?? ''),
          address: String(marker.address ?? ''),
          world: { x: world.x, y: world.y, z: world.z, datum: String(world.datum ?? 'NAP') },
          predicted,
          pixel,
          residualPx: marker.status === 'skipped' ? 0 : Number(Math.hypot(pixel[0] - predicted[0], pixel[1] - predicted[1]).toFixed(2)),
          status: marker.status,
          cameraModelId: String(cameraModelId ?? 'unknown'),
          reviewedAt: new Date().toISOString(),
        });
      }
      const current = await readAnchors();
      const merged = new Map(current.anchors.map((anchor) => [`${anchor.panoramaId}|${anchor.markerId}`, anchor]));
      for (const key of removals) merged.delete(key);
      for (const anchor of incoming) merged.set(`${anchor.panoramaId}|${anchor.markerId}`, anchor);
      const next = {
        version: 1,
        cameraModelId: String(cameraModelId ?? current.cameraModelId),
        updatedAt: new Date().toISOString(),
        anchors: [...merged.values()].sort((a, b) => a.panoramaId.localeCompare(b.panoramaId) || a.markerId.localeCompare(b.markerId)),
      };
      await writeAnchors(next);
      const decided = next.anchors.filter((a) => a.status !== 'skipped').length;
      res.json({ ok: true, saved: incoming.length, total: next.anchors.length, decided });
    } catch (error) {
      console.error('Failed to save anchors:', error);
      res.status(500).json({ error: 'Failed to save anchors' });
    }
  });

  return router;
}
