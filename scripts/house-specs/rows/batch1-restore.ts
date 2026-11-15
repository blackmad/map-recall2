/**
 * Batch-1 restore, dry run (lane D, #386; programme brief "David's words and decisions"): the 293 D1 fronts published in
 * 36182f238 come off in the round that ships the first redone rows. This lists every batch-1 front, says which round 1
 * redoes (a staged row spec under artifacts/house-rows/staging/<row>/) and, for the others, what restores the pre-D1
 * look: the spec file to delete (every batch-1 spec was ADDED by 36182f238, none existed before) and the house-spec
 * extract tiles to rebuild, with each pand's pre-D1 record state in its tile (present from another source, or absent).
 *
 *   node --import tsx scripts/house-specs/rows/batch1-restore.ts [--commit 36182f238] [--staging artifacts/house-rows/staging]
 *        [--sources <d1-streets-1.sources.json>] [--out artifacts/house-rows/batch1-restore.json]
 *        [--rows <row,row> | staged]   (default: the rows in scripts/house-specs/rows/signed-off.json)
 *
 * Writes nothing outside --out. The integrator executes it: git rm the listed specs, `npm run house:specs -- --publish`
 * (rebuilds the listed tiles from the remaining specs), check each tile's pand against `preD1`, then
 * `world:compile --changed --no-policy --shell`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { REPO } from './rowDefs.ts';

const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const commit = arg('commit') ?? '36182f238';
const staging = path.resolve(arg('staging') ?? path.join(REPO, 'artifacts/house-rows/staging'));
const sourcesFile = arg('sources') ?? path.join(REPO, '../_pruned-sheets/d1-streets-1.sources.json');
const out = path.resolve(arg('out') ?? path.join(REPO, 'artifacts/house-rows/batch1-restore.json'));
const git = (...a: string[]) => execFileSync('/usr/bin/git', ['-C', REPO, ...a], { maxBuffer: 1 << 28 });

const added = git('show', '--diff-filter=A', '--name-only', '--format=', commit).toString().split('\n').filter(f => /^scripts\/house-specs\/specs\/\d{16}\.json$/.test(f));
const modifiedSpecs = git('show', '--diff-filter=M', '--name-only', '--format=', commit).toString().split('\n').filter(f => f.startsWith('scripts/house-specs/specs/'));
const tiles = git('show', '--name-only', '--format=', commit).toString().split('\n').filter(f => /house-specs\/14\/\d+\/\d+\.json\.gz$/.test(f));
const sources: Record<string, string> = fs.existsSync(sourcesFile) ? JSON.parse(fs.readFileSync(sourcesFile, 'utf8')) : {};
// Only signed-off rows replace (scripts/house-specs/rows/signed-off.json); `--rows a,b` overrides, `--rows staged` takes
// every staged row. A staged row David has not OKed (Weteringschans, 2026-11-15) is restored with the rest of batch 1.
const signedOff = Object.keys((JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/house-specs/rows/signed-off.json'), 'utf8')) as { rows: Record<string, unknown> }).rows);
const rowsArg = arg('rows');
const rowsTaken = rowsArg === 'staged' ? null : new Set(rowsArg ? rowsArg.split(',') : signedOff);
const redone = new Map<string, string>(), stagedNotTaken = new Map<string, string>();
if (fs.existsSync(staging)) for (const d of fs.readdirSync(staging)) {
  const dir = path.join(staging, d);
  if (rowsTaken && !rowsTaken.has(d)) { if (fs.statSync(dir).isDirectory()) for (const f of fs.readdirSync(dir)) if (/^\d{16}\.json$/.test(f)) stagedNotTaken.set(f.slice(0, 16), d); continue; }
  if (fs.statSync(dir).isDirectory()) for (const f of fs.readdirSync(dir)) if (/^\d{16}\.json$/.test(f)) redone.set(f.slice(0, 16), d);
}
const tileAt = (rev: string, f: string): Record<string, unknown> => {
  try { return (JSON.parse(gunzipSync(git('show', `${rev}:${f}`)).toString()) as { buildings: Record<string, unknown> }).buildings; } catch { return {}; }
};
const after = new Map(tiles.map(t => [t, tileAt(commit, t)])), before = new Map(tiles.map(t => [t, tileAt(`${commit}^`, t)]));
const changedSince = (f: string) => {
  try { return git('diff', '--quiet', commit, 'HEAD', '--', f) && false; } catch { return true; }
};

const fronts = added.map(f => {
  const pandId = path.basename(f, '.json');
  const key = `NL.IMBAG.Pand.${pandId}`;
  const tile = tiles.find(t => key in after.get(t)!) ?? null;
  const pre = tile ? before.get(tile)![key] : undefined;
  const live = fs.existsSync(path.join(REPO, f));
  const row = redone.get(pandId);
  return {
    pandId, source: sources[pandId] ?? null, spec: f, tile: tile ? tile.replace(/^public\/data\/extracts\/amsterdam\//, '') : null,
    action: row ? 'replace' : 'restore',
    ...(row ? { by: `artifacts/house-rows/staging/${row}/${pandId}.json (house:rows ${row})` } : { do: live ? `git rm ${f}` : 'already gone' }),
    ...(stagedNotTaken.has(pandId) ? { stagedRowNotSignedOff: stagedNotTaken.get(pandId) } : {}),
    preD1: pre === undefined ? 'absent (the pand drew from its other sources / the hash path)' : 'present (a record from other sources; the rebuild restores it)',
    specChangedSinceBatch: live ? changedSince(f) : null,
  };
});
const restore = fronts.filter(f => f.action === 'restore'), replace = fronts.filter(f => f.action === 'replace');
const bySource = (xs: typeof fronts) => Object.entries(xs.reduce<Record<string, number>>((a, f) => { const k = (f.source ?? 'unknown').split(':').slice(0, 2).join(':'); a[k] = (a[k] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
const report = {
  commit, rows: rowsTaken ? [...rowsTaken] : 'staged', total: fronts.length, restore: restore.length, replace: replace.length, specsModifiedByCommit: modifiedSpecs.length,
  byTile: Object.fromEntries([...new Set(fronts.map(f => f.tile ?? 'none'))].sort().map(t => [t, { restore: restore.filter(f => (f.tile ?? 'none') === t).length, replace: replace.filter(f => (f.tile ?? 'none') === t).length }])),
  restoredFromUnsignedRows: fronts.filter(f => f.stagedRowNotSignedOff).map(f => ({ pandId: f.pandId, row: f.stagedRowNotSignedOff })),
  tilesToRebuild: [...new Set(restore.map(f => f.tile).filter(Boolean))].sort(),
  tilesInCommit: tiles.length,
  preD1Absent: restore.filter(f => f.preD1.startsWith('absent')).length,
  changedSinceBatch: restore.filter(f => f.specChangedSinceBatch).map(f => f.pandId),
  bySource: Object.fromEntries(bySource(restore)),
  steps: [
    `git rm the ${restore.length} spec files listed under fronts[action=restore].do`,
    'npm run house:specs -- --publish (rebuilds tilesToRebuild from the remaining specs; the 177 records that gained route-A v.fields in the batch keep them: those fields are not D1)',
    'for each restored pand: its tile record matches preD1 (absent stays absent; present comes back from its other sources)',
    `the ${replace.length} replaced fronts publish from house:rows staging in the same round (David's sign-off first)`,
    'world:compile --changed --no-policy --shell; covers and frontages re-baked',
  ],
  fronts,
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 1) + '\n');
console.log(`batch 1 (${commit}): ${fronts.length} fronts; restore ${restore.length}, replaced by round 1 ${replace.length}; spec files modified by the commit: ${modifiedSpecs.length}`);
console.log(`tiles to rebuild: ${report.tilesToRebuild.length} (${report.tilesToRebuild.join(', ')})`);
console.log(`pre-D1 record absent for ${report.preD1Absent} of ${restore.length}; specs changed since the batch: ${report.changedSinceBatch.length}`);
console.log(`by source: ${bySource(restore).map(([k, n]) => `${k} ${n}`).join(', ')}`);
console.log(`rows taken: ${rowsTaken ? [...rowsTaken].join(', ') : 'every staged row'}`);
console.log(`per tile (restore/replace): ${Object.entries(report.byTile).map(([t, c]) => `${t} ${c.restore}/${c.replace}`).join(', ')}`);
console.log(`replaced: ${replace.map(f => `${f.pandId} (${f.by?.split(' ')[0]})`).join(', ') || '-'}`);
console.log(`restored although staged (row not signed off): ${report.restoredFromUnsignedRows.map(f => `${f.pandId} (${f.row})`).join(', ') || '-'}`);
console.log(`-> ${path.relative(REPO, out)}`);
