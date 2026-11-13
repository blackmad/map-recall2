/**
 * Landmark re-crop (lane landmark-recrop-20261113): second crops for queue rows triage called `no-evidence` because
 * their street walls had no judgeable crop. For every non-judgeable street wall in the row's triage reasons it lists the
 * other panoramas that stand in the judge's window (obliquity <= LIKENESS.maxObliquityDeg, camera >= LIKENESS.minCameraM
 * on a wide wall, captured after the BAG build year, a pano the wall's crops have not used), leaf-off captures (Nov-Mar)
 * first, and cuts them one at a time with all-walls.ts (`--walls --suffix=r<k> --date=<day> --exclude-pano`) until a crop
 * clears the walls.json thresholds (foliage, washed-out, missing). No threshold is loosened: triage re-measures the crop.
 *
 *   node --import tsx scripts/landmarks/recrop.ts [--pands=a,b | --all] [--k=3] [--dry] [--bytes-out=<json>]
 *
 * Needs MAP_RECALL_SOURCE_DATA (crops are written there with --archive). --dry lists candidates and the panorama bytes
 * they would download (uncached), changing nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {CACHE_DIR} from '../pand-reference/core.ts';
import {listPanos, rankPanos, type RankWindow} from '../pand-reference/select.ts';
import {LIKENESS} from '../../src/canalRecall/buildingRecipe/likeness.ts';
import {cropPredatesBuilding} from '../../src/canalRecall/buildingRecipe/measureWriteback.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const has = (f: string) => process.argv.includes(f);
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const root = path.join(process.env.MAP_RECALL_SOURCE_DATA!, 'pand-reference-walls');
const K = Number(arg('k', '3')), dry = has('--dry');
const QUEUE = 'public/canal-drive/landmark-factory-queue.json';
const queue = read(QUEUE).items as any[];
const only = new Set(arg('pands').split(',').filter(Boolean));
const targets = queue.filter(i => i.status === 'crops' && i.triage?.verdict === 'no-evidence' && i.pand && (has('--all') || only.has(i.pand)));
const WIN: RankWindow = {minD: 5, maxD: 60, strict: [8, 25], maxObliquityDeg: LIKENESS.maxObliquityDeg};
const leafOff = (ts: string) => { const m = Number(ts.slice(5, 7)); return m <= 3 || m >= 11; };
const panoHref = (rec: any) => rec._links?.equirectangular_full?.href ?? rec._links?.equirectangular_medium?.href;
const cached = (href: string) => fs.existsSync(path.join(CACHE_DIR, crypto.createHash('sha1').update(href).digest('hex') + '.jpg'));

const log: any[] = []; let estBytes = 0, estPanos = 0;
for (const item of targets) {
  const pand = item.pand as string, dir = path.join(root, pand), wf = path.join(dir, 'walls.json');
  if (!fs.existsSync(wf)) { log.push({pand, skip: 'no walls.json'}); continue; }
  const walls = read(wf).walls as any[];
  const bad = new Map<string, string>();
  for (const r of item.triage.reasons as string[]) { const m = /^(w\d+) \(.*, (\d+) m\): (.*)$/.exec(r); if (m) bad.set(m[1], m[3]); }
  const builtYear = Number(/predates the (\d{4}) building/.exec(item.triage.reasons.join(' '))?.[1]) || null;
  for (const [wk, why] of bad) {
    const rows = walls.filter(w => (/^w\d+/.exec(w.tag)?.[0] ?? w.tag) === wk);
    const base = rows.find(r => r.wallRD);
    if (!base) { log.push({pand, wall: wk, skip: 'no wallRD'}); continue; }
    const [ax, ay] = base.wallRD.a, [bx, by] = base.wallRD.b, [nx, ny] = base.wallRD.normal;
    const wall = {a: {x: ax, y: ay}, b: {x: bx, y: by}, len: base.lengthM, nx, ny, mid: {x: (ax + bx) / 2, y: (ay + by) / 2}, roadDistM: 0, facing: 0};
    const used = new Set(rows.map(r => r.panoId).filter(Boolean));
    const ranked = rankPanos(wall as any, await listPanos(wall.mid, 60), WIN)
      .filter(c => !used.has(c.panoId) && !(base.lengthM > LIKENESS.wideWallM && c.distM < LIKENESS.minCameraM) && !cropPredatesBuilding(c.timestamp, builtYear));
    // one pano per capture day (the straightest), leaf-off days first, then strict range, then straightest
    const perDay = new Map<string, typeof ranked[0]>();
    for (const c of ranked) { const d = c.timestamp.slice(0, 10); if (!perDay.has(d)) perDay.set(d, c); }
    const pick = [...perDay.values()].sort((a, b) => Number(leafOff(b.timestamp)) - Number(leafOff(a.timestamp)) || Number(a.relaxed) - Number(b.relaxed) || a.obliquityDeg - b.obliquityDeg);
    const rec: any = {pand, name: item.name, wall: wk, why, tried: rows.map(r => `${r.capturedAt}`), candidates: pick.length, picks: [] as any[]};
    log.push(rec);
    let k = 0;
    for (const c of pick) {
      if (k >= K) break;
      const href = panoHref(c.record), miss = href && !cached(href);
      rec.picks.push({day: c.timestamp.slice(0, 10), distM: +c.distM.toFixed(1), obl: +c.obliquityDeg.toFixed(1), leafOff: leafOff(c.timestamp), uncached: !!miss});
      if (miss) { estPanos++; estBytes += 2.9e6; }
      k++;
      if (dry) continue;
      const n = Number(wk.slice(1)), suffix = `r${k}`;
      const r = spawnSync('node', ['--import', 'tsx', 'scripts/pand-reference/all-walls.ts', `--pand=${pand}`, '--archive', '--min-len=8', '--max=12', `--walls=${n}`, `--suffix=${suffix}`,
        `--date=${c.timestamp.slice(0, 10)}`, `--exclude-pano=${[...used].join(',')}`, ...(c.distM > 35 ? [`--max-dist=${Math.ceil(c.distM) + 1}`] : [])], {encoding: 'utf8', timeout: 600000});
      if (r.status !== 0) { rec.picks[rec.picks.length - 1].error = (r.stderr || r.stdout).slice(-200); continue; }
      const fresh = (read(wf).walls as any[]).filter(w => w.tag.startsWith(wk) && w.tag.endsWith(suffix) || w.tag.endsWith(`${suffix}L`));
      const row = fresh.find(w => w.crop && w.panoId && !used.has(w.panoId));
      if (row) used.add(row.panoId);
      const pk = rec.picks[rec.picks.length - 1];
      pk.tag = row?.tag; pk.foliage = row?.foliage; pk.washedOut = row?.washedOut; pk.missing = row?.missingFraction; pk.obl = row?.obliquityDeg ?? pk.obl;
      if (row && (row.foliage ?? 0) <= LIKENESS.maxFoliage && (row.washedOut ?? 0) <= LIKENESS.maxWashedOut && (row.missingFraction ?? 0) <= 1 - LIKENESS.minUsable) { pk.clean = true; break; }
    }
  }
}
console.log(JSON.stringify({dry, walls: log.length, estUncachedPanos: estPanos, estGB: +(estBytes / 1e9).toFixed(2)}));
fs.mkdirSync('artifacts/recrop', {recursive: true});
fs.writeFileSync(arg('bytes-out', dry ? 'artifacts/recrop/dry.json' : 'artifacts/recrop/run.json'), JSON.stringify({estPanos, estGB: estBytes / 1e9, log}, null, 1));
