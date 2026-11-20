/** Per-cluster distributions of the read fronts (src/canalRecall/postwarKit/measured-fronts.json) as markdown tables. */
import { CLUSTER_DISTRIBUTION, MEASURED_FRONTS, type Distribution } from '../../src/canalRecall/postwarKit/facts.ts';
const NAMES = { C1: '1985–2004 mid-rise blocks', C2: '2005+ mid-rise blocks', C4: '1965–1984 blocks', C5: '1985–2004 towers ≥ 24 m' } as const;
const fields: Array<keyof Omit<Distribution, 'n'>> = ['wall', 'balcony', 'ground', 'window', 'frames', 'erker'];
const fmt = (c: Partial<Record<string, number>>, n: number) => Object.entries(c).sort((a, b) => b[1]! - a[1]!).map(([k, v]) => `${k} ${v} (${Math.round(v! / n * 100)} %)`).join(', ');
const lines = ['| Cluster | n | ' + fields.join(' | ') + ' |', '|---|---:|' + fields.map(() => '---').join('|') + '|'];
for (const [c, d] of Object.entries(CLUSTER_DISTRIBUTION)) lines.push(`| ${c} ${NAMES[c as keyof typeof NAMES]} | ${d.n} | ${fields.map(f => fmt(d[f] as Partial<Record<string, number>>, d.n)).join(' | ')} |`);
console.log(lines.join('\n'));
console.log(`\nLow-confidence reads (occluded): ${MEASURED_FRONTS.filter(r => r.confidence === 'low').length} of ${MEASURED_FRONTS.length}.`);
