/**
 * What's New before/after pairs (user, 2026-11-22: the Raamplein "before" was shot before the world had loaded, and
 * Nieuwe Doelenstraat 12's pair barely differed). Each pair is shot at one pose twice, before and after, each frame
 * only once the world has settled (helpers.ts settleForShot: streaming tiers, camera pending work, landmark GLBs, a
 * steady building count), and then passed through src/canalRecall/whatsNewPairGuard.ts. A refused pair fails the test
 * and is not composed; a passing one is written as <out>/<name>.jpg, ready for map-recall2-screenshots/whats-new/.
 *
 * Not part of check:canal. Run through the browser queue with a private port:
 *   WN_PAIRS=scripts/whats-new/pairs/2026-11-22.json WN_OUT=<dir> PW_PORT=4901 \
 *     bash /tmp/canal-pw.sh npx playwright test tests/e2e/whats-new-pair.spec.ts --project=desktop --workers=1
 * WN_ONLY=name,name shoots a subset.
 *
 * The "before" world, one of:
 *  - before.ref: a git commit. Every file under public/ that differs between that commit and HEAD is served from the
 *    commit (world cells, catalogues, GLBs, bundles), so the frame shows the game as it was: for a landmark, the
 *    generic building it replaced, not an empty lot.
 *  - before.query / after.query: URL flags (e.g. '?houseSpecs=0' against '').
 *  - before.stripLandmarks: drop those ids from signature-landmarks.json. Quick, but the baked world already leaves the
 *    landmark's footprint empty, so the lot shows bare: prefer before.ref for a new landmark.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { engineChecks, pairMetrics, pixelChecks, WHOLE, type Box, type RawImage } from '../../src/canalRecall/whatsNewPairGuard';
import { openRoute, settleForShot, standpoint, teleportRider, type ShotWorld } from './helpers';

type Side = { ref?: string; query?: string; stripLandmarks?: string[] };
type Pair = {
  name: string; centre: [number, number]; standDeg: number; standM: number; faceDeg?: number; view?: 'chase' | 'cockpit';
  camZoom?: number; query?: string; before: Side; after?: Side;
  /** Fractions of the frame: what the note is about (default whole frame) and the part to judge (default whole). */
  target?: Box; frame?: Box;
  caption?: [string, string];
};

const LIST = process.env.WN_PAIRS;
const OUT = process.env.WN_OUT ?? 'artifacts/whats-new-pairs';
const only = process.env.WN_ONLY?.split(',').filter(Boolean);
const pairs: Pair[] = LIST ? JSON.parse(readFileSync(LIST, 'utf8')).pairs : [];

const git = (args: string[], encoding: 'utf8' | 'buffer' = 'utf8') => execFileSync('/usr/bin/git', args, { encoding: encoding as BufferEncoding, maxBuffer: 1 << 30 });
const TYPES: Record<string, string> = { json: 'application/json', js: 'application/javascript', glb: 'model/gltf-binary', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', css: 'text/css', html: 'text/html', bin: 'application/octet-stream' };

/** Serve every public/ file that differs between `ref` and HEAD from `ref` (a file added since answers 404). */
async function serveFromRef(page: Page, ref: string): Promise<number> {
  const raw = git(['diff', '--raw', '--no-renames', '-z', ref, 'HEAD', '--', 'public']) as string;
  const parts = raw.split('\0');
  const old = new Map<string, string | null>();
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const [, , oldSha] = parts[i].split(' ');
    old.set(parts[i + 1].replace(/^public/, ''), /^0+$/.test(oldSha) ? null : oldSha);
  }
  const cache = new Map<string, Buffer>();
  await page.route(url => old.has(decodeURIComponent(url.pathname)), route => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname);
    const sha = old.get(path);
    if (!sha) return route.fulfill({ status: 404, body: '' });
    let body = cache.get(sha);
    if (!body) { body = git(['cat-file', 'blob', sha], 'buffer') as unknown as Buffer; cache.set(sha, body); }
    return route.fulfill({ body, contentType: TYPES[path.split('.').pop() ?? ''] ?? 'application/octet-stream' });
  });
  return old.size;
}

/** sigtoggle's strip, in the browser: drop the ids as keys and as list entries, recursively. */
async function stripLandmarks(page: Page, ids: string[]): Promise<void> {
  const drop = (o: unknown): unknown => {
    if (Array.isArray(o)) return o.filter(x => !(x && typeof x === 'object' && ids.includes((x as { id?: string }).id ?? ''))).map(drop);
    if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).filter(([k]) => !ids.includes(k)).map(([k, v]) => [k, drop(v)]));
    return o;
  };
  await page.route(/\/models\/signature-landmarks\.json(\?.*)?$/, async route => {
    const res = await route.fetch();
    await route.fulfill({ response: res, json: drop(await res.json()) });
  });
}

async function shoot(page: Page, pair: Pair, side: Side, label: string): Promise<{ png: Buffer; world: ShotWorld }> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  if (side.ref) console.log(`${pair.name} ${label}: ${await serveFromRef(page, side.ref)} public/ files served from ${side.ref}`);
  if (side.stripLandmarks?.length) await stripLandmarks(page, side.stripLandmarks);
  await openRoute(page, { travelMode: 'car', query: side.query ?? pair.query ?? '', abortHeavyTiles: true });
  if (pair.view === 'cockpit') {
    await page.evaluate(() => { const g = (window as any).canalRecallGame; g.viewMode = 'cockpit'; g.camera.viewMode = 'cockpit'; g.camera.northUp = false; });
  }
  const p = standpoint(pair);
  await teleportRider(page, p);
  await page.waitForTimeout(2500);
  await teleportRider(page, p); // the game re-routes after the first jump; pin the spot again
  if (pair.camZoom) await page.evaluate(z => { (window as any).canalRecallGame.camera.zoom = z; }, pair.camZoom);
  const world = await settleForShot(page, `${pair.name} ${label}`);
  return { png: await page.screenshot(), world };
}

async function raw(png: Buffer): Promise<RawImage> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, channels: info.channels, data };
}

/** before | after, 6 px dark gutter, long edge 1600 px, JPEG under 400 KB (map-recall2-screenshots README). */
async function compose(before: Buffer, after: Buffer, file: string): Promise<void> {
  const m = await sharp(before).metadata(), w = m.width!, h = m.height!, gutter = 6;
  const sheet = await sharp({ create: { width: 2 * w + gutter, height: h, channels: 3, background: '#202020' } })
    .composite([{ input: before, left: 0, top: 0 }, { input: after, left: w + gutter, top: 0 }]).png().toBuffer();
  for (const quality of [85, 78, 71, 64, 57]) {
    const jpg = await sharp(sheet).resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality, mozjpeg: true }).toBuffer();
    writeFileSync(file, jpg);
    if (jpg.length <= 400_000) return;
  }
}

for (const pair of pairs) {
  if (only && !only.includes(pair.name)) continue;
  test(`What's New pair: ${pair.name}`, async ({ page }) => {
    test.setTimeout(480_000);
    if (test.info().project.name !== 'iphone') await page.setViewportSize({ width: 1440, height: 900 });
    const dir = join(OUT, pair.name); mkdirSync(dir, { recursive: true });
    const before = await shoot(page, pair, pair.before, 'before');
    writeFileSync(join(dir, 'before.png'), before.png);
    const after = await shoot(page, pair, pair.after ?? {}, 'after');
    writeFileSync(join(dir, 'after.png'), after.png);
    const metrics = pairMetrics(await raw(before.png), await raw(after.png), pair.target ?? WHOLE, pair.frame ?? WHOLE);
    const refusals = [...engineChecks(before.world, after.world), ...pixelChecks(metrics)];
    writeFileSync(join(dir, 'pair.json'), JSON.stringify({ pair, metrics, refusals, before: before.world, after: after.world }, null, 1));
    console.log(`${pair.name}: target diff ${(metrics.targetMeanDiff * 100).toFixed(1)} %, buildings ${before.world.buildings} / ${after.world.buildings}, ${refusals.length ? refusals.map(r => r.code).join(', ') : 'OK'}`);
    if (!refusals.length) await compose(before.png, after.png, join(OUT, `${pair.name}.jpg`));
    expect(refusals, refusals.map(r => r.message).join('\n')).toEqual([]);
  });
}
