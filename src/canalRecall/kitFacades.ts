/**
 * Facades the generic kits cannot read from their crops (GitHub #49, kit review round 4): metal rib, board and louvre
 * cladding, panel cassettes and curtain walls. The facts pipeline (publicBuildingFacts.ts) measures a wall colour and
 * window rows, which turned a ribbed-metal concert hall into a brown box with five window bands (sheet row 279). Each
 * entry here was read off the pand's own panorama crops on the round 4 sheets (`kits-r5-<n>.png`, row in `why`),
 * colours sampled from those crops; heights are fractions of the crop's wall times the kit's eaves.
 *
 * `applyKitFacade` turns the kit into its hall form (widthM 0: walls only, no roof of its own) when it was a plain
 * body, sets the wall colour, replaces the window rows when `rows` is given, and adds the cladding zones
 * (landmarkKits.ts KitCladding). A kit without an entry is returned unchanged.
 */
import type { Kit, KitCladding, KitWindowRow } from './landmarkKits.js';

export type KitFacade = {
  cladding: KitCladding[];
  /** wall colour under and between the cladding zones */
  wallHex?: string;
  /** the fill window rows instead of the measured ones ([] none) */
  rows?: KitWindowRow[];
  glassHex?: string; frameHex?: string;
  why: string;
};

const P = 'NL.IMBAG.Pand.';

export const KIT_FACADES: Readonly<Record<string, KitFacade>> = {
  // AFAS Live (2001, 19.8 m): silver vertical-ribbed metal over a ground storey of grey panel doors (0.39 of the crop's
  // wall), one band of narrow windows at 0.69-0.84 of it. Ribs #a4a19a (upper crop), doors #575b5a.
  [`${P}0363100012123240`]: {
    why: 'row 279 (kits-r5-70): grey vertical-ribbed metal hall with one continuous window band and large ground openings',
    wallHex: '#9f9c95',
    rows: [{ z0: 13.6, z1: 16.6, widthM: 1.2, bayM: 1.6, ribbon: true }],
    glassHex: '#3d4246', frameHex: '#8f8c86',
    cladding: [
      { kind: 'panels', hex: '#6a6e6c', z0: 0, z1: 7.7, pitchM: 4.5, rowM: 7.7, lineHex: '#45494a' },
      { kind: 'ribs', hex: '#a4a19a', z0: 7.7, pitchM: 0.45 },
    ],
  },
  // Cinema Amstelveen (2002, 16.6 m): dark grey horizontal louvres over the upper 0.42 of the wall; below, a grid of
  // dark panels and green-grey glass (#72746d / #87a897) over a covered passage.
  [`${P}0362100001111443`]: {
    why: 'row 355 (kits-r5-89): dark grey horizontal louvre cladding over a fully glazed and panelled ground floor',
    wallHex: '#6f716c', rows: [],
    cladding: [
      { kind: 'curtain', hex: '#5c6662', z0: 0, z1: 9.4, pitchM: 2.4, rowM: 2.3, lineHex: '#9a9c97' },
      { kind: 'louvres', hex: '#8d8f8c', z0: 9.6, pitchM: 0.32, lineHex: '#3e4140' },
    ],
  },
  // Pathé Arena (2000, 19.9 m): grey-green metal cassette panels all over (#7a8184 shade, #8ea59f lit), about 1.5 m wide
  // and 1.1 m tall on the crop. The sloped dark glazed band over the entrance is not expressible (one edge only).
  [`${P}0363100012100092`]: {
    why: 'row 278 (kits-r5-70): grey metal-panel cladding (the sloped glazed band over the entrance is left out)',
    wallHex: '#848d8e', rows: [],
    cladding: [{ kind: 'panels', hex: '#848d8e', z0: 0, pitchM: 1.5, rowM: 1.1, lineHex: '#5f6668' }],
  },
  // Film and Television Academy (1999, 19.5 m): a green-grey curtain wall, glass #434f47, mullions #535e54 about 1.6 m
  // apart, transoms at each 1.3 m band of opaque glass.
  [`${P}0363100012170259`]: {
    why: 'row 280 (kits-r5-70): full-height green-grey curtain-wall grid',
    wallHex: '#4d5a50', rows: [],
    cladding: [{ kind: 'curtain', hex: '#47544b', z0: 0, pitchM: 1.6, rowM: 1.3, lineHex: '#6d7a6f' }],
  },
  // Islamitisch Centrum Quba (1990, 7.4 m): pale blue horizontal profiled metal (#7baad1) above a sign band at 0.47 of
  // the wall, brick below (#5a5e68 raw, #7d7d8d white-balanced on the sign band) with shop windows.
  [`${P}0363100012128901`]: {
    why: 'row 258 (kits-r5-65): blue metal-clad upper band over a low brick plinth with a glazed shopfront',
    wallHex: '#7d7d8d',
    rows: [{ z0: 0.7, z1: 2.9, widthM: 2.4, bayM: 3.2, head: 'flat' }],
    glassHex: '#3f4a52', frameHex: '#d9dcdc',
    cladding: [{ kind: 'boards', hex: '#86b0d2', z0: 3.5, pitchM: 0.3 }],
  },
  // School (1959, 11.5 m): white-gridded curtain wall with blue spandrel bands (#5f7571 glass row).
  [`${P}0363100012104151`]: {
    why: 'row 117 (kits-r5-30): near-fully glazed white-gridded curtain wall with blue spandrel panels',
    wallHex: '#dfe2df', rows: [],
    cladding: [{ kind: 'curtain', hex: '#5a6d6c', z0: 0.3, pitchM: 1.3, rowM: 1.9, lineHex: '#eef0ee', spandrelM: 0.5, spandrelHex: '#5d7fa6' }],
  },
  // De Bonkelaar (1973, 4.5 m): light grey horizontal profiled metal (#8ba2a4 through leaves), one storey.
  [`${P}0363100012079924`]: {
    why: 'row 137 (kits-r5-35): grey horizontal ribbed metal cladding',
    wallHex: '#a3abae',
    cladding: [{ kind: 'boards', hex: '#a3abae', z0: 0, pitchM: 0.22 }],
  },
  // School (1971, 4.5 m): a low pavilion walled in blue-framed glazing and coloured panels (blue read by eye: the
  // posts are too thin on the crop to sample).
  [`${P}0358100021569571`]: {
    why: 'row 367 (kits-r5-92): long wall almost entirely blue-framed glazing and coloured panels',
    wallHex: '#b1b6b8', rows: [],
    // ochre-panelled glazing between blue posts about 2.6 m apart, under a grey fascia from 0.75 of the wall
    cladding: [
      { kind: 'curtain', hex: '#a68c62', z0: 0.3, z1: 3.3, pitchM: 2.6, rowM: 9, lineHex: '#3f6496' },
      { kind: 'panels', hex: '#b1b6b8', z0: 3.45, pitchM: 3, rowM: 9 },
    ],
  },
  // De Dapper (1985, 12.4 m): pale grey metal-panel upper volume (#7e8790 shaded) raised over a glazed ground floor.
  [`${P}0363100012112062`]: {
    why: 'row 196 (kits-r5-49): pale grey metal-panel clad upper volume on pilotis over a glazed ground floor',
    wallHex: '#aeb3b5', rows: [],
    cladding: [
      { kind: 'curtain', hex: '#3f474c', z0: 0, z1: 4.2, pitchM: 2.4, rowM: 4.2, lineHex: '#d0d0c8' },
      { kind: 'panels', hex: '#aeb3b5', z0: 4.6, pitchM: 2.4, rowM: 12, lineHex: '#868c8f' },
    ],
  },
};

/** The kit with its facade entry applied (see the module comment), or the kit itself. */
export function applyKitFacade(kit: Kit, id: string, eavesM: number, facade: KitFacade | undefined = KIT_FACADES[id]): Kit {
  if (!facade) return kit;
  const wall = { plain: true as const, hex: facade.wallHex ?? kit.wall?.hex ?? '#a8a6a0' };
  const hall = kit.halls?.find(h => h.id === id);
  const prior = hall?.windows;
  const windows = {
    ...(prior ?? {}),
    rows: facade.rows ?? prior?.rows ?? [],
    ...(facade.glassHex ? { glassHex: facade.glassHex } : {}),
    ...(facade.frameHex ? { frameHex: facade.frameHex } : {}),
    // the measured sash bars and top band belong to the brick front the facade replaces
    sash: undefined, topBand: undefined,
    cladding: facade.cladding,
  };
  if (hall) return { ...kit, wall, halls: kit.halls!.map(h => (h === hall ? { ...h, windows } : h)) };
  // a plain body: walls only, as a hall with no roof of its own (widthM 0, riseM 0), like publicBuildings.ts cinemaKit
  const { body: _body, trim, ...rest } = kit;
  return { ...rest, wall, halls: [{ id, widthM: 0, anchor: [0, 0], eavesM, riseM: 0, mat: 'slate', windows: { ...windows, ...(trim?.plinth ? { plinth: trim.plinth } : {}) } }] };
}
