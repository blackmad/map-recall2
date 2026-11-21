/**
 * Round 2c colour blind (lane postwar-kit-r2-20261121), fixed before frames: corrected walls this round changes on unread
 * pands, all new grey-brick acceptances and the median-over-captures warm changes by sha1('postwar-r2c:' + id), 12 in all.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { measuredFront } from '../../src/canalRecall/postwarKit/facts.ts';
const OUT = path.resolve(import.meta.dirname, '../../artifacts/postwar-kit'), ROOT = path.resolve(OUT, '../..');
const old = JSON.parse(execFileSync('/usr/bin/git', ['show', 'HEAD:src/canalRecall/postwarKit/corrected-walls.json'], { cwd: ROOT, encoding: 'utf8' })).walls as Record<string, string>;
const now = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/canalRecall/postwarKit/corrected-walls.json'), 'utf8')).walls as Record<string, string>;
const h = (id: string) => createHash('sha1').update(`postwar-r2c:${id}`).digest('hex');
const grey = Object.keys(now).filter(id => !old[id] && !measuredFront(id));
const warm = Object.keys(now).filter(id => old[id] && old[id] !== now[id] && !measuredFront(id)).sort((a, b) => h(a).localeCompare(h(b))).slice(0, 12 - grey.length);
const ids = [...grey.map(id => ({ item: 'grey', id })), ...warm.map(id => ({ item: 'warm-median', id }))];
fs.writeFileSync(path.join(OUT, 'blind-r2c-ids.json'), JSON.stringify(ids, null, 1));
fs.writeFileSync(path.join(OUT, 'blind-r2c-list.json'), JSON.stringify(ids.map(({ id }) => ({ pandId: id, key: id })), null, 1));
console.log(grey.length, warm.length);
