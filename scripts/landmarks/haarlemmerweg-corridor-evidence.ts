/**
 * Attach the wall-level panorama evidence to scripts/landmarks/haarlemmerweg-corridor-inventory.json.
 *
 *   node --import tsx scripts/landmarks/haarlemmerweg-corridor-evidence.ts
 *
 * The corridor inventory was built from BAG WFS (pands + verblijfsobjecten), the building tiles and the
 * panorama sweep (`all-walls.ts --archive`). This pass re-reads the archived `walls.json` for the TRACK_M
 * pands and records, per wall, the crop tag, panorama id, capture date, geometry (obliquity/distance) and
 * the measured occlusion (foliage / washed-out / missing fractions), plus whether the capture predates the
 * BAG build year — a crop of a 2023 building taken in 2019 shows its predecessor or a building site and is
 * not evidence for the model.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const INVENTORY = 'scripts/landmarks/haarlemmerweg-corridor-inventory.json';
const SOURCE = process.env.MAP_RECALL_SOURCE_DATA ?? '/Users/blackmad/Code/map-recall2-worktrees/source-archive';
const batch = ['0363100012250971', '0363100012250972', '0363100012116511', '0363100012066028'];

/** What the lane actually got out of each Track M pand (B6 steps 0-7), kept next to the wall evidence. */
const OUTCOMES: Record<string, {houseId: string; triangles: number; likeness: string; outcome: string; reason: string}> = {
  '0363100012250972': {
    houseId: 'haarlemmerweg-940',
    triangles: 18145,
    likeness: 'walls[0] FAIL (blue-cast crop, wall family and glazing band off by 0.21), walls[1] FAIL (glazing band 0.22, columns 9 vs photo 3), walls[2] NO EVIDENCE (51.6 deg obliquity), walls[3] NO PHOTO',
    outcome: 'do not install',
    reason: 'triangle budget: 18,145 tris for 16 storeys x 8 bays on four faces (520 recessed openings); no face of this tower reaches 12k at the measured 2.68 m pitch, and two of the four faces have no usable post-build crop.',
  },
  '0363100012250971': {
    houseId: 'haarlemmerweg-778',
    triangles: 3686,
    likeness: 'walls[0] NO EVIDENCE (foliage 42%), walls[1] NO EVIDENCE (foliage 31%, storey pitch read as 5.83 m), walls[2] NO EVIDENCE (foliage 46%), walls[3] NO PHOTO',
    outcome: 'blocked (no measurable evidence)',
    reason: 'the only post-build capture is one 2025-07-01 pass and every wall crop is through summer trees (31-46% foliage), so measure.ts refuses all three walls; older crops show the 1980s office block this tower replaced.',
  },
  '0363100012116511': {
    houseId: 'haarlemmerweg-290',
    triangles: 15262,
    likeness: 'not judged: the house was held before measure --write (the measured rhythm needs more openings than the budget allows)',
    outcome: 'held (triangle budget, not built)',
    reason: '14 storeys x 7 bays on four faces needs 279-377 recessed openings = 15.3k tris, 3.3k over the 12k budget; the balcony-band reading is the kit balcony plus glass rail, which is the expensive form.',
  },
  '0363100012066028': {
    houseId: 'molenwerf-1-066028',
    triangles: 8828,
    likeness: 'walls[0] FAIL (wall dL +0.20, glazing storey band 0.45 vs photo 0.54; columns 6 vs 6, shape wide vs wide, IoU 0.63), walls[1] NO PHOTO (the 30 m wing)',
    outcome: 'held (gates)',
    reason: 'fits the budget (8,828 tris) and the measured bay rhythm, but eaves-vs-3dbag fails on both groups (group 0 model 19.47 m against a sampled LoD2.2 roof at 4.02 m; group 1 29.73 m against 19.40 m) and one opening sits 1.19 m2 outside a wall; seen at build time, not resolved.',
  },
};

type Wall = Record<string, any>;
type Row = Record<string, any>;

const inv = JSON.parse(await fs.readFile(INVENTORY, 'utf8'));
const byPand = new Map<string, Row>(inv.rows.map((r: Row) => [r.pand, r]));

const cut = (v: any) => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v);

for (const pand of batch) {
  const row = byPand.get(pand);
  if (!row) throw new Error(`pand ${pand} not in ${INVENTORY}`);
  const file = path.join(SOURCE, 'pand-reference-walls', pand, 'walls.json');
  const walls: Wall[] = JSON.parse(await fs.readFile(file, 'utf8')).walls;
  const built = Number(row.builtYear);
  const evidence = walls
    .filter(w => w.crop && !/L$/.test(w.tag))
    .map(w => {
      const captured = String(w.capturedAt ?? '');
      const year = Number(captured.slice(0, 4));
      const postBuild = Number.isFinite(year) && Number.isFinite(built) ? year >= built : null;
      const g = w.guess ?? null;
      const fraction = (v: number | undefined) => (typeof v === 'number' ? v : null);
      const foliage = fraction(w.foliage);
      const washed = fraction(w.washedOut);
      const missing = fraction(w.missingFraction);
      const usable =
        postBuild === true &&
        (missing ?? 0) < 0.15 &&
        (foliage ?? 0) < 0.25 &&
        (washed ?? 0) < 0.35 &&
        (w.obliquityDeg ?? 90) <= 45;
      return {
        wall: w.tag,
        bearing: w.bearing,
        lengthM: cut(w.lengthM),
        crop: `${pand}/${w.tag}.jpg`,
        panorama: w.panoId ?? null,
        capturedAt: captured || null,
        cameraDistM: cut(w.cameraDistM),
        obliquityDeg: cut(w.obliquityDeg),
        foliage,
        washedOut: washed,
        missingFraction: missing,
        cameraHeadingDeg: cut(w.headingDeg),
        postDatesBuild: postBuild,
        usableForMeasurement: usable,
        ...(g ? { guess: g } : {}),
      };
    });
  row.panorama = {
    ...(row.panorama ?? {}),
    wallEvidence: evidence,
    usableForMeasurement: evidence.filter(e => e.usableForMeasurement).length,
    evidenceNote:
      evidence.length === 0
        ? 'no archived wall crop'
        : `${evidence.filter(e => e.usableForMeasurement).length} of ${evidence.length} archived walls pass measure.ts's limits (post-build, foliage < 25%, washed-out < 35%, obliquity <= 45 deg)`,
  };
}

inv.phase2 = {
  note:
    'Track M batch taken in this lane: the TRACK_M pands with a post-build, measurable corridor wall. ' +
    'Wall evidence is per crop in rows[].panorama.wallEvidence (all-walls.ts --archive, --min-len=8 --max=12 --max-dist=60).',
  candidates: batch.map(pand => {
    const row = byPand.get(pand)!;
    return {
      pand,
      addresses: [row.addresses[0], row.addresses[row.addresses.length - 1]],
      houseId: `haarlemmerweg-${String(row.addresses[0]).split(' ')[1]}`,
      footprintM2: row.footprintM2,
      heightM: row.heightM,
      storeys: row.storeys,
      builtYear: row.builtYear,
      side: row.side,
      usableWalls: row.panorama?.usableForMeasurement ?? 0,
      ...(OUTCOMES[pand] ? OUTCOMES[pand] : {}),
      walls: (row.panorama?.wallEvidence ?? []).map((e: any) => ({
        wall: e.wall,
        bearing: e.bearing,
        capturedAt: e.capturedAt,
        usable: e.usableForMeasurement,
      })),
    };
  }),
};

inv.nextSteps = {
  STREET_SURVEY:
    'The 1934-38 rows on the south side (Haarlemmerweg 507-651, and the Gibraltarstraat / Van Gentstraat / ' +
    'Kijkduinstraat / Livornostraat / Solebaystraat corners) and the 1988 row at 477-495 are repetitive ' +
    'frontages: one rhythm per block face, shared facade recipe (street-survey / block-face pipeline), not one ' +
    'large recipe per address. Those blocks carry the shopfronts the user photographed (Stichting De Gibraltar, ' +
    'Amsterdam Skin care, Taco Lindo West, Dojo Doorje).',
  TRACK_L:
    'No pand in this window is a pre-1900 ornamented historic front, so this corridor produced no TRACK_L row. ' +
    'If the 1934 decorative brick fronts at 507-519 are judged too ornamented for the block-face survey they are ' +
    'the only Track L candidates here, and need a Track L lane with its own inventory and elevations.',
  NO_EVIDENCE:
    'Molenwerf 1 and Molenwerf 2 (the 1980/2003 office campus behind the north-side frontage: Kennedy Van der ' +
    'Laan, WJ Digital Marketing, MB limousines, Gymbase Westerpark in the user screenshot) have no panorama ' +
    'reaching a corridor-facing wall (29-38 m back behind their forecourt), and Haarlemmerweg 518A has only a ' +
    '2022 construction crop. Haarlemmerweg 1140A is a 2024 cycle shed. They stay unbuilt until a newer capture ' +
    'or a survey route exists.',
  TRACK_M_REMAINING:
    'Molenwerf 1 stays TRACK_M but unbuilt (no corridor panorama); 518A needs a post-2023 capture of its ' +
    'Haarlemmerweg front before it can be measured.',
  userTypo:
    'The user typed "Haarlemmerdijk"; the screenshot and the corridor coordinates are the Haarlemmerweg between ' +
    'Molenwerf and Solebaystraat, which is what this inventory covers.',
};

const order: Record<string, number> = { TRACK_M: 0, ALREADY_MODELLED: 1, STREET_SURVEY: 2, NO_EVIDENCE: 3, TRACK_L: 4 };
const num = (r: Row) => {
  const hw = r.addresses.find((a: string) => a.startsWith('Haarlemmerweg'));
  const n = hw ? Number(String(hw).split(' ')[1].replace(/[^\d]/g, '')) : NaN;
  return Number.isFinite(n) ? n : 99999;
};
inv.tally = {};
for (const r of inv.rows) inv.tally[r.classification] = (inv.tally[r.classification] ?? 0) + 1;
inv.rows.sort((a: Row, b: Row) => (order[a.classification] ?? 9) - (order[b.classification] ?? 9) || num(a) - num(b) || String(a.pand).localeCompare(String(b.pand)));

await fs.writeFile(INVENTORY, `${JSON.stringify(inv, null, 1)}\n`);
console.log(`rows ${inv.rows.length}`, inv.tally);
for (const pand of batch) console.log(pand, byPand.get(pand)!.panorama.evidenceNote);
