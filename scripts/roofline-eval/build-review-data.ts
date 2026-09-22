/**
 * Roofline review data builder (roofline plan A6, item 2).
 *
 * Copies strip thumbnails and profile JSON from the offline cache into
 * `public/canal-drive/roofline-review/local/` (gitignored) so the dev server can
 * serve them, and writes the single index the grading page fetches. The output
 * directory is disposable: delete it and rerun to rebuild.
 *
 * Until A2 lands this accepts a fixture in the documented A2 output format
 * (`scripts/roofline-eval/fixtures/roofline-review-fixture`, marked `fixture`).
 * Real input is a directory of `<pandId>.json` files:
 *
 *   { pandId, address, wall: {start, end},
 *     views: [{ file, panoramaId, capturedAt, coarsePx, snappedPx, profile }],
 *     consensus, shape, profileSha256 }
 *
 * Every profile is content-hashed (`profileContentHash`) and a profile whose
 * stored `profileSha256` does not match is rejected: a grade can then never bind
 * to a profile that changed.
 *
 * Run: tsx scripts/roofline-eval/build-review-data.ts [--profiles=DIR]
 *      [--strips=DIR] [--out=DIR] [--fixture]
 * Add to package.json: "build:roofline-review": "tsx scripts/roofline-eval/build-review-data.ts"
 */
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  profileContentHash,
  type RooflineProfile,
} from '../../src/canalRecall/facade/rooflineGrade.ts';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const cacheRoot = process.env.ROOFLINE_CACHE
  ?? '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache';
const fixtureDir = path.join(repoRoot, 'scripts/roofline-eval/fixtures/roofline-review-fixture');
const defaultOut = path.join(repoRoot, 'public/canal-drive/roofline-review/local');
/** The page is `public/canal-drive/roofline-review.html`, so local assets sit one level down. */
const publicPrefix = 'roofline-review/local';

const args = new Map<string, string | true>();
for (const arg of process.argv.slice(2)) {
  const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
  if (match) args.set(match[1], match[2] === undefined ? true : match[2]);
}
if (args.has('help')) {
  process.stdout.write('Usage: tsx scripts/roofline-eval/build-review-data.ts [--profiles=DIR] [--strips=DIR] [--out=DIR] [--fixture]\n');
  process.exit(0);
}

const exists = async (target: string) => { try { await stat(target); return true; } catch { return false; } };
const explicitProfiles = typeof args.get('profiles') === 'string' ? String(args.get('profiles')) : null;
const a2ProfilesDir = path.join(cacheRoot, 'roofline-eval/strip-profiles');
const profilesDir = explicitProfiles ?? a2ProfilesDir;
const stripsDir = typeof args.get('strips') === 'string'
  ? String(args.get('strips'))
  : path.join(cacheRoot, 'facade-twin/strips-roofline-v1');
const outDir = typeof args.get('out') === 'string' ? String(args.get('out')) : defaultOut;

const fixtureMarkPath = path.join(fixtureDir, 'fixture.json');
const fixtureMode = args.has('fixture') || !(await exists(profilesDir));
if (!fixtureMode && !(await exists(profilesDir))) throw new Error(`Profile directory does not exist: ${profilesDir}`);
if (fixtureMode && !(await exists(fixtureDir))) throw new Error(`No A2 profiles at ${profilesDir} and no fixture at ${fixtureDir}`);
if (!(await exists(stripsDir))) throw new Error(`Strip directory does not exist: ${stripsDir} (pass --strips=DIR or set ROOFLINE_CACHE)`);

const fixtureMeta = fixtureMode ? JSON.parse(await readFile(fixtureMarkPath, 'utf8')) as Record<string, unknown> : null;
const profileSourceDir = fixtureMode ? fixtureDir : profilesDir;
const profileFiles = (await readdir(profileSourceDir)).filter(name => name.endsWith('.json') && name !== 'fixture.json');

const requiredStrings = ['pandId', 'address', 'shape', 'profileSha256'];
for (const file of profileFiles) {
  const profile = JSON.parse(await readFile(path.join(profileSourceDir, file), 'utf8')) as RooflineProfile;
  for (const key of requiredStrings) {
    if (typeof (profile as unknown as Record<string, unknown>)[key] !== 'string') throw new Error(`${file}: missing string field ${key}`);
  }
  if (!Array.isArray(profile.views) || profile.views.length === 0) throw new Error(`${file}: no views`);
  if (!Array.isArray(profile.consensus) || !profile.wall?.start || !profile.wall?.end) throw new Error(`${file}: incomplete profile`);
  for (const view of profile.views) {
    if (!view.file || !view.panoramaId || !view.capturedAt) throw new Error(`${file}: view missing file/panoramaId/capturedAt`);
    if (!Array.isArray(view.coarsePx) || !Array.isArray(view.snappedPx) || !Array.isArray(view.profile)) throw new Error(`${file}: view arrays missing`);
  }
  const expected = await profileContentHash(profile);
  if (profile.profileSha256 !== expected) {
    throw new Error(`${file}: profileSha256 ${profile.profileSha256} does not match content hash ${expected}; regenerate the profile instead of grading a changed one`);
  }
}

await mkdir(path.join(outDir, 'profiles'), { recursive: true });
const materialised: Array<Record<string, unknown>> = [];
let copiedImages = 0;

for (const file of profileFiles.sort()) {
  const profile = JSON.parse(await readFile(path.join(profileSourceDir, file), 'utf8')) as RooflineProfile;
  const views = [];
  for (const view of profile.views) {
    const source = path.join(stripsDir, view.file);
    if (!(await exists(source))) throw new Error(`${file}: strip image not found: ${source}`);
    const targetName = `${profile.pandId}__${path.basename(view.file)}`;
    await copyFile(source, path.join(outDir, targetName));
    copiedImages += 1;
    views.push({
      file: view.file,
      imageUrl: `${publicPrefix}/${targetName}`,
      panoramaId: view.panoramaId,
      capturedAt: view.capturedAt,
      coarsePx: view.coarsePx,
      snappedPx: view.snappedPx,
      profile: view.profile,
      consensusPx: view.consensusPx ?? null,
      viewBiasM: view.viewBiasM ?? 0,
      rescuedSkyFraction: view.rescuedSkyFraction ?? 0,
    });
  }
  const entry = {
    pandId: profile.pandId,
    address: profile.address,
    wall: profile.wall,
    shape: profile.shape,
    profileSha256: profile.profileSha256,
    fixture: fixtureMode,
    views,
    consensus: profile.consensus,
    consensusSingleView: profile.consensusSingleView ?? null,
    maxViewBiasM: profile.maxViewBiasM ?? 0,
    alignmentNote: profile.alignmentNote ?? null,
    reasonSummary: profile.reasonSummary ?? null,
    medianOffsetVs3dbagMaxM: profile.medianOffsetVs3dbagMaxM ?? null,
    gable: profile.gable ?? null,
  };
  materialised.push(entry);
  await writeFile(path.join(outDir, 'profiles', `${profile.pandId}.json`), `${JSON.stringify(entry, null, 2)}\n`);
}

const index = {
  schemaVersion: 1,
  kind: 'roofline-review-data',
  generatedAt: new Date().toISOString(),
  fixture: fixtureMode,
  source: {
    mode: fixtureMode ? 'fixture' : 'a2-strip-profiles',
    profilesDir: profileSourceDir,
    stripsDir,
    note: fixtureMeta?.note ?? null,
  },
  profileCount: materialised.length,
  profiles: materialised,
};
await writeFile(path.join(outDir, 'roofline-review-data.json'), `${JSON.stringify(index, null, 2)}\n`);

console.log(`Roofline review data: ${materialised.length} profiles, ${copiedImages} strip images copied.`);
console.log(`Mode: ${index.source.mode}${fixtureMode ? ' (FIXTURE — not measurements)' : ''}`);
console.log(`Index: ${path.join(outDir, 'roofline-review-data.json')}`);
