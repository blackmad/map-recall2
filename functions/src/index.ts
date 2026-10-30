/**
 * Consent-free gameplay analytics endpoint (issue #115).
 *
 * The browser sends a `navigator.sendBeacon` batch (text/plain JSON). This
 * validates it against the shared allow-list (../../src/canalRecall/analytics/
 * schema.ts), drops anything else, and increments daily counters at
 * `analytics_daily/{yyyy-mm-dd}/analytics_shards/{0..7}` field `c`.
 *
 * Privacy: this code never reads the client address, headers or cookies, never
 * logs the request, and stores no per-event rows. The session id is used only
 * to drop a replayed batch, in memory, and is never written.
 */
import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import {
  ANALYTICS_COLLECTION, ReplayGuard, SHARD_COLLECTION, countersForBody,
} from '../../src/canalRecall/analytics/aggregate';
import { MAX_BATCH_BYTES } from '../../src/canalRecall/analytics/schema';

initializeApp();
const replay = new ReplayGuard();

function bodyText(req: { rawBody?: Buffer; body?: unknown }): unknown {
  if (req.rawBody && req.rawBody.length) {
    if (req.rawBody.length > MAX_BATCH_BYTES) return null;
    return req.rawBody.toString('utf8');
  }
  return req.body;
}

export const analytics = onRequest(
  {
    region: 'europe-west4',
    memory: '256MiB',
    cpu: 'gcf_gen1',
    concurrency: 1,
    maxInstances: 5,
    timeoutSeconds: 10,
    invoker: 'public',
    // Called cross-origin from the Pages site; a text/plain beacon needs no CORS.
    cors: false,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).end();
      return;
    }
    const write = countersForBody(bodyText(req), { now: new Date(), replay });
    if (write) {
      const c: Record<string, FieldValue> = {};
      for (const [key, n] of Object.entries(write.increments)) c[key] = FieldValue.increment(n);
      try {
        await getFirestore()
          .collection(ANALYTICS_COLLECTION).doc(write.day)
          .collection(SHARD_COLLECTION).doc(String(write.shard))
          .set({ day: write.day, c }, { merge: true });
      } catch (error) {
        // The error only; nothing about the request.
        logger.error('analytics counter write failed', error instanceof Error ? error.message : String(error));
        res.status(503).end();
        return;
      }
    }
    // Same answer for good and bad batches: a probe learns nothing about the allow-list.
    res.status(204).end();
  },
);
