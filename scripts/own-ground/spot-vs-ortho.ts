// Orthophoto beside the own-ground top-down at any spot (lane fb-bridges-20261119): the road-vs-ortho sheet for a
// feedback note's bridge without a ROAD_SPOTS entry, optionally with a game frame on the right.
//
//   node --import tsx scripts/own-ground/spot-vs-ortho.ts <id> <lng,lat> [--half=30] [--frame=path.jpg] [--dir=artifacts/fb-bridges]
//     [--opt=name=false,...]   GroundStore options (a fix's flag off: the before)
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname, basename } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, type BuiltCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { writeVsOrtho } from './road-vs-ortho.ts';
import { OrthoTiles } from './ortho.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const [id, at] = process.argv.slice(2);
const opts: Record<string, boolean> = { roads: true };
for (const kv of (flag('opt') ?? '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); opts[k] = v !== 'false'; }
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, opts);
await store.init();
const [lng, lat] = at.split(',').map(Number), [cx, cy] = toLocal(lng, lat), half = Number(flag('half') ?? 30);
const keys = new Set<string>();
for (const dx of [-half, 0, half]) for (const dy of [-half, 0, half]) keys.add(store.cellAt(cx + dx, cy + dy));
const cells: BuiltCell[] = [];
for (const k of keys) if (store.covers(k)) cells.push(buildCell(await store.cellInput(k, 0)));
const frame = flag('frame');
// writeVsOrtho reads <frames>/desktop-<id>.png; pass the frame's directory and name the spot after its file.
const spotId = frame ? basename(frame).replace(/^desktop-/, '').replace(/\.(png|jpg)$/, '') : id;
const out = await writeVsOrtho(cells, { id: spotId, label: `${id} ${at}${flag('opt') ? ` (${flag('opt')})` : ''}`, at: [lng, lat], bearing: 0, halfM: half, backM: 0 }, new OrthoTiles(), { dir: flag('dir') ?? 'artifacts/fb-bridges', ...(frame ? { frames: dirname(frame) } : {}) });
console.log(out);
