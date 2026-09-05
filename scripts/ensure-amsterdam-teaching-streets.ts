/**
 * Ensure teaching-critical Amsterdam streets appear in curated streets.json.
 *
 * The builder's wiki/length scoring + former 300-cap dropped canal-belt names
 * (Leidsestraat, Damrak, …) that live in streets-routing. This patches the
 * published quiz extract from routing geometry using amsterdam-curation
 * street scoreBoosts — without a full OSM refresh.
 *
 * Usage: npx tsx scripts/ensure-amsterdam-teaching-streets.ts
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pickNearestDistractors } from '../src/canalRecall/bridgeDistractors.ts';

interface LatLng extends Array<number> {
  0: number;
  1: number;
}

interface StreetFeature {
  id: string;
  name: string;
  type: string;
  cityId: string;
  center: [number, number];
  funFact?: string;
  clues?: string[];
  distractors?: string[];
  difficulty?: string;
  prominenceScore?: number;
  highway?: string;
  path?: LatLng[];
  paths?: LatLng[][];
  wikidata?: string;
  wikipedia?: string;
}

interface RoutingWay {
  id: string;
  name: string;
  type?: string;
  cityId?: string;
  center: [number, number];
  highway?: string;
  path?: LatLng[];
  paths?: LatLng[][];
}

const root = path.resolve(
  process.env.EXTRACT_DIR || 'public/data/extracts/amsterdam',
);
const curationPath = path.resolve('scripts/amsterdam-curation.json');

function stableStringHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash | 0;
}

function pathsOf(way: { path?: LatLng[]; paths?: LatLng[][] }): LatLng[][] {
  if (way.paths && way.paths.length) return way.paths;
  if (way.path && way.path.length) return [way.path];
  return [];
}

function centroid(paths: LatLng[][]): [number, number] {
  let lat = 0;
  let lon = 0;
  let n = 0;
  for (const path of paths) {
    for (const [a, b] of path) {
      lat += a;
      lon += b;
      n += 1;
    }
  }
  if (!n) return [52.37, 4.89];
  return [lat / n, lon / n];
}

const curation = JSON.parse(await readFile(curationPath, 'utf8')) as {
  scoreBoosts: Record<string, number>;
};
const streets = JSON.parse(await readFile(path.join(root, 'streets.json'), 'utf8')) as StreetFeature[];
const routing = JSON.parse(await readFile(path.join(root, 'streets-routing.json'), 'utf8')) as RoutingWay[];

const byName = new Map<string, StreetFeature>();
for (const street of streets) byName.set(street.name, street);

const routingByName = new Map<string, RoutingWay[]>();
for (const way of routing) {
  if (!way.name) continue;
  const list = routingByName.get(way.name) || [];
  list.push(way);
  routingByName.set(way.name, list);
}

const streetBoosts = Object.entries(curation.scoreBoosts)
  .filter(([key]) => key.startsWith('streets:'))
  .map(([key, boost]) => ({
    key,
    boost,
    name: key.slice('streets:'.length)
      .split(' ')
      .map((part) => {
        // Preserve known lowercase particles; title-case the rest from the
        // curation slug. Routing uses canonical OSM spelling (Ä, periods).
        if (part === 'en' || part === 'van' || part === 'de' || part === 'het') return part;
        if (part.includes('.')) {
          return part.split('.').map((p) => (p ? p[0].toUpperCase() + p.slice(1) : '')).join('.');
        }
        return part ? part[0].toUpperCase() + part.slice(1) : part;
      })
      .join(' ')
      // Fix Aäron capitalisation from slug "aäronstraat"
      .replace(/\bAäron/g, 'Aäron')
      .replace(/\bAäronstraat\b/g, 'Aäronstraat'),
  }));

/** OSM display names that differ from the curation slug title-case. */
const NAME_ALIASES: Record<string, string> = {
  'Pieter Cornelisz. Hooftstraat': 'Pieter Cornelisz. Hooftstraat',
  'Mozes En Aäronstraat': 'Mozes en Aäronstraat',
  'De Clercqstraat': 'De Clercqstraat',
};

let added = 0;
let boosted = 0;
const addedNames: string[] = [];

for (const entry of streetBoosts) {
  const displayName = NAME_ALIASES[entry.name] || entry.name;
  // Match routing case-insensitively — OSM spelling wins.
  let routingName = displayName;
  let ways = routingByName.get(displayName);
  if (!ways) {
    const found = [...routingByName.keys()].find(
      (n) => n.toLocaleLowerCase() === displayName.toLocaleLowerCase(),
    );
    if (found) {
      routingName = found;
      ways = routingByName.get(found);
    }
  }
  if (!ways || !ways.length) {
    process.stdout.write(`skip (not in routing): ${displayName}\n`);
    continue;
  }

  const existing = byName.get(routingName)
    || [...byName.values()].find((s) => s.name.toLocaleLowerCase() === routingName.toLocaleLowerCase());
  if (existing) {
    const next = Math.max(existing.prominenceScore || 0, 40 + entry.boost);
    if (next !== existing.prominenceScore) {
      existing.prominenceScore = next;
      existing.difficulty = next >= 140 ? 'easy' : next >= 70 ? 'medium' : 'hard';
      boosted += 1;
    }
    continue;
  }

  const paths = ways.flatMap((way) => pathsOf(way)).filter((p) => p.length >= 2);
  if (!paths.length) {
    process.stdout.write(`skip (no geometry): ${routingName}\n`);
    continue;
  }
  const center = ways[0].center || centroid(paths);
  const score = 40 + entry.boost;
  const feature: StreetFeature = {
    id: `extract_streets_${Math.abs(stableStringHash(`streets:${routingName.toLocaleLowerCase()}`))}`,
    name: routingName,
    type: ['primary', 'secondary', 'tertiary'].includes(ways[0].highway || '') ? 'avenue' : 'street',
    cityId: 'amsterdam',
    center,
    funFact: '',
    clues: [],
    distractors: [],
    difficulty: score >= 140 ? 'easy' : score >= 70 ? 'medium' : 'hard',
    prominenceScore: score,
    highway: ways[0].highway,
    path: paths[0],
    paths: paths.length > 1 ? paths : undefined,
  };
  streets.push(feature);
  byName.set(routingName, feature);
  added += 1;
  addedNames.push(routingName);
}

streets.sort((a, b) => (b.prominenceScore || 0) - (a.prominenceScore || 0));

const distractorPool = streets.map((feature) => ({
  id: feature.id,
  name: feature.name,
  center: feature.center,
}));
for (const feature of streets) {
  feature.distractors = pickNearestDistractors(
    { id: feature.id, name: feature.name, center: feature.center },
    distractorPool,
  );
}

await writeFile(path.join(root, 'streets.json'), JSON.stringify(streets));

const manifestPath = path.join(root, 'manifest.json');
try {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    partitions?: Record<string, { count?: number; bytes?: number }>;
  };
  if (manifest.partitions?.streets) {
    const json = JSON.stringify(streets);
    manifest.partitions.streets.count = streets.length;
    manifest.partitions.streets.bytes = Buffer.byteLength(json);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }
} catch {
  /* manifest optional for this patch */
}

process.stdout.write(
  `Teaching streets: added ${added}, boosted ${boosted}, total ${streets.length}`
  + (addedNames.length ? `\n  + ${addedNames.join(', ')}` : '')
  + '\n',
);
