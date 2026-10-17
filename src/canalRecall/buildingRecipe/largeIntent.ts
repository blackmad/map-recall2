/**
 * Validator for `kind: "large"` intents (schema in intent.ts, `LargeBuildingIntent`). Same contract as the canal-house
 * validator: names, counts and component switches only; no coordinate or metric field anywhere. Wall surfaces are
 * checked against the facts when the fit runs (`fitLarge`), not here.
 */
import {GROUP_WALL_MATERIALS, ROOF_MATERIALS, SOURCE_KINDS, SWATCHES, WALL_MATERIALS, validateIntent, type BuildingIntent, type LargeBuildingIntent} from './intent.ts';
import {LARGE_GROUNDS, LARGE_SYSTEMS, LARGE_WINDOWS} from '../blockBuilding/systems.ts';
import {ARCH_KINDS} from '../blockBuilding/arch.ts';

const COORDINATE_KEYS = /^(x|y|z|left|right|top|bottom|width|height|depth|offset|position|coordinates|ring|vertices|plane)(M)?$|M$/;
const WALL_KEYS = ['wallSurfaces', 'street', 'system', 'storeys', 'alignWith', 'baysPerStorey', 'ground', 'windows', 'entrance', 'signage', 'garageDoors', 'garageBays', 'stringCourses', 'cornice', 'piers', 'balconies', 'blankStoreys', 'glazedStoreys', 'police', 'palette', 'arches', 'hoist', 'sills', 'frames', 'deepBars', 'nameBoards', 'crosses', 'curve', 'wallMaterial', 'tiltedBays', 'screen', 'stoneStoreys', 'pilasters', 'lantern', 'gateways', 'hallDoors', 'windowShape', 'hand', 'hall', 'columns', 'wallSplit', 'arcade', 'glazing', 'courses', 'souterrain'];
const HOUSE_KEYS = ['schemaVersion', 'kind', 'id', 'pandId', 'address', 'sources', 'walls', 'otherWalls', 'roofPlant', 'roof', 'palette', 'closedBands', 'layeredKit', 'shellRepair', 'footprint', 'groundClamp', 'measured', 'notes'];
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
  if (intent?.otherWalls !== undefined) oneOf(intent.otherWalls, LARGE_SYSTEMS, 'otherWalls');
  bool(intent?.roofPlant, 'roofPlant'); bool(intent?.closedBands, 'closedBands'); bool(intent?.layeredKit, 'layeredKit'); bool(intent?.shellRepair, 'shellRepair');
  if (intent?.footprint !== undefined) oneOf(intent.footprint, ['lod22', 'bag'], 'footprint');
  if (intent?.groundClamp !== undefined && typeof intent.groundClamp !== 'boolean') problems.push('groundClamp: boolean');
  if (intent?.roof !== undefined) {
    const r = intent.roof;
    oneOf(r?.material, ROOF_MATERIALS, 'roof.material');
    for (const k of Object.keys(r ?? {})) if (!['material', 'flat', 'surfaces', 'flatHex'].includes(k)) problems.push(`roof.${k}: unknown field (material, flat, surfaces, flatHex)`);
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
    for (const [k, v] of Object.entries(w.palette ?? {})) { if (!['brick', 'frame', 'stone', 'glass', 'arch'].includes(k)) problems.push(`${at}.palette.${k}: only brick, frame, stone, glass, arch per group`); else colour(v, `${at}.palette.${k}`); }
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
    if (w.hand !== undefined) { if (!Array.isArray(w.hand)) problems.push(`${at}.hand: list of field paths`); else for (const k of w.hand) if (typeof k !== 'string' || !WALL_KEYS.includes(k.split('.')[0])) problems.push(`${at}.hand: ${JSON.stringify(k)} is not a wall-group field`); }
  });
  if (problems.length) throw new Error(`Invalid large intent ${intent?.id ?? '?'}:\n - ${problems.join('\n - ')}`);
  return intent;
}

/** Either kind: canal houses go through `validateIntent`, large buildings through `validateLargeIntent`. */
export function validateBuildingIntent(input: unknown): BuildingIntent {
  return (input as {kind?: string})?.kind === 'large' ? validateLargeIntent(input) : validateIntent(input);
}
