// node --import tsx scripts/check-landmark-attachment.ts [id...]
// Near-bar lane: no facade part may float. Details (everything after the builder's mark('shell')) must be
// within 5 cm of the shell or of another attached detail; also checks bounds, triangle cap and the GLB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingTools} from './landmarks/cultural-builders';
import {measureAttachment} from './landmarks/attachment';
import {buildKlimhal} from './landmarks/klimhal-builder';
import {buildIjToren} from './landmarks/ij-toren-builder';
import {buildSymphony} from './landmarks/symphony-builder';
import {buildClubPanama} from './landmarks/club-panama-builder';
import {buildCompagnietheater} from './landmarks/compagnietheater-builder';
import {buildAronSchusterSynagoge} from './landmarks/aron-schuster-synagoge-builder';
import {buildMuiderkerk} from './landmarks/muiderkerk-builder';
import {buildNassaukerk} from './landmarks/nassaukerk-builder';
import {buildZuiderkerk} from './landmarks/zuiderkerk-builder';
import {buildThomaskerk} from './landmarks/thomaskerk-builder';
import {buildWillemDeZwijgerkerk} from './landmarks/willem-de-zwijgerkerk-builder';
import {buildVanGendtHallen} from './landmarks/van-gendt-hallen-builder';
import {buildVrijburg} from './landmarks/vrijburg-builder';
import {buildWestIndiaHouse} from './landmarks/west-india-house-builder';
import {buildZevenlandenhuizen} from './landmarks/zevenlandenhuizen-builder';
import {buildSeaPalace} from './landmarks/sea-palace-builder';
import {buildDeSchool} from './landmarks/de-school-builder';
import {buildWestIndischPakhuis} from './landmarks/west-indisch-pakhuis-builder';
import {discoveryACases} from './landmarks/attachment-cases-discovery-a';
import {buildChristChurchGroenburgwal} from './landmarks/christ-church-groenburgwal-builder';
import {buildLjgSynagoge} from './landmarks/ljg-synagoge-builder';
import {buildVondelkerk} from './landmarks/vondelkerk-builder';
import {buildLloydHotel} from './landmarks/lloyd-hotel-builder';
import {buildRondeLutherseKerk} from './landmarks/ronde-lutherse-kerk-builder';
import {buildHotelOkura} from './landmarks/hotel-okura-builder';
import {buildPakhuisDeZwijger} from './landmarks/pakhuis-de-zwijger-builder';
import {buildVictoriaHotel} from './landmarks/victoria-hotel-builder';
import {buildWoongebouwWladiwostok} from './landmarks/woongebouw-wladiwostok-builder';

const cases: Record<string, {build: (w: number, d: number, b: never) => void; ring: () => number[][]; top: () => number; topSlack: number}> = {
  'ij-toren': {build: buildIjToren, ring: () => JSON.parse(fs.readFileSync('scripts/landmarks/ij-toren-footprints.json', 'utf8')).nativeRing, top: () => { const f = JSON.parse(fs.readFileSync('scripts/landmarks/ij-toren-footprints.json', 'utf8')); return Math.max(...f.surfaces.flatMap((s: any) => s.rings.flat().map((v: number[]) => v[1]))); }, topSlack: 8},
  'symphony': {build: buildSymphony, ring: () => JSON.parse(fs.readFileSync('scripts/landmarks/symphony-footprints.json', 'utf8')).nativeRing, top: () => { const f = JSON.parse(fs.readFileSync('scripts/landmarks/symphony-footprints.json', 'utf8')); return Math.max(...f.surfaces.flatMap((s: any) => s.rings.flat().map((v: number[]) => v[1]))); }, topSlack: 3},
  'klimhal': {build: buildKlimhal, ring: () => JSON.parse(fs.readFileSync('scripts/landmarks/klimhal-footprints.json', 'utf8')).nativeRing, top: () => { const f = JSON.parse(fs.readFileSync('scripts/landmarks/klimhal-footprints.json', 'utf8')); return Math.max(...f.surfaces.flatMap((s: any) => s.rings.flat().map((v: number[]) => v[1]))); }, topSlack: 0.5},
  'club-panama': {build: buildClubPanama, ring: () => JSON.parse(fs.readFileSync('scripts/landmarks/club-panama-footprints.json', 'utf8')).nativeRing, top: () => { const f = JSON.parse(fs.readFileSync('scripts/landmarks/club-panama-footprints.json', 'utf8')); return Math.max(...f.surfaces.flatMap((s: any) => s.rings.flat().map((v: number[]) => v[1]))); }, topSlack: 2.2},
  'compagnietheater': {build: buildCompagnietheater, ring: () => JSON.parse(fs.readFileSync('scripts/landmarks/compagnietheater-footprints.json', 'utf8')).ring[0], top: () => Math.max(...JSON.parse(fs.readFileSync('scripts/landmarks/compagnietheater-footprints.json', 'utf8')).roofs.flatMap((r: any) => r.rings.flat().map((p: number[]) => p[1]))), topSlack: 1.0},
  'west-india-house': {build: buildWestIndiaHouse, ring: () => JSON.parse(fs.readFileSync('scripts/landmarks/west-india-house-footprints.json', 'utf8')).ring[0], top: () => Math.max(...JSON.parse(fs.readFileSync('scripts/landmarks/west-india-house-footprints.json', 'utf8')).roofs.flatMap((r: any) => r.rings.flat().map((p: number[]) => p[1]))), topSlack: 1.0},
  'nassaukerk': {build: buildNassaukerk, ring: () => JSON.parse(fs.readFileSync('scripts/landmarks/nassaukerk-footprints.json', 'utf8')).nativeRing, top: () => Math.max(...JSON.parse(fs.readFileSync('scripts/landmarks/nassaukerk-footprints.json', 'utf8')).surfaces.flatMap((s: any) => s.rings.flat().map((v: number[]) => v[1]))), topSlack: 1.0},
  'zuiderkerk': {build: buildZuiderkerk, ring: () => JSON.parse(fs.readFileSync('scripts/landmarks/zuiderkerk-footprints.json', 'utf8')).nativeRing, top: () => Math.max(...JSON.parse(fs.readFileSync('scripts/landmarks/zuiderkerk-footprints.json', 'utf8')).surfaces.flatMap((s: any) => s.rings.flat().map((v: number[]) => v[1]))), topSlack: 7.0},
  'muiderkerk': {build: buildMuiderkerk, ring: () => JSON.parse(fs.readFileSync('scripts/landmarks/muiderkerk-footprints.json', 'utf8')).nativeRing, top: () => Math.max(...JSON.parse(fs.readFileSync('scripts/landmarks/muiderkerk-footprints.json', 'utf8')).surfaces.flatMap((s: any) => s.rings.flat().map((v: number[]) => v[1]))), topSlack: 1.0},
  'aron-schuster-synagoge': {build: buildAronSchusterSynagoge, ring: () => JSON.parse(fs.readFileSync('scripts/landmarks/aron-schuster-synagoge-footprints.json', 'utf8')).nativeRing, top: () => Math.max(...JSON.parse(fs.readFileSync('scripts/landmarks/aron-schuster-synagoge-footprints.json', 'utf8')).surfaces.flatMap((s: any) => s.rings.flat().map((v: number[]) => v[1]))), topSlack: 1.0},
  'thomaskerk': {build: buildThomaskerk, ring: () => JSON.parse(fs.readFileSync('scripts/landmarks/thomaskerk-footprints.json', 'utf8')).nativeRing, top: () => Math.max(...JSON.parse(fs.readFileSync('scripts/landmarks/thomaskerk-footprints.json', 'utf8')).surfaces.flatMap((s: any) => s.rings.flat().map((v: number[]) => v[1]))), topSlack: 3.0},
  'willem-de-zwijgerkerk': {build: buildWillemDeZwijgerkerk, ring: () => JSON.parse(fs.readFileSync('scripts/landmarks/willem-de-zwijgerkerk-footprints.json', 'utf8')).nativeRing, top: () => Math.max(...JSON.parse(fs.readFileSync('scripts/landmarks/willem-de-zwijgerkerk-footprints.json', 'utf8')).surfaces.flatMap((s: any) => s.rings.flat().map((v: number[]) => v[1]))), topSlack: 1.0},
  'vrijburg': {build: buildVrijburg, ring: () => JSON.parse(fs.readFileSync('scripts/landmarks/vrijburg-footprints.json', 'utf8')).nativeRing, top: () => Math.max(...JSON.parse(fs.readFileSync('scripts/landmarks/vrijburg-footprints.json', 'utf8')).surfaces.flatMap((s: any) => s.rings.flat().map((v: number[]) => v[1]))), topSlack: 10},
  'van-gendt-hallen': {build: buildVanGendtHallen, ring: () => JSON.parse(fs.readFileSync('scripts/landmarks/van-gendt-hallen-footprints.json', 'utf8')).nativeRing, top: () => Math.max(...JSON.parse(fs.readFileSync('scripts/landmarks/van-gendt-hallen-footprints.json', 'utf8')).surfaces.flatMap((s: any) => s.rings.flat().map((v: number[]) => v[1]))), topSlack: 1.0},
};
const zlRow = () => JSON.parse(fs.readFileSync('scripts/landmarks/zevenlandenhuizen-footprints.json', 'utf8')).houses as {nativeRing: number[][]; surfaces: any[]}[];
cases['zevenlandenhuizen'] = {build: buildZevenlandenhuizen, ring: () => zlRow().flatMap(h => h.nativeRing), top: () => Math.max(...zlRow().flatMap(h => h.surfaces.flatMap((s: any) => s.rings.flat().map((v: number[]) => v[1])))), topSlack: 2.5};
const seaPalace = () => JSON.parse(fs.readFileSync('scripts/landmarks/sea-palace-footprints.json', 'utf8'));
// A floating vessel has no 3DBAG shell: the hull rectangle is the ring and the mapped OSM height (9 m + 4 m roof) the top.
cases['sea-palace'] = {build: buildSeaPalace, ring: () => seaPalace().nativeRing, top: () => seaPalace().topMetres, topSlack: 1.6};
const deSchool = () => JSON.parse(fs.readFileSync('scripts/landmarks/de-school-footprints.json', 'utf8'));
cases['de-school'] = {build: buildDeSchool, ring: () => deSchool().nativeRing, top: () => Math.max(...deSchool().surfaces.flatMap((s: any) => s.rings.flat().map((v: number[]) => v[1]))), topSlack: 1.0};
const wip = () => JSON.parse(fs.readFileSync('scripts/landmarks/west-indisch-pakhuis-footprints.json', 'utf8'));
cases['west-indisch-pakhuis'] = {build: buildWestIndischPakhuis, ring: () => wip().nativeRing, top: () => Math.max(...wip().surfaces.flatMap((s: any) => s.rings.flat().map((v: number[]) => v[1]))), topSlack: 1.0};
Object.assign(cases, discoveryACases);
const christChurch = () => JSON.parse(fs.readFileSync('scripts/landmarks/christ-church-groenburgwal-footprints.json', 'utf8'));
cases['christ-church-groenburgwal'] = {build: buildChristChurchGroenburgwal, ring: () => christChurch().nativeRing, top: () => Math.max(...christChurch().surfaces.flatMap((s: any) => s.rings.flat().map((v: number[]) => v[1]))), topSlack: 3.0};
const ljg = () => JSON.parse(fs.readFileSync('scripts/landmarks/ljg-synagoge-footprints.json', 'utf8'));
cases['ljg-synagoge'] = {build: buildLjgSynagoge, ring: () => ljg().nativeRing, top: () => Math.max(...ljg().surfaces.flatMap((s: any) => s.rings.flat().map((v: number[]) => v[1]))), topSlack: 1.0};
// Vondelkerk: 3DBAG LoD2.2 truncates the crossing spire at 36.1 m (AHN misses the needle); the church's tower is documented as about 50 m
// before the 1904 rebuild, and measures about 47-48 m against the ridge in the photographs, so the top slack covers that gap only.
const vk = () => JSON.parse(fs.readFileSync('scripts/landmarks/vondelkerk-footprints.json', 'utf8'));
cases['vondelkerk'] = {build: buildVondelkerk, ring: () => vk().nativeRing, top: () => Math.max(...vk().surfaces.flatMap((s: any) => s.rings.flat().map((v: number[]) => v[1]))), topSlack: 13};
// Lloyd Hotel: 3DBAG roofMax 27.42 m NAP on a 1.45 m ground gives 26.0 m for the dome; the model adds the finial and ship vane (28.8 m).
const lh = () => JSON.parse(fs.readFileSync('scripts/landmarks/lloyd-hotel-footprints.json', 'utf8'));
cases['lloyd-hotel'] = {build: buildLloydHotel, ring: () => lh().nativeRing, top: () => lh().attributes.roofMaxNAP - lh().groundNAP, topSlack: 3.5};
// Ronde Lutherse Kerk: 3DBAG roofMax 43.3 m NAP (lantern cap) on 0.46 m ground; the model adds the green ball and swan vane above it (45.8 m).
const rl = () => JSON.parse(fs.readFileSync('scripts/landmarks/ronde-lutherse-kerk-footprints.json', 'utf8'));
cases['ronde-lutherse-kerk'] = {build: buildRondeLutherseKerk, ring: () => rl().nativeRing, top: () => rl().attributes.roofMaxNAP - rl().groundNAP, topSlack: 3.5};
// Hotel Okura: 3DBAG roofMax 79.7 m (plant boxes and mast above the 78 m canopy); the model's flagpole ends at 83.5 m.
const ok = () => JSON.parse(fs.readFileSync('scripts/landmarks/hotel-okura-footprints.json', 'utf8'));
cases['hotel-okura'] = {build: buildHotelOkura, ring: () => ok().nativeRing, top: () => ok().attributes.roofMaxNAP - ok().groundNAP, topSlack: 3.5};
// Pakhuis de Zwijger: 3DBAG roofMax 28.0 m NAP (rooftop block) on 0.52 m ground; the model adds hoods only below that.
const pz = () => JSON.parse(fs.readFileSync('scripts/landmarks/pakhuis-de-zwijger-footprints.json', 'utf8'));
cases['pakhuis-de-zwijger'] = {build: buildPakhuisDeZwijger, ring: () => pz().nativeRing, top: () => pz().attributes.roofMaxNAP - pz().groundNAP, topSlack: 3.5};
// Victoria Hotel: 3DBAG roofMax 30.7 m NAP (dome lantern) on 1.58 m ground; the model's finial ends at 30.7 m above ground.
const vh = () => JSON.parse(fs.readFileSync('scripts/landmarks/victoria-hotel-footprints.json', 'utf8'));
cases['victoria-hotel'] = {build: buildVictoriaHotel, ring: () => vh().nativeRing, top: () => vh().attributes.roofMaxNAP - vh().groundNAP, topSlack: 3.5};
// Woongebouw Wladiwostok: 3DBAG roofMax 29.8 m NAP includes the roof mast on 1.5 m ground.
const ww = () => JSON.parse(fs.readFileSync('scripts/landmarks/woongebouw-wladiwostok-footprints.json', 'utf8'));
cases['woongebouw-wladiwostok'] = {build: buildWoongebouwWladiwostok, ring: () => ww().nativeRing, top: () => ww().attributes.roofMaxNAP - ww().groundNAP, topSlack: 5};
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(cases);
for (const id of ids) {
  const c = cases[id];
  assert(c, `unknown ${id}`);
  const gs: T.BufferGeometry[] = [];
  let shellCount = -1;
  const add: BuildingTools['add'] = (g, _c, x = 0, y = 0, z = 0, a = 0) => { g.rotateY(a); g.translate(x, y, z); gs.push(g); };
  const box: BuildingTools['box'] = (x, y, z, w, h, d, col, a = 0) => add(new T.BoxGeometry(w, h, d), col, x, y + h / 2, z, a);
  const unused = (): never => { throw Error('unused primitive'); };
  c.build(0, 0, {add, box, mark: () => { shellCount = gs.length; }, prism: unused, hip: unused, gableRoof: unused, window: unused, clock: unused, sign: unused} as never);
  assert(shellCount > 0, `${id}: builder must call b.mark('shell') after the shell`);
  const bounds = new T.Box3(); let tris = 0;
  for (const g of gs) {
    for (const v of g.getAttribute('position').array) assert(Number.isFinite(v));
    g.computeBoundingBox(); bounds.union(g.boundingBox!); tris += (g.index?.count ?? g.getAttribute('position').count) / 3;
  }
  assert(tris < 30000, `${id}: triangle cap ${tris}`);
  assert(bounds.min.y >= -0.02, `${id}: below ground ${bounds.min.y}`);
  const top = c.top();
  assert(bounds.max.y <= top + c.topSlack, `${id}: top ${bounds.max.y} vs shell ${top}`);
  const ring = c.ring(), xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
  const m = 1.0;
  assert(bounds.min.x >= Math.min(...xs) - m && bounds.max.x <= Math.max(...xs) + m && bounds.min.z >= Math.min(...zs) - m && bounds.max.z <= Math.max(...zs) + m, `${id}: parts outside footprint +${m} m`);
  const r = measureAttachment(gs.slice(0, shellCount), gs.slice(shellCount), Number(process.env.TOL ?? 0.05));
  console.log(JSON.stringify({id, triangles: tris, details: r.parts, maxGapCm: +(r.max * 100).toFixed(2), height: +bounds.max.y.toFixed(2), worst: r.worst.slice(0, Number(process.env.WORST ?? 8))}));
  assert(r.max <= 0.05, `${id}: ${r.worst.length} floating detail part(s), max gap ${(r.max * 100).toFixed(1)} cm`);
  const glb = `public/canal-drive/models/${id}.glb`;
  assert(fs.existsSync(glb), `${id}: GLB missing`);
}
