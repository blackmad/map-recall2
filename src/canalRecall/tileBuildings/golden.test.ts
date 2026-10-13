/**
 * Compiler golden on the pilots: recompiles four z16 tiles (Bilderdijkstraat faces + a landmark, a large recipe,
 * three landmarks as kind glb, a Nieuw-West type tile) into a scratch directory and compares, per pand, the
 * triangle count, the content hash of its triangles and its unit hash with the committed golden.
 *   node --import tsx --test src/canalRecall/tileBuildings/golden.test.ts
 *   UPDATE_GOLDEN=1 node --import tsx --test src/canalRecall/tileBuildings/golden.test.ts   # after a reviewed change
 * Needs the source pack (BLOCK_FACE_SOURCE_PACK or ../map-recall2-source-data/models); skipped without it.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

const GOLDEN = new URL('./pilot-golden.json', import.meta.url).pathname;
const TILES = ['16/33655/21538', '16/33656/21539', '16/33657/21536', '16/33638/21541'];
const PACK = process.env.BLOCK_FACE_SOURCE_PACK || '/Users/blackmad/Code/map-recall2-source-data/models';

type Row = {kind: string; triangles: number; triangleHash: string; unit: string | null};

function compile(out: string, ...args: string[]): void {
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/building-tiles/compile-recipes.ts', `--out=${out}`, ...args], {encoding: 'utf8', maxBuffer: 1 << 26});
  assert.equal(r.status, 0, `${args.join(' ')}\n${r.stderr.slice(-2000)}`);
}

test('compiler golden: pilot tiles hash per pand as committed', {skip: !existsSync(PACK) && `no source pack at ${PACK}`, timeout: 600_000}, () => {
  const out = mkdtempSync(join(tmpdir(), 'recipe-golden-'));
  try {
    compile(out, '--stage=recipes');
    const got: Record<string, Record<string, Row>> = {};
    for (const tile of TILES) {
      compile(out, '--stage=mesh', `--tile=${tile}`);
      const report = JSON.parse(readFileSync(join(out, 'reports', `${tile}.json`), 'utf8'));
      assert.deepEqual(report.failed ?? {}, {}, `${tile}: gates`);
      got[tile] = Object.fromEntries(Object.entries(report.pands as Record<string, any>).sort(([a], [b]) => a.localeCompare(b))
        .map(([pand, p]) => [pand, {kind: p.kind, triangles: p.triangles, triangleHash: p.triangleHash, unit: p.unit ?? null}]));
    }
    if (process.env.UPDATE_GOLDEN === '1' || !existsSync(GOLDEN)) { writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + '\n'); return; }
    const want = JSON.parse(readFileSync(GOLDEN, 'utf8'));
    for (const tile of TILES) assert.deepEqual(got[tile], want[tile], `${tile}: per-pand geometry changed (review, then UPDATE_GOLDEN=1)`);
  } finally {
    rmSync(out, {recursive: true, force: true});
  }
});
