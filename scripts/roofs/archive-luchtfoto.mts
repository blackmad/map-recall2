/**
 * Archive the orthophoto tiles this lane pulled (`.cache/luchtfoto-20261013`) into the source-data repo:
 * one uncompressed tar per tile-matrix column (JPEGs do not compress), a SHA-256 manifest and a README
 * with the licence line. The integrator commits and pushes the source-data worktree.
 *
 *   tsx scripts/roofs/archive-luchtfoto.mts [--dest=~/Code/map-recall2-worktrees/source-archive/datasets/luchtfoto-20261013]
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_CACHE, LUCHTFOTO_LICENCE, WMTS } from './orthoTiles.ts';

const dest = process.argv.find(a => a.startsWith('--dest='))?.slice(7) ?? path.join(os.homedir(), 'Code/map-recall2-worktrees/source-archive/datasets/luchtfoto-20261013');
const manifest: Array<{ file: string; tiles: number; bytes: number; sha256: string }> = [];
for (const layer of fs.readdirSync(DEFAULT_CACHE).filter(n => !n.startsWith('.'))) for (const level of fs.readdirSync(path.join(DEFAULT_CACHE, layer)).filter(n => /^\d+$/.test(n))) {
  const out = path.join(dest, layer, level);
  fs.mkdirSync(out, { recursive: true });
  for (const col of fs.readdirSync(path.join(DEFAULT_CACHE, layer, level)).filter(n => /^\d+$/.test(n)).sort()) {
    const tar = path.join(out, `${col}.tar`), rel = path.relative(dest, tar);
    const tiles = fs.readdirSync(path.join(DEFAULT_CACHE, layer, level, col)).filter(n => n.endsWith('.jpeg')).length;
    execFileSync('tar', ['-cf', tar, '-C', path.join(DEFAULT_CACHE, layer, level), col]);
    const bytes = fs.readFileSync(tar);
    manifest.push({ file: rel, tiles, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
  }
}
fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify({ fetched: '2026-10-13', source: WMTS, licence: LUCHTFOTO_LICENCE, tiles: manifest.reduce((s, m) => s + m.tiles, 0), files: manifest }, null, 1));
fs.writeFileSync(path.join(dest, 'README.md'), `# PDOK luchtfoto tiles, 2026-10-13

Orthophoto tiles pulled by the roof-extras lane (map-recall2 \`scripts/roofs/\`) to classify roof colours and
roof furniture per BAG pand (roof-facts sidecar).

- Source: ${WMTS} (WMTS, tile matrix set EPSG:28992; \`<layer>/<level>/<col>.tar\` holds \`<col>/<row>.jpeg\`).
- Layers: Actueel_ortho25 at level 14 (0.21 m/px) city-wide over every BAG pand outline; Actueel_orthoHR samples at levels 13-16 for calibration.
- Licence: ${LUCHTFOTO_LICENCE}
- Attribution: "Beeldmateriaal Nederland / PDOK".
- Integrity: \`manifest.json\` lists every tar with its tile count and SHA-256.
`);
console.log(`archived ${manifest.length} tars, ${manifest.reduce((s, m) => s + m.tiles, 0)} tiles -> ${dest}`);
