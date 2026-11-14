// Structure probes for an id list (the twin guard's width and year in stage.ts --probes): what the generic path draws per pand
// (scripts/house-line/structure/probe.ts), cached in <out> so a re-run probes only new ids.
//
//   node --import tsx scripts/house-specs/describer-d1/probe-ids.ts --ids <file> --out <probes.json>
import fs from 'node:fs';
import { probeAll } from '../../house-line/structure/baseline.ts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const idsFile = opt('ids'), out = opt('out');
if (!idsFile || !out) { console.error('probe-ids.ts --ids <file> --out <probes.json>'); process.exit(2); }
const ids = fs.readFileSync(idsFile, 'utf8').split(/\s+/).filter(x => /^\d{16}$/.test(x));
const got = await probeAll(ids, out);
console.log(`probed ${got.size} of ${ids.length} -> ${out}`);
