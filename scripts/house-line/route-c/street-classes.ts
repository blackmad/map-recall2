/**
 * Writes src/canalRecall/houseSpec/street-classes.json: the named streets the street-template ranking treats as MAIN
 * (streetClass.ts). Rule (OSM highway, the routing extract): a street is main when any of its named ways is trunk, primary,
 * secondary or tertiary (or a _link), or a busway (a tram/bus street: Utrechtsestraat, Marnixstraat); when its unclassified ways
 * outnumber its residential and living_street ways (Amsterdam's unclassified through streets: Haarlemmerdijk; Nicolaas
 * Witsenstraat, 1 unclassified to 1 residential, stays side); or when half or more of its ways are pedestrian (Kalverstraat).
 * Every other named street is a side street (residential, living_street: the grachten and the side streets).
 *
 *   node --import tsx scripts/house-line/route-c/street-classes.ts [--write]
 */
import fs from 'node:fs';

const MAIN = new Set(['trunk', 'primary', 'secondary', 'tertiary', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link', 'busway']);
const ways = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as { name: string; highway: string }[];
const by = new Map<string, Map<string, number>>();
for (const w of ways) if (w.name) { const m = by.get(w.name) ?? new Map(); m.set(w.highway, (m.get(w.highway) ?? 0) + 1); by.set(w.name, m); }
const main: string[] = [];
for (const [name, m] of by) {
  const n = [...m.values()].reduce((a, b) => a + b, 0);
  const unclassifiedThrough = (m.get('unclassified') ?? 0) > (m.get('residential') ?? 0) + (m.get('living_street') ?? 0);
  if ([...m.keys()].some(h => MAIN.has(h)) || unclassifiedThrough || (m.get('pedestrian') ?? 0) * 2 >= n) main.push(name);
}
main.sort();
const out = { v: 1, generated: 'scripts/house-line/route-c/street-classes.ts', source: 'public/data/extracts/amsterdam/streets-routing.json (OSM highway)', named: by.size, main };
console.log(JSON.stringify({ named: by.size, main: main.length }));
if (process.argv.includes('--write')) fs.writeFileSync('src/canalRecall/houseSpec/street-classes.json', JSON.stringify(out) + '\n');
