/**
 * Round 2b blind set (lane postwar-kit-r2-20261121), fixed before frames: the face rule (feature reads draw on the side
 * they were read on). Six own-read balcony pands not in blind-r2, by sha1('postwar-r2b:' + id), plus the named loss
 * Entrepotdok 146-163. Writes artifacts/postwar-kit/blind-r2b-ids.json and -list.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { postwarKitFor } from '../../src/canalRecall/postwarKit/kit.ts';
import { measuredFront } from '../../src/canalRecall/postwarKit/facts.ts';
const OUT = path.resolve(import.meta.dirname, '../../artifacts/postwar-kit'), ROOT = path.resolve(OUT, '../..');
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const FEAT = read(path.join(ROOT, 'src/canalRecall/postwarKit/feature-reads.json')).features as Record<string, any>;
const sample = read(path.join(OUT, 'sample-all.json')) as Record<string, any>;
const earlier = new Set((read(path.join(ROOT, 'scripts/postwar-kit/blind-r2-ids.json')) as any[]).map(r => r.id));
const h = (id: string) => createHash('sha1').update(`postwar-r2b:${id}`).digest('hex');
const pool = Object.keys(FEAT).filter(id => FEAT[id].balcony && !measuredFront(id) && !earlier.has(id) && postwarKitFor({ id, year: sample[id].year, heightM: sample[id].heightM, use: 'housing' })?.balcony !== 'none');
const ids = [...pool.sort((a, b) => h(a).localeCompare(h(b))).slice(0, 6), '0363100012180528'];
fs.writeFileSync(path.join(OUT, 'blind-r2b-ids.json'), JSON.stringify(ids.map(id => ({ item: 'balcony-face', id })), null, 1));
fs.writeFileSync(path.join(OUT, 'blind-r2b-list.json'), JSON.stringify(ids.map(id => ({ pandId: id, key: id })), null, 1));
console.log(pool.length, ids.map(id => sample[id].address));
