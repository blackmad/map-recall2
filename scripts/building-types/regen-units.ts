/**
 * Rebuild the published unit GLBs from the current type specs, at the nominal size and design key each unit file already records.
 * Used when a spec changes the look (palette tints, bay details) without changing a unit's nominal dimensions, so the
 * per-instance scales in instances.json stay valid.
 *
 *   node --import tsx scripts/building-types/regen-units.ts [--dir=public/canal-drive/building-types] [--only=<unit-substring>]
 *
 * The unit file's node extras hold {key: "type|variant|storeys|roofForm|ridge|groundMode", nominal: {L0, W0, E0, R0}} (build.ts writes them).
 */
import fs from 'node:fs';
import path from 'node:path';
import {NodeIO} from '@gltf-transform/core';
import {EXTMeshGPUInstancing, KHRMeshQuantization, EXTMeshoptCompression} from '@gltf-transform/extensions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';
import {generate} from '../../src/canalRecall/buildingTypes/generate.ts';
import {validateSpec, type TypeSpec} from '../../src/canalRecall/buildingTypes/spec.ts';
import {writeTypeGlb} from '../../src/canalRecall/buildingTypes/glb.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const dir = arg('dir', 'public/canal-drive/building-types'), only = arg('only');
const TYPES_DIR = 'src/canalRecall/buildingTypes/types';
const specs = new Map<string, TypeSpec>();
for (const f of fs.readdirSync(TYPES_DIR).filter(f => f.endsWith('.json'))) {
  const s = JSON.parse(fs.readFileSync(path.join(TYPES_DIR, f), 'utf8')) as TypeSpec;
  const e = validateSpec(s);
  if (e.length) throw new Error(`${f}: ${e.join('; ')}`);
  specs.set(s.id, s);
}
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions([KHRMeshQuantization, EXTMeshoptCompression, EXTMeshGPUInstancing]).registerDependencies({'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder});

let changed = 0;
for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.glb') && (!only || f.includes(only)))) {
  const doc = await io.read(path.join(dir, file));
  const extras = doc.getRoot().listNodes().map(n => n.getExtras() as {key?: string; nominal?: {L0: number; W0: number; E0: number; R0?: number}}).find(e => e.key && e.nominal);
  if (!extras?.key || !extras.nominal) { console.warn('skip (no key/nominal extras)', file); continue; }
  const [type, variant, storeys, roofForm, ridge, groundMode, ...rest] = extras.key.split('|'), mirror = rest.includes('mirror'), sides = rest.find(r => r !== 'mirror');
  const spec = specs.get(type);
  if (!spec) { console.warn('skip (unknown type)', file, type); continue; }
  const {L0, W0, E0, R0} = extras.nominal;
  const {mesh} = generate(spec, {lengthM: L0, widthM: W0, eavesM: E0, ridgeM: R0, storeys: Number(storeys), variant, roofForm: roofForm as 'gable', ridge: ridge as 'long', groundMode: groundMode as 'solid', ...(mirror ? {mirror: true} : {}), ...(sides ? {freeSides: {left: sides === 'endL' || sides === 'free', right: sides === 'endR' || sides === 'free'}} : {})});
  const out = await writeTypeGlb(file.replace(/\.glb$/, ''), mesh, {key: extras.key, nominal: extras.nominal});
  const before = fs.readFileSync(path.join(dir, file));
  if (Buffer.compare(before, Buffer.from(out.bytes)) !== 0) { fs.writeFileSync(path.join(dir, file), out.bytes); changed++; console.log('rewrote', file, `${before.length} -> ${out.bytes.length} bytes, ${mesh.triangles} triangles`); }
}
console.log(`${changed} unit(s) rewritten`);
