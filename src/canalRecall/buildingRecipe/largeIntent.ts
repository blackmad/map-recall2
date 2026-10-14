/**
 * Validator for `kind: "large"` intents (schema in intent.ts, `LargeBuildingIntent`). Same contract as the canal-house
 * validator: names, counts and component switches only; no coordinate or metric field anywhere. Wall surfaces are
 * checked against the facts when the fit runs (`fitLarge`), not here.
 */
import {GROUP_WALL_MATERIALS, ROOF_MATERIALS, SOURCE_KINDS, SWATCHES, WALL_MATERIALS, validateIntent, type BuildingIntent, type LargeBuildingIntent} from './intent.ts';
import {LARGE_GROUNDS, LARGE_SYSTEMS, LARGE_WINDOWS} from '../blockBuilding/systems.ts';
import {ARCH_KINDS} from '../blockBuilding/arch.ts';

const COORDINATE_KEYS = /^(x|y|z|left|right|top|bottom|width|height|depth|offset|position|coordinates|ring|vertices|plane)(M)?$|M$/;
const WALL_KEYS = ['wallSurfaces', 'street', 'system', 'storeys', 'alignWith', 'baysPerStorey', 'ground', 'windows', 'entrance', 'signage', 'garageDoors', 'garageBays', 'stringCourses', 'cornice', 'piers', 'balconies', 'blankStoreys', 'police', 'palette', 'arches', 'hoist', 'sills', 'frames', 'deepBars', 'nameBoards', 'crosses', 'curve', 'wallMaterial', 'tiltedBays', 'screen', 'stoneStoreys', 'pilasters', 'lantern', 'gateways'];
const HOUSE_KEYS = ['schemaVersion', 'kind', 'id', 'pandId', 'address', 'sources', 'walls', 'otherWalls', 'roofPlant', 'roof', 'palette', 'closedBands', 'layeredKit', 'shellRepair', 'footprint', 'notes'];
const SIGN_TEXT = /^[A-Za-z0-9&'. -]{1,60}$/;

export function validateLargeIntent(input: unknown): LargeBuildingIntent {
  const problems: string[] = [];
  const intent = input as LargeBuildingIntent;
  const oneOf = (value: unknown, allowed: readonly string[], where: string) => {
    if (!allowed.includes(value as string)) problems.push(`${where}: ${JSON.stringify(value)} not in ${allowed.join('|')}`);
  };
  const count = (value: unknown, where: string, min = 0, max = 60) => {
    if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) problems.push(`${where}: expected integer ${min}..${max}`);
  };
  const colour = (value: unknown, where: string) => {
    if (typeof value !== 'string' || !(value in SWATCHES || /^#[0-9a-f]{6}$/i.test(value))) problems.push(`${where}: unknown colour ${JSON.stringify(value)}`);
  };
  const bool = (value: unknown, where: string) => { if (value !== undefined && typeof value !== 'boolean') problems.push(`${where} must be true or false`); };
  const scan = (value: unknown, path: string) => {
    if (Array.isArray(value)) value.forEach((v, i) => scan(v, `${path}[${i}]`));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) {
      if (COORDINATE_KEYS.test(k)) problems.push(`${path}.${k}: coordinate/metric field not allowed in an intent recipe`);
      scan(v, `${path}.${k}`);
    }
  };
  scan(input, 'intent');
  if (intent?.kind !== 'large') problems.push('kind must be "large"');
  if (!intent || intent.schemaVersion !== 1) problems.push('schemaVersion must be 1');
  for (const k of Object.keys(intent ?? {})) if (!HOUSE_KEYS.includes(k)) problems.push(`${k}: unknown field (one of ${HOUSE_KEYS.join(', ')})`);
  if (!/^[a-z0-9-]+$/.test(intent?.id ?? '')) problems.push('id must be a lowercase slug');
  if (!/^\d{16}$/.test(intent?.pandId ?? '')) problems.push('pandId must be 16 digits');
  if (!Array.isArray(intent?.sources) || !intent.sources.length) problems.push('at least one source is required');
  else for (const s of intent.sources) {
    oneOf(s.kind, SOURCE_KINDS, `source ${s.id}.kind`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.capturedAt ?? '')) problems.push(`source ${s.id}.capturedAt must be YYYY-MM-DD`);
  }
  if (intent?.otherWalls !== undefined) oneOf(intent.otherWalls, LARGE_SYSTEMS, 'otherWalls');
  bool(intent?.roofPlant, 'roofPlant'); bool(intent?.closedBands, 'closedBands'); bool(intent?.layeredKit, 'layeredKit'); bool(intent?.shellRepair, 'shellRepair');
  if (intent?.footprint !== undefined) oneOf(intent.footprint, ['lod22', 'bag'], 'footprint');
  if (intent?.roof !== undefined) oneOf(intent.roof?.material, ROOF_MATERIALS, 'roof.material');
  for (const k of ['brick', 'frame', 'door'] as const) colour(intent?.palette?.[k], `palette.${k}`);
  for (const k of ['shutters', 'stone', 'band', 'cornice'] as const) if (intent?.palette?.[k] !== undefined) colour(intent.palette[k], `palette.${k}`);
  if (intent?.palette?.wallMaterial !== undefined) oneOf(intent.palette.wallMaterial, WALL_MATERIALS, 'palette.wallMaterial');
  const seen = new Map<number, number>();
  if (!Array.isArray(intent?.walls) || !intent.walls.length) problems.push('at least one wall group is required');
  else intent.walls.forEach((w, i) => {
    const at = `walls[${i}]`;
    for (const k of Object.keys(w)) if (!WALL_KEYS.includes(k)) problems.push(`${at}.${k}: unknown field (one of ${WALL_KEYS.join(', ')})`);
    if (!Array.isArray(w.wallSurfaces) || !w.wallSurfaces.length) problems.push(`${at}.wallSurfaces: list the 3DBAG wall surface indices (scripts/building-recipes/walls.ts)`);
    else for (const s of w.wallSurfaces) {
      count(s, `${at}.wallSurfaces`, 0, 100000);
      if (seen.has(s)) problems.push(`${at}.wallSurfaces: surface ${s} is already in walls[${seen.get(s)}]`); else seen.set(s, i);
    }
    oneOf(w.system, LARGE_SYSTEMS, `${at}.system`);
    if (w.storeys !== undefined) count(w.storeys, `${at}.storeys`, 1, 40);
    if (w.alignWith !== undefined) {
      count(w.alignWith, `${at}.alignWith`, 0, Math.max(0, i - 1));
      if (w.storeys !== undefined) problems.push(`${at}: alignWith and storeys are alternatives`);
      if (i === 0 || intent.walls[w.alignWith]?.alignWith !== undefined) problems.push(`${at}.alignWith: name an earlier group that has its own storeys`);
    }
    if (w.baysPerStorey !== undefined) count(w.baysPerStorey, `${at}.baysPerStorey`, 1, 80);
    if (w.ground !== undefined) oneOf(w.ground, LARGE_GROUNDS, `${at}.ground`);
    if (w.windows !== undefined) oneOf(w.windows, LARGE_WINDOWS, `${at}.windows`);
    if (w.entrance !== undefined && typeof w.entrance !== 'boolean') {
      const e = w.entrance;
      for (const k of Object.keys(e)) if (!['bay', 'storeys', 'canopy', 'portal'].includes(k)) problems.push(`${at}.entrance.${k}: unknown field (bay, storeys, canopy, portal)`);
      bool(e.portal, `${at}.entrance.portal`);
      if (e.portal && ((e.storeys ?? 1) > 1 || e.canopy)) problems.push(`${at}.entrance.portal: a portal frames a single-storey entrance without a canopy`);
      if (e.bay !== undefined) count(e.bay, `${at}.entrance.bay`, 0, 79);
      if (e.storeys !== undefined) count(e.storeys, `${at}.entrance.storeys`, 1, 4);
      bool(e.canopy, `${at}.entrance.canopy`);
      if (w.baysPerStorey !== undefined && e.bay !== undefined && e.bay >= w.baysPerStorey) problems.push(`${at}.entrance.bay: ${e.bay} but only ${w.baysPerStorey} bays`);
    }
    if (w.signage !== undefined) {
      const sign = typeof w.signage === 'string' ? {text: w.signage} : w.signage;
      if (typeof sign?.text !== 'string' || !SIGN_TEXT.test(sign.text)) problems.push(`${at}.signage.text: 1..60 of A-Z a-z 0-9 & ' - . space`);
      if (typeof w.signage === 'object') {
        for (const k of Object.keys(w.signage)) if (!['text', 'colour', 'mount'].includes(k)) problems.push(`${at}.signage.${k}: unknown field (text, colour, mount)`);
        if (w.signage.colour !== undefined) colour(w.signage.colour, `${at}.signage.colour`);
        if (w.signage.mount !== undefined) oneOf(w.signage.mount, ['fascia', 'wall', 'glazing', 'canopy', 'cornice'], `${at}.signage.mount`);
        if (w.signage.mount === 'canopy' && !(typeof w.entrance === 'object' && w.entrance.canopy)) problems.push(`${at}.signage.mount: canopy needs entrance.canopy`);
        if (w.signage.mount === 'glazing' && !(typeof w.entrance === 'object' && (w.entrance.storeys ?? 1) > 1)) problems.push(`${at}.signage.mount: glazing needs an entrance hall (entrance.storeys >= 2)`);
      }
    }
    if (w.crosses !== undefined) {
      for (const k of Object.keys(w.crosses)) if (!['count', 'size', 'colour', 'side'].includes(k)) problems.push(`${at}.crosses.${k}: unknown field (count, size, colour, side)`);
      count(w.crosses.count, `${at}.crosses.count`, 1, 6);
      if (w.crosses.size !== undefined) oneOf(w.crosses.size, ['small', 'medium', 'large'], `${at}.crosses.size`);
      if (w.crosses.colour !== undefined) colour(w.crosses.colour, `${at}.crosses.colour`);
      if (w.crosses.side !== undefined) oneOf(w.crosses.side, ['left', 'right'], `${at}.crosses.side`);
    }
    if (w.garageDoors !== undefined) count(w.garageDoors, `${at}.garageDoors`, 1, 8);
    if (w.garageBays !== undefined) {
      if (!Array.isArray(w.garageBays) || !w.garageBays.length) problems.push(`${at}.garageBays: list of bay indices`);
      else w.garageBays.forEach(b => count(b, `${at}.garageBays`, 0, (w.baysPerStorey ?? 80) - 1));
      if (w.baysPerStorey === undefined) problems.push(`${at}.garageBays needs baysPerStorey`);
      if (w.garageDoors !== undefined) problems.push(`${at}: garageDoors and garageBays are alternatives`);
    }
    for (const k of ['stringCourses', 'cornice', 'piers'] as const) bool(w[k], `${at}.${k}`);
    if (w.balconies !== undefined) {
      if (!Array.isArray(w.balconies.storeys) || !w.balconies.storeys.length) problems.push(`${at}.balconies.storeys: list of storeys (1 = first floor)`);
      else w.balconies.storeys.forEach(s => count(s, `${at}.balconies.storeys`, 1, 39));
      if (w.balconies.bays !== undefined) { if (!Array.isArray(w.balconies.bays) || !w.balconies.bays.length) problems.push(`${at}.balconies.bays: list of bay indices`); else w.balconies.bays.forEach(b => count(b, `${at}.balconies.bays`, 0, (w.baysPerStorey ?? 80) - 1)); if (w.baysPerStorey === undefined) problems.push(`${at}.balconies.bays needs baysPerStorey`); }
      if (w.balconies.rail !== undefined) oneOf(w.balconies.rail, ['glass', 'bars', 'solid'], `${at}.balconies.rail`);
      const bk = Object.keys(w.balconies);
      for (const k of bk) if (!['storeys', 'rail', 'every', 'first', 'bays'].includes(k)) problems.push(`${at}.balconies.${k}: unknown field (storeys, rail, every, first, bays)`);
      if (w.balconies.every !== undefined && w.balconies.bays !== undefined) problems.push(`${at}.balconies: give every (with first) or bays, not both`);
      if (w.balconies.first !== undefined && w.balconies.every === undefined) problems.push(`${at}.balconies.first needs every`);
      if (w.balconies.every !== undefined) count(w.balconies.every, `${at}.balconies.every`, 2, 12);
      if (w.balconies.first !== undefined) count(w.balconies.first, `${at}.balconies.first`, 0, Math.max(0, (w.balconies.every ?? 1) - 1));
      if (w.balconies.bays !== undefined) {
        if (!Array.isArray(w.balconies.bays) || !w.balconies.bays.length) problems.push(`${at}.balconies.bays: list of bay indices`);
        else w.balconies.bays.forEach(b => count(b, `${at}.balconies.bays`, 0, (w.baysPerStorey ?? 80) - 1));
        if (w.baysPerStorey === undefined) problems.push(`${at}.balconies.bays needs baysPerStorey`);
      }
      if ((w.balconies.every !== undefined || w.balconies.bays !== undefined) && w.hoist) problems.push(`${at}.balconies: bay selection is not combined with hoist (both cycle the bays)`);
    }
    if (w.blankStoreys !== undefined) { if (!Array.isArray(w.blankStoreys) || !w.blankStoreys.length) problems.push(`${at}.blankStoreys: list of storeys (0 = ground)`); else w.blankStoreys.forEach(s => count(s, `${at}.blankStoreys`, 0, 39)); }
    if (w.police !== undefined) { bool(w.police.stripe, `${at}.police.stripe`); bool(w.police.lamp, `${at}.police.lamp`); if (w.police.lamp && !w.entrance) problems.push(`${at}.police.lamp: the lamp hangs beside an entrance; add entrance`); }
    if (w.arches !== undefined) {
      for (const k of Object.keys(w.arches)) if (!['windows', 'ground', 'band', 'storeys'].includes(k)) problems.push(`${at}.arches.${k}: unknown field (windows, ground, band, storeys)`);
      if (w.arches.storeys !== undefined) { if (!Array.isArray(w.arches.storeys) || !w.arches.storeys.length) problems.push(`${at}.arches.storeys: list of storeys (0 = ground)`); else w.arches.storeys.forEach(s => count(s, `${at}.arches.storeys`, 0, 39)); }
      if (w.arches.windows !== undefined) oneOf(w.arches.windows, ARCH_KINDS, `${at}.arches.windows`);
      if (w.arches.ground !== undefined) oneOf(w.arches.ground, ARCH_KINDS, `${at}.arches.ground`);
      if (w.arches.band !== undefined) oneOf(w.arches.band, ['brick', 'stone', 'voussoir', 'none'], `${at}.arches.band`);
      if (w.arches.windows !== undefined && w.system !== 'brick-bay-grid') problems.push(`${at}.arches.windows: arched windows need system brick-bay-grid`);
    }
    if (w.gateways !== undefined) {
      for (const k of Object.keys(w.gateways)) if (!['bays', 'arch'].includes(k)) problems.push(`${at}.gateways.${k}: unknown field (bays, arch)`);
      if (!Array.isArray(w.gateways.bays) || !w.gateways.bays.length) problems.push(`${at}.gateways.bays: list of bay indices`);
      else w.gateways.bays.forEach(b => count(b, `${at}.gateways.bays`, 0, (w.baysPerStorey ?? 80) - 1));
      if (w.baysPerStorey === undefined) problems.push(`${at}.gateways.bays needs baysPerStorey`);
      if (w.gateways.arch !== undefined) oneOf(w.gateways.arch, ARCH_KINDS, `${at}.gateways.arch`);
      if (w.system !== 'brick-bay-grid') problems.push(`${at}.gateways: needs system brick-bay-grid`);
      if (w.hoist || w.entrance) problems.push(`${at}.gateways: not with hoist or entrance (both claim the ground storey)`);
    }
    if (w.hoist !== undefined) {
      for (const k of Object.keys(w.hoist)) if (!['every', 'first', 'bays', 'arch'].includes(k)) problems.push(`${at}.hoist.${k}: unknown field (every, first, bays, arch)`);
      if ((w.hoist.every === undefined) === (w.hoist.bays === undefined)) problems.push(`${at}.hoist: give every (with first) or bays`);
      if (w.hoist.every !== undefined) count(w.hoist.every, `${at}.hoist.every`, 2, 12);
      if (w.hoist.first !== undefined) count(w.hoist.first, `${at}.hoist.first`, 0, Math.max(0, (w.hoist.every ?? 1) - 1));
      if (w.hoist.bays !== undefined) {
        if (!Array.isArray(w.hoist.bays) || !w.hoist.bays.length) problems.push(`${at}.hoist.bays: list of bay indices`);
        else w.hoist.bays.forEach(b => count(b, `${at}.hoist.bays`, 0, (w.baysPerStorey ?? 80) - 1));
        if (w.baysPerStorey === undefined) problems.push(`${at}.hoist.bays needs baysPerStorey`);
      }
      if (w.hoist.arch !== undefined) oneOf(w.hoist.arch, ARCH_KINDS, `${at}.hoist.arch`);
    }
    bool(w.sills, `${at}.sills`); bool(w.frames, `${at}.frames`); bool(w.deepBars, `${at}.deepBars`); bool(w.curve, `${at}.curve`);
    if (w.wallMaterial !== undefined) oneOf(w.wallMaterial, GROUP_WALL_MATERIALS, `${at}.wallMaterial`);
    bool(w.screen, `${at}.screen`); bool(w.pilasters, `${at}.pilasters`); bool(w.lantern, `${at}.lantern`);
    if (w.stoneStoreys !== undefined) { if (!Array.isArray(w.stoneStoreys) || !w.stoneStoreys.length) problems.push(`${at}.stoneStoreys: list of storeys (0 = ground)`); else w.stoneStoreys.forEach(s => count(s, `${at}.stoneStoreys`, 0, 39)); if (w.stringCourses) problems.push(`${at}.stoneStoreys: not with stringCourses (the course would sit 5 mm off the facing)`); }
    if (w.screen && w.system !== 'brick-bay-grid') problems.push(`${at}.screen: the screen lattice follows a brick-bay-grid`);
    if (w.screen && (w.hoist || w.tiltedBays)) problems.push(`${at}.screen: not with hoist or tiltedBays`);
    if (intent.layeredKit !== false && w.system === 'curtain-wall' && (w.ground === 'blank' || w.blankStoreys?.length)) problems.push(`${at}: a layered curtain wall is a glass skin, so it has no blank ground or blank storeys (use ground "mesh-plinth", or another group)`);
    if (w.ground === 'mesh-plinth' && (intent.layeredKit === false || w.system !== 'curtain-wall')) problems.push(`${at}.ground: "mesh-plinth" is the plinth panel of a layered curtain wall`);
    const tiltSeen = new Set<number>();
    for (const [ti, t] of (w.tiltedBays === undefined ? [] : Array.isArray(w.tiltedBays) ? w.tiltedBays : [w.tiltedBays]).entries()) {
      if (Array.isArray(w.tiltedBays)) { if (t.storeys === undefined) problems.push(`${at}.tiltedBays[${ti}]: a list entry names its storeys`); else for (const st of t.storeys) { if (tiltSeen.has(st)) problems.push(`${at}.tiltedBays: storey ${st} in two entries`); tiltSeen.add(st); } }
      for (const k of Object.keys(t)) if (!['every', 'first', 'bays', 'storeys'].includes(k)) problems.push(`${at}.tiltedBays.${k}: unknown field (every, first, bays, storeys)`);
      if ((t.every === undefined) === (t.bays === undefined)) problems.push(`${at}.tiltedBays: give every (with first) or bays`);
      if (t.every !== undefined) count(t.every, `${at}.tiltedBays.every`, 1, 12);
      if (t.first !== undefined) count(t.first, `${at}.tiltedBays.first`, 0, Math.max(0, (t.every ?? 1) - 1));
      if (t.bays !== undefined) { if (!Array.isArray(t.bays) || !t.bays.length) problems.push(`${at}.tiltedBays.bays: list of bay indices`); else t.bays.forEach(b => count(b, `${at}.tiltedBays.bays`, 0, (w.baysPerStorey ?? 80) - 1)); if (w.baysPerStorey === undefined) problems.push(`${at}.tiltedBays.bays needs baysPerStorey`); }
      if (t.storeys !== undefined) { if (!Array.isArray(t.storeys) || !t.storeys.length) problems.push(`${at}.tiltedBays.storeys: list of storeys (0 = ground)`); else t.storeys.forEach(s => count(s, `${at}.tiltedBays.storeys`, 0, 39)); }
      if (w.hoist) problems.push(`${at}.tiltedBays: not with hoist (both are per-bay cycles)`);
      if (w.system === 'blank') problems.push(`${at}.tiltedBays: a blank wall has no windows`);
    }
    if (w.nameBoards !== undefined) {
      if (!Array.isArray(w.nameBoards) || !w.nameBoards.length) problems.push(`${at}.nameBoards: list of names (one per hoist bay, "" to skip)`);
      else w.nameBoards.forEach((n, k) => { if (typeof n !== 'string' || (n !== '' && !SIGN_TEXT.test(n)) || n.length > 24) problems.push(`${at}.nameBoards[${k}]: up to 24 of A-Z a-z 0-9 & ' - . space`); });
      if (!w.hoist) problems.push(`${at}.nameBoards: boards hang over the hoist-bay portals; add hoist`);
    }
    for (const [k, v] of Object.entries(w.palette ?? {})) { if (!['brick', 'frame', 'stone'].includes(k)) problems.push(`${at}.palette.${k}: only brick, frame, stone per group`); else colour(v, `${at}.palette.${k}`); }
  });
  if (problems.length) throw new Error(`Invalid large intent ${intent?.id ?? '?'}:\n - ${problems.join('\n - ')}`);
  return intent;
}

/** Either kind: canal houses go through `validateIntent`, large buildings through `validateLargeIntent`. */
export function validateBuildingIntent(input: unknown): BuildingIntent {
  return (input as {kind?: string})?.kind === 'large' ? validateLargeIntent(input) : validateIntent(input);
}
