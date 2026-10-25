/**
 * Rebuild the published unit GLBs from the current type specs, at the nominal size and design key each unit file already records.
 * Used when a spec changes the look (palette tints, bay details) without changing a unit's nominal dimensions, so the
 * per-instance scales in instances.json stay valid.
 *
 *   node --import tsx scripts/building-types/regen-units.ts [--dir=public/canal-drive/building-types] [--only=<unit-substring>] [--roof-only]
 *
 * --roof-only (issue #75): recolour the roof material of each unit in place from its spec's `palette.roof` (tint, name, base
 * colour, `tintSource: measured` extras) and leave the geometry as published. For units whose build used per-area facts the
 * nominal size does not carry (mono-pitch back eaves, eaves from 3DBAG planes), where a full regeneration would move vertices.
 *
 * --mottle-only --from=<#tint,...> (issue #77): give the brick material(s) whose published tint is one of `--from` the variant's
 * `palette.wall` (tint, measured, `mottle` extra) in place, geometry untouched. `--from` names the old wall tints explicitly, so a
 * plinth or gable brick of another tint is never touched.
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
const dir = arg('dir', 'public/canal-drive/building-types'), only = arg('only'), ROOF_ONLY = process.argv.includes('--roof-only'), MOTTLE_ONLY = process.argv.includes('--mottle-only');
const FROM = new Set(arg('from').split(',').filter(Boolean).map(t => t.toLowerCase()));
if (MOTTLE_ONLY && !FROM.size) throw new Error('--mottle-only needs --from=<old wall tints>');
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
  const [type, variant, storeys, roofForm, ridge, groundMode, ...rest] = extras.key.split('|'), mirror = rest.includes('mirror'), sides = rest.find(r => r !== 'mirror' && !/^f\d+d\d+$/.test(r)); // size-class token (spec.sizeClassesM) is not a sides token
  const spec = specs.get(type);
  if (!spec) { console.warn('skip (unknown type)', file, type); continue; }
  if (MOTTLE_ONLY) {
    const wall = spec.variants[variant]?.palette.wall;
    if (!wall?.mottle) { console.warn('skip (variant wall has no mottle)', file, variant); continue; }
    let n = 0;
    for (const m of doc.getRoot().listMaterials()) {
      const ex = m.getExtras() as {materialSlot?: string; tint?: string};
      if (ex.materialSlot !== 'brick' || !FROM.has(String(ex.tint).toLowerCase())) continue;
      const lin = [1, 3, 5].map(i => parseInt(wall.tint.slice(i, i + 2), 16) / 255).map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      const extras: Record<string, unknown> = wall.measured ? {materialSlot: 'brick', tint: wall.tint, tintSource: 'measured'} : {materialSlot: 'brick', tint: wall.tint};
      extras.mottle = wall.mottle.tones.map(t => ({hex: t.hex, share: t.share}));
      m.setName(`brick_${wall.tint.slice(1)}${wall.measured ? '_measured' : ''}_mottled`).setBaseColorFactor([lin[0], lin[1], lin[2], 1]).setExtras(extras);
      n++;
    }
    const bytes = await io.writeBinary(doc), before = fs.readFileSync(path.join(dir, file));
    if (n && Buffer.compare(before, Buffer.from(bytes)) !== 0) { fs.writeFileSync(path.join(dir, file), bytes); changed++; console.log('mottled wall', file, `${n} material(s) -> ${wall.tint} (${wall.mottle.tones.length} tones)`); }
    continue;
  }
  if (ROOF_ONLY) {
    const roof = spec.variants[variant]?.palette.roof;
    if (!roof) { console.warn('skip (unknown variant)', file, variant); continue; }
    let n = 0;
    for (const m of doc.getRoot().listMaterials()) {
      const ex = m.getExtras() as {materialSlot?: string; tint?: string; tintSource?: string};
      if (ex.materialSlot !== roof.slot) continue;
      const lin = [1, 3, 5].map(i => parseInt(roof.tint.slice(i, i + 2), 16) / 255).map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      m.setName(`${roof.slot}_${roof.tint.slice(1)}${roof.measured ? '_measured' : ''}`).setBaseColorFactor([lin[0], lin[1], lin[2], 1])
        .setExtras(roof.measured ? {materialSlot: roof.slot, tint: roof.tint, tintSource: 'measured'} : {materialSlot: roof.slot, tint: roof.tint});
      n++;
    }
    const bytes = await io.writeBinary(doc), before = fs.readFileSync(path.join(dir, file));
    if (n && Buffer.compare(before, Buffer.from(bytes)) !== 0) { fs.writeFileSync(path.join(dir, file), bytes); changed++; console.log('recoloured roof', file, `${n} material(s) -> ${roof.tint}${roof.measured ? ' measured' : ''}`); }
    continue;
  }
  const {L0, W0, E0, R0} = extras.nominal;
  const {mesh} = generate(spec, {lengthM: L0, widthM: W0, eavesM: E0, ridgeM: R0, storeys: Number(storeys), variant, roofForm: roofForm as 'gable', ridge: ridge as 'long', groundMode: groundMode as 'solid', ...(mirror ? {mirror: true} : {}), ...(sides ? {freeSides: {left: sides === 'endL' || sides === 'free', right: sides === 'endR' || sides === 'free'}} : {})});
  const out = await writeTypeGlb(file.replace(/\.glb$/, ''), mesh, {key: extras.key, nominal: extras.nominal});
  const before = fs.readFileSync(path.join(dir, file));
  if (Buffer.compare(before, Buffer.from(out.bytes)) !== 0) { fs.writeFileSync(path.join(dir, file), out.bytes); changed++; console.log('rewrote', file, `${before.length} -> ${out.bytes.length} bytes, ${mesh.triangles} triangles`); }
}
console.log(`${changed} unit(s) rewritten`);
