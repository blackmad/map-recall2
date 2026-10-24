/**
 * Validator for `kind: "large"` intents (schema in intent.ts, `LargeBuildingIntent`). Same contract as the canal-house
 * validator: names, counts and component switches only; no coordinate or metric field anywhere. Wall surfaces are
 * checked against the facts when the fit runs (`fitLarge`), not here.
 */
import {GROUP_WALL_MATERIALS, LARGE_HOUSE_CROWNS, ROOF_MATERIALS, SOURCE_KINDS, SWATCHES, WALL_MATERIALS, validateIntent, type BuildingIntent, type LargeBuildingIntent} from './intent.ts';
import {LARGE_GROUNDS, LARGE_SYSTEMS, LARGE_WINDOWS} from '../blockBuilding/systems.ts';
import {ARCH_KINDS} from '../blockBuilding/arch.ts';

const COORDINATE_KEYS = /^(x|y|z|left|right|top|bottom|width|height|depth|offset|position|coordinates|ring|vertices|plane)(M)?$|M$/;
const WALL_KEYS = ['wallSurfaces', 'street', 'system', 'storeys', 'alignWith', 'baysPerStorey', 'ground', 'windows', 'entrance', 'signage', 'garageDoors', 'garageBays', 'stringCourses', 'cornice', 'piers', 'balconies', 'blankStoreys', 'glazedStoreys', 'police', 'palette', 'arches', 'hoist', 'sills', 'frames', 'deepBars', 'nameBoards', 'crosses', 'curve', 'wallMaterial', 'tiltedBays', 'screen', 'stoneStoreys', 'pilasters', 'lantern', 'gateways', 'hallDoors', 'windowShape', 'windowPattern', 'hand', 'hall', 'columns', 'wallSplit', 'arcade', 'glazing', 'courses', 'souterrain', 'spandrels', 'groundFactor', 'shell', 'openBays', 'meshScreen', 'loggias', 'plinth', 'houses'];
const HOUSE_KEYS = ['schemaVersion', 'kind', 'id', 'pandId', 'address', 'sources', 'walls', 'otherWalls', 'roofPlant', 'roof', 'palette', 'closedBands', 'layeredKit', 'shellRepair', 'footprint', 'groundClamp', 'budgetTriangles', 'measured', 'draftedBy', 'notes'];
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
    if (s.sha256 !== undefined && !/^[0-9a-f]{64}$/.test(s.sha256)) problems.push(`source ${s.id}.sha256 must be 64 hex digits`);
    if (s.image?.startsWith('source-data://') && !s.sha256) problems.push(`source ${s.id}: a source-data:// image needs its sha256`);
  }
  if (intent?.measured !== undefined) {
    const m = intent.measured;
    if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(m.date ?? '')) problems.push('measured.date must be YYYY-MM-DD');
    if (!Array.isArray(m?.groups)) problems.push('measured.groups: list of wall-group indices');
    else m.groups.forEach(g => count(g, 'measured.groups', 0, Math.max(0, (intent.walls?.length ?? 1) - 1)));
    bool(m?.otherWalls, 'measured.otherWalls');
    for (const k of Object.keys(m ?? {})) if (!['date', 'groups', 'otherWalls'].includes(k)) problems.push(`measured.${k}: unknown field (date, groups, otherWalls)`);
  }
  if (intent?.draftedBy !== undefined) oneOf(intent.draftedBy, ['factory'], 'draftedBy');
  if (intent?.otherWalls !== undefined) oneOf(intent.otherWalls, LARGE_SYSTEMS, 'otherWalls');
  bool(intent?.roofPlant, 'roofPlant'); bool(intent?.closedBands, 'closedBands'); bool(intent?.layeredKit, 'layeredKit'); bool(intent?.shellRepair, 'shellRepair');
  if (intent?.footprint !== undefined) oneOf(intent.footprint, ['lod22', 'bag'], 'footprint');
  if (intent?.groundClamp !== undefined && typeof intent.groundClamp !== 'boolean') problems.push('groundClamp: boolean');
  // A raised per-house triangle budget (see LargeBuildingIntent.budgetTriangles): it only ever raises the 12k default.
  if (intent?.budgetTriangles !== undefined) {
    const b = intent.budgetTriangles;
    if (!Number.isInteger(b) || b < 12000 || b > 40000) problems.push(`budgetTriangles: expected an integer 12000..40000 (the large-tier default and the approved cap), got ${JSON.stringify(b)}`);
  }
  if (intent?.roof !== undefined) {
    const r = intent.roof;
    oneOf(r?.material, ROOF_MATERIALS, 'roof.material');
    for (const k of Object.keys(r ?? {})) if (!['material', 'flat', 'surfaces', 'flatHex', 'levelRooftop'].includes(k)) problems.push(`roof.${k}: unknown field (material, flat, surfaces, flatHex, levelRooftop)`);
    if (r?.levelRooftop !== undefined) {
      for (const k of Object.keys(r.levelRooftop ?? {})) if (k !== 'evidence') problems.push(`roof.levelRooftop.${k}: unknown field (evidence)`);
      if (typeof r.levelRooftop?.evidence !== 'string' || !r.levelRooftop.evidence.trim()) problems.push('roof.levelRooftop.evidence: say what shows the rooftop is not the 3DBAG plane field (photo ids, user note)');
    }
    if (r?.flat !== undefined) oneOf(r.flat, ROOF_MATERIALS, 'roof.flat');
    if (r?.flatHex !== undefined && !/^#[0-9a-f]{6}$/i.test(r.flatHex)) problems.push(`roof.flatHex: a measured #rrggbb (roof-flat.ts), got ${JSON.stringify(r.flatHex)}`);
    if (r?.surfaces !== undefined && !Array.isArray(r.surfaces)) problems.push('roof.surfaces: list of {roofSurfaces, material, evidence}');
    else if (r?.surfaces) {
      const listed = new Set<number>();
      r.surfaces.forEach((g, i) => {
        const at = `roof.surfaces[${i}]`;
        for (const k of Object.keys(g ?? {})) if (!['roofSurfaces', 'material', 'evidence'].includes(k)) problems.push(`${at}.${k}: unknown field (roofSurfaces, material, evidence)`);
        oneOf(g?.material, ROOF_MATERIALS, `${at}.material`);
        if (typeof g?.evidence !== 'string' || !g.evidence.trim()) problems.push(`${at}.evidence: say what shows this material (orthophoto, photo id)`);
        if (!Array.isArray(g?.roofSurfaces) || !g.roofSurfaces.length) problems.push(`${at}.roofSurfaces: list the 3DBAG roof surface numbers`);
        else for (const s of g.roofSurfaces) { count(s, `${at}.roofSurfaces`, 0, 100000); if (listed.has(s)) problems.push(`${at}.roofSurfaces: ${s} listed twice`); listed.add(s); }
      });
    }
  }
  for (const k of ['brick', 'frame', 'door'] as const) colour(intent?.palette?.[k], `palette.${k}`);
  for (const k of ['shutters', 'stone', 'band', 'cornice', 'glass'] as const) if (intent?.palette?.[k] !== undefined) colour(intent.palette[k], `palette.${k}`);
  if (intent?.palette?.wallMaterial !== undefined) oneOf(intent.palette.wallMaterial, WALL_MATERIALS.filter(m => m !== 'painted-brick'), 'palette.wallMaterial');
  const seen = new Map<number | string, number>();
  if (!Array.isArray(intent?.walls) || !intent.walls.length) problems.push('at least one wall group is required');
  else intent.walls.forEach((w, i) => {
    const at = `walls[${i}]`;
    for (const k of Object.keys(w)) if (!WALL_KEYS.includes(k)) problems.push(`${at}.${k}: unknown field (one of ${WALL_KEYS.join(', ')})`);
    if (!Array.isArray(w.wallSurfaces) || !w.wallSurfaces.length) problems.push(`${at}.wallSurfaces: list the 3DBAG wall surface indices (scripts/building-recipes/walls.ts)`);
    else for (const s of w.wallSurfaces) {
      count(s, `${at}.wallSurfaces`, 0, 100000);
      // with `shell`, a surface index is unique within its shell (multi-shell pands number each shell from 1)
      const sk = w.shell === undefined ? s : `${w.shell}:${s}`;
      const clash = seen.has(sk) || (w.shell !== undefined ? seen.has(s) : [...seen.keys()].some(k => typeof k === 'string' && k.endsWith(`:${s}`)));
      if (clash) problems.push(`${at}.wallSurfaces: surface ${s} is already in walls[${seen.get(sk) ?? seen.get(s)}]`); else seen.set(sk, i);
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
    if (w.arcade !== undefined) {
      if (w.ground !== 'arcade') problems.push(`${at}.arcade needs ground "arcade"`);
      if (!w.arcade || typeof w.arcade !== 'object') problems.push(`${at}.arcade: object`);
      else {
        for (const k of Object.keys(w.arcade)) if (!['pier', 'walk', 'head', 'rise', 'chamfer', 'storeyFactor', 'facing'].includes(k)) problems.push(`${at}.arcade.${k}: unknown field (pier, walk, head, rise, chamfer, storeyFactor, facing)`);
        const range = (v: unknown, lo: number, hi: number, k: string) => { if (v !== undefined && !(typeof v === 'number' && v >= lo && v <= hi)) problems.push(`${at}.arcade.${k}: number ${lo}..${hi}`); };
        range(w.arcade.pier, 0.05, 0.5, 'pier'); range(w.arcade.walk, 0.05, 1.2, 'walk'); range(w.arcade.head, 0.4, 0.95, 'head');
        range(w.arcade.rise, 0, 0.5, 'rise'); range(w.arcade.chamfer, 0, 0.45, 'chamfer'); range(w.arcade.storeyFactor, 1, 2.5, 'storeyFactor');
        bool(w.arcade.facing, `${at}.arcade.facing`);
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
    if (w.glazedStoreys !== undefined) {
      if (!Array.isArray(w.glazedStoreys) || !w.glazedStoreys.length) problems.push(`${at}.glazedStoreys: list of upper storeys (1 = first floor)`);
      else w.glazedStoreys.forEach(s => count(s, `${at}.glazedStoreys`, 1, 39));
      if (w.blankStoreys?.some(s => w.glazedStoreys!.includes(s))) problems.push(`${at}.glazedStoreys: a storey is not both blank and glazed`);
      if (!['brick-bay-grid', 'ribbon-windows', 'plinth-shopfronts'].includes(w.system)) problems.push(`${at}.glazedStoreys: needs brick-bay-grid, ribbon-windows or plinth-shopfronts`);
    }
    if (w.police !== undefined) { bool(w.police.stripe, `${at}.police.stripe`); bool(w.police.lamp, `${at}.police.lamp`); if (w.police.lamp && !w.entrance) problems.push(`${at}.police.lamp: the lamp hangs beside an entrance; add entrance`); }
    if (w.arches !== undefined) {
      for (const k of Object.keys(w.arches)) if (!['windows', 'ground', 'band', 'storeys'].includes(k)) problems.push(`${at}.arches.${k}: unknown field (windows, ground, band, storeys)`);
      if (w.arches.storeys !== undefined) { if (!Array.isArray(w.arches.storeys) || !w.arches.storeys.length) problems.push(`${at}.arches.storeys: list of storeys (0 = ground)`); else w.arches.storeys.forEach(s => count(s, `${at}.arches.storeys`, 0, 39)); }
      if (w.arches.windows !== undefined) oneOf(w.arches.windows, ARCH_KINDS, `${at}.arches.windows`);
      if (w.arches.ground !== undefined) oneOf(w.arches.ground, ARCH_KINDS, `${at}.arches.ground`);
      if (w.arches.band !== undefined) oneOf(w.arches.band, ['brick', 'stone', 'voussoir', 'blocks', 'none'], `${at}.arches.band`);
      if (w.arches.windows !== undefined && !['brick-bay-grid', 'french-window-ledge'].includes(w.system)) problems.push(`${at}.arches.windows: arched windows need system brick-bay-grid or french-window-ledge`);
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
    if (w.hallDoors !== undefined) {
      const hd = w.hallDoors;
      for (const k of Object.keys(hd)) if (!['bays', 'arch', 'lights', 'rows', 'h'].includes(k)) problems.push(`${at}.hallDoors.${k}: unknown field (bays, arch, lights, rows, h)`);
      if (!Array.isArray(hd.bays) || !hd.bays.length) problems.push(`${at}.hallDoors.bays: list of bay indices`);
      else hd.bays.forEach(b => count(b, `${at}.hallDoors.bays`, 0, (w.baysPerStorey ?? 80) - 1));
      if (w.baysPerStorey === undefined) problems.push(`${at}.hallDoors.bays needs baysPerStorey`);
      if (hd.arch !== undefined) oneOf(hd.arch, ARCH_KINDS, `${at}.hallDoors.arch`);
      if (hd.lights !== undefined) count(hd.lights, `${at}.hallDoors.lights`, 1, 6);
      if (hd.rows !== undefined) count(hd.rows, `${at}.hallDoors.rows`, 1, 8);
      if (hd.h !== undefined && !(typeof hd.h === 'number' && hd.h >= 0.3 && hd.h <= 0.95)) problems.push(`${at}.hallDoors.h: fraction of the ground storey 0.3..0.95`);
      if (w.system !== 'brick-bay-grid') problems.push(`${at}.hallDoors: needs system brick-bay-grid`);
      if (w.hoist || w.entrance || w.gateways) problems.push(`${at}.hallDoors: not with hoist, entrance or gateways (all claim the ground storey)`);
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
    if (w.glazing !== undefined) { oneOf(w.glazing, ['panes'], `${at}.glazing`); if (w.frames === false) problems.push(`${at}.glazing: panes are framed by the sheet between them; not with frames false`); }
    if (w.courses !== undefined) { if (!Array.isArray(w.courses) || !w.courses.length) problems.push(`${at}.courses: list of sill, head`); else { w.courses.forEach(k => oneOf(k, ['sill', 'head'], `${at}.courses`)); if (new Set(w.courses).size !== w.courses.length) problems.push(`${at}.courses: each line once`); } if (!['brick-bay-grid', 'ribbon-windows', 'plinth-shopfronts', 'french-window-ledge'].includes(w.system)) problems.push(`${at}.courses: needs windows (brick-bay-grid, ribbon-windows, plinth-shopfronts or french-window-ledge)`); }
    if (w.spandrels !== undefined) {
      const sp = w.spandrels;
      if (!sp || typeof sp !== 'object') problems.push(`${at}.spandrels: object {sill, head, colour}`);
      else {
        for (const k of Object.keys(sp)) if (!['sill', 'head', 'colour'].includes(k)) problems.push(`${at}.spandrels.${k}: unknown field (sill, head, colour)`);
        for (const k of ['sill', 'head'] as const) if (sp[k] !== undefined && !(typeof sp[k] === 'number' && sp[k]! >= 0 && sp[k]! <= 0.6)) problems.push(`${at}.spandrels.${k}: fraction of the storey 0..0.6`);
        if ((sp.sill ?? 0) + (sp.head ?? 0) <= 0 || (sp.sill ?? 0) + (sp.head ?? 0) > 0.85) problems.push(`${at}.spandrels: sill + head must leave a vision band (0 < sill + head <= 0.85)`);
        if (sp.colour !== undefined) colour(sp.colour, `${at}.spandrels.colour`);
      }
      if (w.system !== 'curtain-wall' || intent.layeredKit === false) problems.push(`${at}.spandrels: a layered curtain-wall group`);
    }
    if (w.groundFactor !== undefined && !(typeof w.groundFactor === 'number' && w.groundFactor >= 0.3 && w.groundFactor <= 2.5)) problems.push(`${at}.groundFactor: number 0.3..2.5`);
    if (w.groundFactor !== undefined && (w.souterrain || w.ground === 'arcade' || w.alignWith !== undefined)) problems.push(`${at}.groundFactor: not with souterrain, an arcade ground or alignWith (they set the ground storey)`);
    if (w.shell !== undefined) count(w.shell, `${at}.shell`, 1, 20);
    if (w.openBays !== undefined) {
      if (!Array.isArray(w.openBays) || !w.openBays.length) problems.push(`${at}.openBays: list of {storeys, bays}`);
      else {
        const seen = new Set<number>();
        w.openBays.forEach((e, k) => {
          const ek = `${at}.openBays[${k}]`;
          if (!e || typeof e !== 'object') { problems.push(`${ek}: object {storeys, bays}`); return; }
          for (const key of Object.keys(e)) if (!['storeys', 'bays'].includes(key)) problems.push(`${ek}.${key}: unknown field (storeys, bays)`);
          if (!Array.isArray(e.storeys) || !e.storeys.length) problems.push(`${ek}.storeys: list of upper storeys (1 = first floor)`);
          else e.storeys.forEach(s => { count(s, `${ek}.storeys`, 1, 39); if (seen.has(s)) problems.push(`${ek}.storeys: storey ${s} listed twice`); seen.add(s); if (w.blankStoreys?.includes(s)) problems.push(`${ek}.storeys: storey ${s} is a blank storey`); });
          if (!Array.isArray(e.bays) || !e.bays.length) problems.push(`${ek}.bays: list of bay indices`);
          else e.bays.forEach(b => count(b, `${ek}.bays`, 0, (w.baysPerStorey ?? 80) - 1));
        });
      }
      if (w.baysPerStorey === undefined) problems.push(`${at}.openBays needs baysPerStorey`);
      if (!['brick-bay-grid', 'ribbon-windows'].includes(w.system)) problems.push(`${at}.openBays: needs windows in a brick-bay-grid or ribbon-windows group`);
      if (w.balconies || w.hoist || w.tiltedBays || w.screen || w.columns) problems.push(`${at}.openBays: not with balconies, hoist, tiltedBays, screen or columns (they pattern the bays too)`);
    }
    if (w.loggias !== undefined) {
      const lg = w.loggias, at2 = `${at}.loggias`;
      if (!lg || typeof lg !== 'object') problems.push(`${at2}: object {storeys, bays, w, h, sill, deep, rail, lights, colour}`);
      else {
        for (const k of Object.keys(lg)) if (!['storeys', 'bays', 'w', 'h', 'sill', 'deep', 'rail', 'lights', 'colour'].includes(k)) problems.push(`${at2}.${k}: unknown field (storeys, bays, w, h, sill, deep, rail, lights, colour)`);
        if (!Array.isArray(lg.storeys) || !lg.storeys.length) problems.push(`${at2}.storeys: list of storeys (0 = ground)`); else lg.storeys.forEach(s => { count(s, `${at2}.storeys`, 0, 39); if (w.blankStoreys?.includes(s) || w.glazedStoreys?.includes(s)) problems.push(`${at2}.storeys: storey ${s} is also blank or glazed`); });
        if (lg.bays !== undefined) { if (!Array.isArray(lg.bays) || !lg.bays.length) problems.push(`${at2}.bays: list of bay indices`); else lg.bays.forEach(b => count(b, `${at2}.bays`, 0, (w.baysPerStorey ?? 80) - 1)); if (w.baysPerStorey === undefined) problems.push(`${at2}.bays needs baysPerStorey`); }
        const fr = (v: unknown, k: string, lo: number, hi: number) => { if (v !== undefined && !(typeof v === 'number' && v >= lo && v <= hi)) problems.push(`${at2}.${k}: fraction ${lo}..${hi}`); };
        fr(lg.w, 'w', 0.3, 0.95); fr(lg.h, 'h', 0.4, 0.95); fr(lg.sill, 'sill', 0, 0.4); fr(lg.deep, 'deep', 0.25, 0.8);
        if ((lg.h ?? 0.8) + (lg.sill ?? 0.03) > 0.97) problems.push(`${at2}: sill + h must leave a soffit (<= 0.97 of the storey)`);
        if (lg.rail !== undefined) oneOf(lg.rail, ['glass', 'bars', 'solid', 'none'], `${at2}.rail`);
        if (lg.lights !== undefined) count(lg.lights, `${at2}.lights`, 1, 6);
        if (lg.colour !== undefined) colour(lg.colour, `${at2}.colour`);
      }
      if (!['brick-bay-grid', 'ribbon-windows', 'blank'].includes(w.system)) problems.push(`${at}.loggias: needs a brick-bay-grid, ribbon-windows or blank group (a wall to cut the loggias into)`);
      if (w.screen || w.balconies?.storeys.some(s => lg?.storeys?.includes(s))) problems.push(`${at}.loggias: not with screen, or balconies on the same storeys`);
      if (lg?.storeys?.includes(0) && (w.hoist || w.gateways || w.hallDoors || w.souterrain || w.ground === 'arcade')) problems.push(`${at}.loggias: a ground loggia not with hoist, gateways, hallDoors, souterrain or an arcade (they claim the ground storey)`);
    }
    if (w.plinth !== undefined) {
      const pl = w.plinth, at2 = `${at}.plinth`;
      if (!pl || typeof pl !== 'object') problems.push(`${at2}: object {storeys, bays, lights, sill, h, pier, transom, factor}`);
      else {
        for (const k of Object.keys(pl)) if (!['storeys', 'bays', 'lights', 'sill', 'h', 'pier', 'transom', 'factor'].includes(k)) problems.push(`${at2}.${k}: unknown field (storeys, bays, lights, sill, h, pier, transom, factor)`);
        count(pl.lights, `${at2}.lights`, 1, 8);
        const st = pl.storeys ?? [0];
        if (!Array.isArray(st) || !st.length) problems.push(`${at2}.storeys: list of storeys (0 = ground)`);
        else { st.forEach(s => { count(s, `${at2}.storeys`, 0, 2); if (w.loggias?.storeys?.includes(s) || w.blankStoreys?.includes(s) || w.glazedStoreys?.includes(s)) problems.push(`${at2}.storeys: storey ${s} is also a loggia, blank or glazed storey`); }); if (new Set(st).size !== st.length) problems.push(`${at2}.storeys: each storey once`); }
        if (pl.bays !== undefined) { if (!Array.isArray(pl.bays) || !pl.bays.length) problems.push(`${at2}.bays: list of bay indices`); else pl.bays.forEach(b => count(b, `${at2}.bays`, 0, (w.baysPerStorey ?? 80) - 1)); if (w.baysPerStorey === undefined) problems.push(`${at2}.bays needs baysPerStorey`); }
        const fr = (v: unknown, k: string, lo: number, hi: number) => { if (v !== undefined && !(typeof v === 'number' && v >= lo && v <= hi)) problems.push(`${at2}.${k}: number ${lo}..${hi}`); };
        fr(pl.sill, 'sill', 0, 0.5); fr(pl.h, 'h', 0.3, 0.96); fr(pl.pier, 'pier', 0.02, 0.5); fr(pl.transom, 'transom', 0, 0.95); fr(pl.factor, 'factor', 0.6, 2.5);
        if ((pl.sill ?? 0.04) + (pl.h ?? 0.84) > 0.97) problems.push(`${at2}: sill + h must leave a head (<= 0.97 of the storey)`);
        if (pl.factor !== undefined && st.includes?.(0) && (w.groundFactor !== undefined || w.souterrain)) problems.push(`${at2}.factor: on the ground storey not with groundFactor or souterrain (both set its height)`);
        if (pl.factor !== undefined && w.alignWith !== undefined) problems.push(`${at2}.factor: not with alignWith (that group sets the storey lines)`);
        if (st.includes?.(0) && (w.hoist || w.gateways || w.hallDoors || w.souterrain || (w.ground !== undefined && w.ground !== 'system'))) problems.push(`${at2}: a ground plinth not with hoist, gateways, hallDoors, souterrain or a ground other than "system" (they claim the ground storey)`);
      }
      if (['curtain-wall', 'glazed-hall', 'glazed-columns'].includes(w.system) || w.screen) problems.push(`${at}.plinth: under a wall with a face (not curtain-wall, glazed-hall, glazed-columns or screen)`);
    }
    if (w.meshScreen !== undefined) {
      const ms = w.meshScreen;
      if (!ms || typeof ms !== 'object') problems.push(`${at}.meshScreen: object {storeys, colour, from, to, joint}`);
      else {
        for (const k of Object.keys(ms)) if (!['storeys', 'colour', 'from', 'to', 'joint'].includes(k)) problems.push(`${at}.meshScreen.${k}: unknown field (storeys, colour, from, to, joint)`);
        if (!Array.isArray(ms.storeys) || !ms.storeys.length) problems.push(`${at}.meshScreen.storeys: list of storeys (0 = ground)`); else ms.storeys.forEach(s => count(s, `${at}.meshScreen.storeys`, 0, 39));
        colour(ms.colour, `${at}.meshScreen.colour`);
        const from = ms.from ?? 0.15, to = ms.to ?? 0.92;
        if (!(typeof from === 'number' && typeof to === 'number' && from >= 0 && to <= 1 && to - from >= 0.2)) problems.push(`${at}.meshScreen: 0 <= from < to <= 1, at least 0.2 of the storey`);
        if (ms.joint !== undefined && !(typeof ms.joint === 'number' && ms.joint >= 0.02 && ms.joint <= 0.3)) problems.push(`${at}.meshScreen.joint: metres 0.02..0.3`);
      }
      if (intent.layeredKit === false) problems.push(`${at}.meshScreen: layered kit only`);
      if (w.system === 'curtain-wall' || w.system === 'glazed-hall' || w.screen) problems.push(`${at}.meshScreen: over a wall with punched openings (not a curtain wall, glazed hall or brick screen)`);
    }
    if (w.souterrain !== undefined && w.souterrain !== true && w.souterrain !== false && w.souterrain !== 'single') problems.push(`${at}.souterrain: true, false or "single"`);
    if (w.souterrain && (w.system !== 'brick-bay-grid' || (w.ground !== undefined && w.ground !== 'system'))) problems.push(`${at}.souterrain: a brick-bay-grid with ground "system"`);
    if (w.souterrain && (w.hoist || w.gateways || w.hallDoors || w.entrance || w.garageDoors || w.garageBays)) problems.push(`${at}.souterrain: not with hoist, gateways, hallDoors, entrance or garage doors (they claim the ground storey)`);
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
    for (const [k, v] of Object.entries(w.palette ?? {})) { if (!['brick', 'frame', 'stone', 'glass', 'arch', 'plinth'].includes(k)) problems.push(`${at}.palette.${k}: only brick, frame, stone, glass, arch, plinth per group`); else colour(v, `${at}.palette.${k}`); }
    if (w.palette?.plinth !== undefined && w.ground !== 'mesh-plinth') problems.push(`${at}.palette.plinth: the plinth panel colour needs ground "mesh-plinth"`);
    if (w.palette?.arch !== undefined && !w.arches && !w.hoist) problems.push(`${at}.palette.arch: the arch ring colour needs arches or hoist`);
    if (w.windowShape !== undefined) {
      const s = w.windowShape;
      for (const k of Object.keys(s ?? {})) if (!['w', 'h', 'sill'].includes(k)) problems.push(`${at}.windowShape.${k}: unknown field (w, h, sill: fractions of bay / storey)`);
      const frac = (v: unknown, k: string, lo: number, hi: number) => { if (typeof v !== 'number' || !(v >= lo && v <= hi)) problems.push(`${at}.windowShape.${k}: fraction ${lo}..${hi}`); };
      frac(s?.w, 'w', 0.08, 0.98); frac(s?.h, 'h', 0.08, 0.98); frac(s?.sill, 'sill', 0, 0.9);
      if (typeof s?.h === 'number' && typeof s?.sill === 'number' && s.h + s.sill > 0.98) problems.push(`${at}.windowShape: sill + h must leave a head (<= 0.98 of the storey)`);
      if (!['brick-bay-grid', 'ribbon-windows', 'plinth-shopfronts', 'glazed-columns', 'french-window-ledge'].includes(w.system)) problems.push(`${at}.windowShape: only brick-bay-grid, ribbon-windows, plinth-shopfronts, glazed-columns, french-window-ledge windows take a measured shape`);
      if (w.screen) problems.push(`${at}.windowShape: not with screen (glass-block perforations)`);
    }
    if (w.windowPattern !== undefined) {
      const p = w.windowPattern;
      if (!Array.isArray(p) || p.length < 1 || p.length > 8) problems.push(`${at}.windowPattern: 1..8 widths (fractions of the bay)`);
      else p.forEach((v, i) => { if (typeof v !== 'number' || !(v >= 0.06 && v <= 0.99)) problems.push(`${at}.windowPattern[${i}]: fraction 0.06..0.99 of the bay`); });
      if (!['brick-bay-grid', 'plinth-shopfronts', 'french-window-ledge'].includes(w.system)) problems.push(`${at}.windowPattern: only brick-bay-grid, plinth-shopfronts and french-window-ledge windows take per-bay widths`);
      if (w.screen) problems.push(`${at}.windowPattern: not with screen (glass-block perforations)`);
      if (w.hoist || w.openBays || w.columns || w.tiltedBays) problems.push(`${at}.windowPattern: not with hoist, openBays, columns or tiltedBays (those keep their own per-bay rows)`);
    }
    if (w.system === 'glazed-hall') {
      const h = w.hall;
      if (!h) problems.push(`${at}.hall: glazed-hall needs hall {base, lights, rows}`);
      else {
        for (const k of Object.keys(h)) if (!['base', 'lights', 'rows'].includes(k)) problems.push(`${at}.hall.${k}: unknown field (base, lights, rows)`);
        if (typeof h.base !== 'number' || !(h.base >= 0.05 && h.base <= 0.8)) problems.push(`${at}.hall.base: fraction 0.05..0.8 of the eaves height`);
        count(h.lights, `${at}.hall.lights`, 1, 60); count(h.rows, `${at}.hall.rows`, 1, 40);
      }
      if (intent.layeredKit === false) problems.push(`${at}: a glazed hall's wall is its glass skin (layered kit only)`);
    } else if (w.hall !== undefined) problems.push(`${at}.hall: only system glazed-hall`);
    if (w.system === 'glazed-columns') {
      const c = w.columns;
      if (!c) problems.push(`${at}.columns: glazed-columns needs columns {bays, share?, from?, slabs?}`);
      else {
        for (const k of Object.keys(c)) if (!['bays', 'share', 'from', 'slabs', 'glass'].includes(k)) problems.push(`${at}.columns.${k}: unknown field (bays, share, from, slabs, glass)`);
        if (c.glass !== undefined) colour(c.glass, `${at}.columns.glass`);
        if (!Array.isArray(c.bays) || !c.bays.length) problems.push(`${at}.columns.bays: list of bay indices`);
        else c.bays.forEach(b => count(b, `${at}.columns.bays`, 0, (w.baysPerStorey ?? 80) - 1));
        if (w.baysPerStorey === undefined) problems.push(`${at}.columns.bays needs baysPerStorey`);
        if (c.share !== undefined && (typeof c.share !== 'number' || !(c.share >= 0.3 && c.share <= 1))) problems.push(`${at}.columns.share: fraction 0.3..1`);
        if (c.from !== undefined) count(c.from, `${at}.columns.from`, 0, 39);
        bool(c.slabs, `${at}.columns.slabs`);
      }
    } else if (w.columns !== undefined) problems.push(`${at}.columns: only system glazed-columns`);
    if (['glazed-hall', 'glazed-columns', 'french-window-ledge'].includes(w.system) && (w.balconies || w.hoist || w.tiltedBays || w.screen || w.gateways || w.blankStoreys)) problems.push(`${at}: ${w.system} takes no balconies, hoist, tiltedBays, screen, gateways or blankStoreys`);
    if (w.wallSplit !== undefined) {
      const s = w.wallSplit;
      for (const k of Object.keys(s ?? {})) if (!['at', 'brick'].includes(k)) problems.push(`${at}.wallSplit.${k}: unknown field (at, brick)`);
      if (typeof s?.at !== 'number' || !(s.at >= 0.1 && s.at <= 0.9)) problems.push(`${at}.wallSplit.at: fraction 0.1..0.9 of the main panel`);
      colour(s?.brick, `${at}.wallSplit.brick`);
      if (w.system === 'curtain-wall' || w.screen) problems.push(`${at}.wallSplit: only on a wall with a brick face (not curtain-wall or screen)`);
    }
    if (w.houses !== undefined) {
      const hs = w.houses;
      if (!Array.isArray(hs) || hs.length < 2 || hs.length > 24) problems.push(`${at}.houses: a row of 2..24 houses`);
      else {
        const total = hs.reduce((a, h) => a + (typeof h?.w === 'number' ? h.w : 0), 0);
        hs.forEach((h, k) => {
          const hat = `${at}.houses[${k}]`;
          for (const key of Object.keys(h ?? {})) if (!['w', 'bays', 'storeys', 'crown', 'brick', 'windowShape', 'ownEaves'].includes(key)) problems.push(`${hat}.${key}: unknown field (w, bays, storeys, crown, brick, windowShape, ownEaves)`);
          if (typeof h?.w !== 'number' || !(h.w > 0) || (total > 0 && h.w / total < 0.02)) problems.push(`${hat}.w: a positive share of the panel, at least 2 % of the row`);
          if (h?.bays !== undefined) count(h.bays, `${hat}.bays`, 1, 30);
          if (h?.storeys !== undefined) count(h.storeys, `${hat}.storeys`, 1, 12);
          if (h?.crown !== undefined) oneOf(h.crown, LARGE_HOUSE_CROWNS, `${hat}.crown`);
          if (h?.brick !== undefined) colour(h.brick, `${hat}.brick`);
          bool(h?.ownEaves, `${hat}.ownEaves`);
          if (h?.windowShape !== undefined) {
            const s = h.windowShape, frac = (v: unknown, key: string, lo: number, hi: number) => { if (typeof v !== 'number' || !(v >= lo && v <= hi)) problems.push(`${hat}.windowShape.${key}: fraction ${lo}..${hi}`); };
            for (const key of Object.keys(s ?? {})) if (!['w', 'h', 'sill'].includes(key)) problems.push(`${hat}.windowShape.${key}: unknown field (w, h, sill)`);
            frac(s?.w, 'w', 0.08, 0.98); frac(s?.h, 'h', 0.08, 0.98); frac(s?.sill, 'sill', 0, 0.9);
            if (typeof s?.h === 'number' && typeof s?.sill === 'number' && s.h + s.sill > 0.98) problems.push(`${hat}.windowShape: sill + h must leave a head (<= 0.98 of the storey)`);
          }
        });
      }
      if (!['brick-bay-grid', 'plinth-shopfronts'].includes(w.system)) problems.push(`${at}.houses: only brick-bay-grid or plinth-shopfronts rows (a brick face with punched windows)`);
      const clash = (['wallSplit', 'curve', 'columns', 'hall', 'screen', 'meshScreen', 'spandrels', 'alignWith', 'windowPattern', 'tiltedBays', 'openBays', 'hoist', 'gateways', 'hallDoors', 'garageBays', 'garageDoors', 'piers'] as const).filter(k => w[k] !== undefined && w[k] !== false);
      if (clash.length) problems.push(`${at}.houses: not with ${clash.join(', ')} (they lay one bay rhythm across the panel)`);
      if (w.balconies?.bays || w.balconies?.every !== undefined || w.plinth?.bays || w.loggias?.bays) problems.push(`${at}.houses: balconies, plinth and loggias run every bay of a row (no bay lists)`);
    }
    if (w.hand !== undefined) { if (!Array.isArray(w.hand)) problems.push(`${at}.hand: list of field paths`); else for (const k of w.hand) if (typeof k !== 'string' || !WALL_KEYS.includes(k.split('.')[0])) problems.push(`${at}.hand: ${JSON.stringify(k)} is not a wall-group field`); }
  });
  if (problems.length) throw new Error(`Invalid large intent ${intent?.id ?? '?'}:\n - ${problems.join('\n - ')}`);
  return intent;
}

/** Either kind: canal houses go through `validateIntent`, large buildings through `validateLargeIntent`. */
export function validateBuildingIntent(input: unknown): BuildingIntent {
  return (input as {kind?: string})?.kind === 'large' ? validateLargeIntent(input) : validateIntent(input);
}
