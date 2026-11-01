/**
 * The pre-painted facade atlas (#129, look/lookAtlas.ts). Paints each listed look × cell size × slot-layer variant
 * with the runtime painter (look/paintLookAtlas.ts `paintLookArrays`, from the three-buildings bundle) in headless
 * Chrome and writes the bytes as a versioned extract.
 *
 *   build (default)  paint into the staging dir (artifacts/look-atlas-staging/look-atlas-v1) and report the diff
 *                    against the published extract; a variant whose bytes are unchanged keeps its published .gz
 *   --publish        copy the staging dir into public/data/extracts/amsterdam/look-atlas-v1 (after review)
 *   --check          paint again and compare sha256 with the published manifest and the published files' inflated
 *                    bytes; exit 1 on any difference or a stale source fingerprint (the gate)
 *   --source         only compare the painter's source fingerprint with the manifest (no browser; exit 1 if stale)
 *
 * Needs a dev server on PORT (default 4545). BUNDLES_DIR serves bundles built elsewhere (a scratch build of this
 * checkout) in place of public/canal-drive/js/. Run browser modes under the lock:
 *   /tmp/canal-pw.sh node --import tsx scripts/look-atlas/build-look-atlas.ts [--check]
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { LOOK_ATLAS_DIR, LOOK_ATLAS_FORMAT, LOOK_ATLAS_MANIFEST, lookAtlasByteLength, lookAtlasFile, type LookAtlasManifest, type LookAtlasManifestEntry } from '../../src/canalRecall/look/lookAtlas.js';

const ROOT = process.cwd();
const PUBLISHED = path.join(ROOT, 'public/data/extracts/amsterdam', LOOK_ATLAS_DIR);
const STAGING = path.join(ROOT, 'artifacts/look-atlas-staging', LOOK_ATLAS_DIR);
const PAINTER = 'src/canalRecall/look/paintLookAtlas.ts';
/** Files the painter reads at runtime besides its code. */
const PAINTER_ASSETS = ['public/canal-drive/materials/ambientcg/Bricks057/colour.jpg'];
/** The ride's variants: the photo look, desktop (256) and touch (128) cells, with the city look's slot layers. */
const DEFAULT_VARIANTS = ['photo:256:slots', 'photo:128:slots'];

const args = process.argv.slice(2);
const mode = args.includes('--publish') ? 'publish' : args.includes('--check') ? 'check' : args.includes('--source') ? 'source' : 'build';
const variants = (args.find(a => a.startsWith('--variants='))?.slice(11).split(',') ?? DEFAULT_VARIANTS).map(v => {
  const [look, size, slots] = v.split(':');
  return { look: look as LookAtlasManifestEntry['look'], size: Number(size), slots: slots === 'slots' };
});
const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

/** sha256 over the painter's import closure (esbuild's inputs) and its assets, in path order. */
async function sourceFingerprint(): Promise<{ hash: string; files: string[] }> {
  const result = await esbuild.build({ entryPoints: [PAINTER], bundle: true, write: false, metafile: true, format: 'esm', platform: 'browser', logLevel: 'silent' });
  const files = [...Object.keys(result.metafile!.inputs).filter(f => !f.includes('node_modules')), ...PAINTER_ASSETS].sort();
  const hash = createHash('sha256');
  for (const f of files) hash.update(f).update('\0').update(readFileSync(path.join(ROOT, f))).update('\0');
  return { hash: hash.digest('hex'), files };
}

const readManifest = (dir: string): LookAtlasManifest | null => existsSync(path.join(dir, LOOK_ATLAS_MANIFEST)) ? JSON.parse(readFileSync(path.join(dir, LOOK_ATLAS_MANIFEST), 'utf8')) : null;

if (mode === 'publish') {
  const staged = readManifest(STAGING);
  if (!staged) throw new Error(`nothing staged in ${STAGING}: run the build first`);
  mkdirSync(PUBLISHED, { recursive: true });
  for (const name of Object.keys(staged.files)) cpSync(path.join(STAGING, name), path.join(PUBLISHED, name));
  writeFileSync(path.join(PUBLISHED, LOOK_ATLAS_MANIFEST), `${JSON.stringify(staged, null, 2)}\n`);
  console.log(`published ${Object.keys(staged.files).length} files to ${path.relative(ROOT, PUBLISHED)}`);
  process.exit(0);
}

const source = await sourceFingerprint();
const published = readManifest(PUBLISHED);
if (mode === 'source') {
  const fresh = published?.sourceHash === source.hash;
  console.log(JSON.stringify({ fresh, published: published?.sourceHash ?? null, now: source.hash }));
  if (!fresh) { console.error('look atlas source fingerprint is stale: run scripts/look-atlas/build-look-atlas.ts (then --publish)'); process.exitCode = 1; }
  process.exit();
}

/** Paint every variant in one headless page that loads only three and the three-buildings bundle. */
async function paint(): Promise<Map<string, { entry: Omit<LookAtlasManifestEntry, 'gzBytes'>; bytes: Uint8Array; ms: number }>> {
  const port = process.env.PORT ?? '4545', origin = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const out = new Map<string, { entry: Omit<LookAtlasManifestEntry, 'gzBytes'>; bytes: Uint8Array; ms: number }>();
  try {
    const page = await browser.newPage();
    const bundles = process.env.BUNDLES_DIR;
    if (bundles) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
      const file = path.join(bundles, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]);
      return existsSync(file) ? route.fulfill({ body: readFileSync(file), contentType: 'application/javascript' }) : route.continue();
    });
    await page.route(`${origin}/canal-drive/__look-atlas.html`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><script src="js/three.bundle.js"></script><script src="js/three-buildings.bundle.js"></script>' }));
    page.on('pageerror', e => console.error('page error:', e.message));
    await page.goto(`${origin}/canal-drive/__look-atlas.html`);
    await page.waitForFunction(() => typeof (window as any).CanalRecallThreeBuildings?.paintLookArrays === 'function', null, { timeout: 60_000 });
    for (const v of variants) {
      const name = lookAtlasFile(v.look, v.size, v.slots);
      const painted = await page.evaluate(async ({ look, size, slots }) => {
        const T = (window as any).CanalRecallThreeBuildings, started = performance.now();
        const atlas = await T.paintLookArrays(look, size, { slotLayers: slots, sliceMs: 1e9 });
        const ms = performance.now() - started;
        const bytes = new Uint8Array(atlas.colour.byteLength + atlas.mask.byteLength);
        bytes.set(atlas.colour, 0); bytes.set(atlas.mask, atlas.colour.byteLength);
        const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
        (window as any).__atlasBytes = bytes;
        return { layers: atlas.layers, total: atlas.total, bytes: bytes.byteLength, sha256: digest, ms };
      }, v);
      // Pull the bytes over in base64 chunks (one string per 8 MB keeps CDP messages bounded).
      const bytes = new Uint8Array(painted.bytes), CHUNK = 8 << 20;
      for (let at = 0; at < painted.bytes; at += CHUNK) {
        const b64: string = await page.evaluate(({ at, n }) => {
          const view = (window as any).__atlasBytes.subarray(at, at + n); let s = '';
          for (let i = 0; i < view.length; i += 0x8000) s += String.fromCharCode(...view.subarray(i, i + 0x8000));
          return btoa(s);
        }, { at, n: CHUNK });
        bytes.set(Buffer.from(b64, 'base64'), at);
      }
      if (sha256(bytes) !== painted.sha256) throw new Error(`${name}: bytes changed in transfer`);
      if (bytes.byteLength !== lookAtlasByteLength(v.size, painted.total)) throw new Error(`${name}: ${bytes.byteLength} bytes for ${painted.total} layers`);
      out.set(name, { entry: { look: v.look, size: v.size, slots: v.slots, layers: painted.layers, total: painted.total, bytes: painted.bytes, sha256: painted.sha256 }, bytes, ms: painted.ms });
      console.log(`${name}: painted in ${painted.ms.toFixed(0)} ms, ${painted.total} layers, ${(painted.bytes / 1e6).toFixed(1)} MB, sha256 ${painted.sha256.slice(0, 12)}`);
    }
  } finally { await browser.close(); }
  return out;
}

const painted = await paint();

if (mode === 'check') {
  const problems: string[] = [];
  if (!published) problems.push(`no published manifest in ${path.relative(ROOT, PUBLISHED)}`);
  else {
    if (published.format !== LOOK_ATLAS_FORMAT) problems.push(`format ${published.format} != ${LOOK_ATLAS_FORMAT}`);
    if (published.sourceHash !== source.hash) problems.push('source fingerprint is stale (painter code or assets changed since the build)');
    for (const [name, { entry }] of painted) {
      const want = published.files[name];
      if (!want) { problems.push(`${name}: not published`); continue; }
      if (want.sha256 !== entry.sha256) problems.push(`${name}: runtime painter sha256 ${entry.sha256.slice(0, 12)} != manifest ${want.sha256.slice(0, 12)}`);
      const file = path.join(PUBLISHED, name);
      if (!existsSync(file)) { problems.push(`${name}: file missing`); continue; }
      const inflated = gunzipSync(readFileSync(file));
      if (sha256(inflated) !== entry.sha256) problems.push(`${name}: published bytes differ from the runtime painter`);
    }
  }
  console.log(JSON.stringify({ check: problems.length ? 'FAIL' : 'ok', problems, sourceHash: source.hash }, null, 2));
  if (problems.length) process.exitCode = 1;
} else {
  rmSync(STAGING, { recursive: true, force: true });
  mkdirSync(STAGING, { recursive: true });
  const manifest: LookAtlasManifest = { format: LOOK_ATLAS_FORMAT, sourceHash: source.hash, sourceFiles: source.files, files: {} };
  const report: Record<string, unknown> = {};
  for (const [name, { entry, bytes, ms }] of painted) {
    const prior = published?.files[name], priorFile = path.join(PUBLISHED, name);
    // Unchanged pixels keep the published .gz byte for byte (no binary churn when only the fingerprint moved).
    const keep = prior?.sha256 === entry.sha256 && existsSync(priorFile);
    const gz = keep ? readFileSync(priorFile) : gzipSync(bytes, { level: 9 });
    writeFileSync(path.join(STAGING, name), gz);
    manifest.files[name] = { ...entry, gzBytes: gz.byteLength };
    let changedLayers: number | undefined;
    if (prior && !keep && existsSync(priorFile)) {
      const old = gunzipSync(readFileSync(priorFile)), px = entry.size * entry.size;
      if (old.byteLength === bytes.byteLength) {
        changedLayers = 0;
        for (let layer = 0; layer < entry.total; layer++) {
          const c = [layer * px * 4, (layer + 1) * px * 4], m = [entry.total * px * 4 + layer * px * 2, entry.total * px * 4 + (layer + 1) * px * 2];
          if (Buffer.compare(old.subarray(c[0], c[1]), bytes.subarray(c[0], c[1])) || Buffer.compare(old.subarray(m[0], m[1]), bytes.subarray(m[0], m[1]))) changedLayers++;
        }
      }
    }
    report[name] = { paintMs: Math.round(ms), layers: entry.total, rawMB: +(entry.bytes / 1e6).toFixed(1), gzMB: +(gz.byteLength / 1e6).toFixed(2), status: !prior ? 'new' : keep ? 'unchanged' : 'changed', changedLayers };
  }
  writeFileSync(path.join(STAGING, LOOK_ATLAS_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ staged: path.relative(ROOT, STAGING), sourceHash: source.hash, sourceChanged: published?.sourceHash !== source.hash, report }, null, 2));
}
