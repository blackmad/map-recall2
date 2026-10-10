// node --import tsx scripts/landmarks/big-tops.ts <id> <wallIdx> [step=1] : wall top height along the tangent
import fs from 'node:fs';
import {rawWall, topOf} from './big-kit';
const [id, idx, step = '1'] = process.argv.slice(2);
const src = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
const w = rawWall(src, +idx);
console.log('attrs', JSON.stringify(src.attributes), 'groundNAP', src.groundNAP);
const out: string[] = [];
for (let t = 0; t <= w.len + 1e-6; t += +step) out.push(`${t.toFixed(1)}:${topOf(w, Math.min(t, w.len - 1e-3)).toFixed(2)}`);
console.log(out.join(' '));
