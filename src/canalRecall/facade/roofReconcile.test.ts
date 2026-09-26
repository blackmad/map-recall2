import assert from 'node:assert/strict';
import {
  reconcile,
  computeSection,
  deriveInwardNormal,
  type BuildingPartSurface,
  type ElevationPlane,
  type ProfileSample,
  type Point3,
} from './roofReconcile.ts';

let checks = 0;
const check = (condition: boolean, label: string) => {
  checks += 1;
  assert.ok(condition, label);
};

const sampleM = 0.1;
const width = (n: number) => Math.round(n * 10) / 10;

function makeProfile(width: number, up: (along: number) => number | null): ProfileSample[] {
  const samples: ProfileSample[] = [];
  for (let a = 0; a <= width + 1e-9; a += sampleM) {
    const along = Math.round(a * 1000) / 1000;
    samples.push({ along, up: up(along) });
  }
  return samples;
}

// A flat-topped box: a vertical wall at depth 0 up to `eave`, plus a flat
// horizontal roof from depth 0 to `roofDepth` at height `eave`. S(along) is
// then `eave` everywhere the roof/wall reach, for any along in [0, spanWidth].
function flatTopBox(spanWidth: number, eave: number, roofDepth = 3): BuildingPartSurface[] {
  const wall: Point3[] = [
    [0, 0, 0],
    [spanWidth, 0, 0],
    [spanWidth, 0, eave],
    [0, 0, eave],
  ];
  const roof: Point3[] = [
    [0, 0, eave],
    [spanWidth, 0, eave],
    [spanWidth, roofDepth, eave],
    [0, roofDepth, eave],
  ];
  return [
    { id: 'wall', vertices: wall },
    { id: 'roof', vertices: roof },
  ];
}

// A puntgevel-shaped wall, entirely on the facade plane (y = 0): rises
// linearly from `eave` at both ends to `peak` at `spanWidth / 2`.
function puntWall(spanWidth: number, eave: number, peak: number): BuildingPartSurface[] {
  const vertices: Point3[] = [
    [0, 0, 0],
    [spanWidth, 0, 0],
    [spanWidth, 0, eave],
    [spanWidth / 2, 0, peak],
    [0, 0, eave],
  ];
  return [{ id: 'wall', vertices }];
}

const plane = (spanWidth: number): ElevationPlane => ({ start: { x: 0, y: 0 }, end: { x: spanWidth, y: 0 } });

// --- deriveInwardNormal: points towards the building mass, not a guess from winding ---
{
  const surfaces = flatTopBox(4, 5);
  const tangent = { x: 1, y: 0 };
  const inward = deriveInwardNormal(surfaces, plane(4), tangent);
  check(inward.y > 0.9, 'inward normal points towards the building mass (+y), where the roof/wall vertices sit');
}

// --- computeSection: reads the flat-top box back out as a constant section ---
{
  const spanWidth = 4;
  const surfaces = flatTopBox(spanWidth, 5);
  const alongs = Array.from({ length: 41 }, (_, i) => width(i * sampleM));
  const section = computeSection(surfaces, plane(spanWidth), { x: 1, y: 0 }, { x: 0, y: 1 }, alongs, sampleM);
  check(
    section.every((v) => v != null && Math.abs(v - 5) < 1e-6),
    'S(along) reads the flat roof height everywhere across a flat-topped box',
  );
}

// --- Scenario 1: flat-topped box + a step-gable profile -> a screen with the right steps ---
{
  const spanWidth = 3;
  const eave = 5;
  const stepTop = 6;
  const surfaces = flatTopBox(spanWidth, eave);
  const profile = makeProfile(spanWidth, (along) => (along >= 1 && along <= 2 ? stepTop : eave + 0.05));
  const result = reconcile({ buildingId: 'test:step', surfaces, plane: plane(spanWidth), profile });

  const rises = result.relationSpans.filter((s) => s.relation === 'rises');
  check(rises.length === 1, 'exactly one rises span for the single step');
  check(Math.abs(rises[0].fromAlong - 1) < 1e-6 && Math.abs(rises[0].toAlong - 2) < 1e-6, `rises span covers [1, 2], got [${rises[0].fromAlong}, ${rises[0].toAlong}]`);
  const outsideAgree = result.relationSpans.filter((s) => s.relation === 'agree');
  check(outsideAgree.length === 2, 'flanks on both sides classify as agree (0.05 m is within the 0.30 m tolerance)');

  check(result.conflicts.length === 0, 'no conflicts for a valid rises span');
  check(result.patch != null && result.patch.length === 1, 'exactly one patch surface for the one step');
  const surface = result.patch![0];
  const frontTopZs = surface.vertices.filter((_, i) => true).map((v) => v[2]);
  const maxZ = Math.max(...frontTopZs);
  const minZ = Math.min(...frontTopZs);
  check(Math.abs(maxZ - stepTop) < 1e-6, `screen top follows the measured step height (${maxZ} ~ ${stepTop})`);
  check(Math.abs(minZ - eave) < 1e-6, `screen bottom closes onto S = eave (${minZ} ~ ${eave})`);
  check(surface.triangles.length > 0 && surface.triangles.length <= 80, `triangle count ${surface.triangles.length} is within budget`);
}

// --- Scenario 2: a pitched wall whose section already matches -> agree, no patch ---
{
  const spanWidth = 4;
  const eave = 5;
  const peak = 7;
  const surfaces = puntWall(spanWidth, eave, peak);
  const profile = makeProfile(spanWidth, (along) => eave + (peak - eave) * (1 - Math.abs(along - spanWidth / 2) / (spanWidth / 2)));
  const result = reconcile({ buildingId: 'test:punt', surfaces, plane: plane(spanWidth), profile });

  check(
    result.relationSpans.every((s) => s.relation === 'agree'),
    `every span agrees when the profile already matches the 3DBAG section, got ${JSON.stringify(result.relationSpans)}`,
  );
  check(result.patch === null, 'no patch when 3DBAG already has the pitched shape');
  check(result.conflicts.length === 0, 'no conflicts when the section already agrees');
}

// --- Scenario 3: a profile below the roof -> conflict, no patch ---
{
  const spanWidth = 3;
  const eave = 5;
  const surfaces = flatTopBox(spanWidth, eave);
  const profile = makeProfile(spanWidth, () => eave - 0.8);
  const result = reconcile({ buildingId: 'test:below', surfaces, plane: plane(spanWidth), profile });

  check(
    result.relationSpans.every((s) => s.relation === 'below'),
    'the whole span classifies as below when the profile sits well under the 3DBAG roof',
  );
  check(result.patch === null, 'no patch for a below span — v1 abstains');
  check(result.conflicts.length === 1 && result.conflicts[0].kind === 'below', 'exactly one below conflict is recorded');
  check(result.conflicts[0].detailM > 0.5, `conflict records the deficit magnitude (${result.conflicts[0].detailM})`);
}

// --- Scenario 4: a half-null profile -> patch only over the measured span ---
{
  const spanWidth = 3;
  const eave = 5;
  const stepTop = 6;
  const surfaces = flatTopBox(spanWidth, eave);
  const profile = makeProfile(spanWidth, (along) => (along < 1.5 ? null : stepTop));
  const result = reconcile({ buildingId: 'test:half-null', surfaces, plane: plane(spanWidth), profile });

  const unknown = result.relationSpans.filter((s) => s.relation === 'unknown');
  check(unknown.length === 1 && Math.abs(unknown[0].toAlong - 1.4) < 1e-6, 'the unmeasured flank classifies as unknown, up to the last null column');
  check(result.patch != null && result.patch.length === 1, 'a patch exists only for the measured (rises) span');
  const [from, to] = result.patch![0].spanAlong;
  check(Math.abs(from - 1.5) < 1e-6 && Math.abs(to - spanWidth) < 1e-6, `patch spans only the measured range [1.5, ${spanWidth}], got [${from}, ${to}]`);
}

// --- Validity: front face is coplanar with the facade plane ---
{
  const spanWidth = 3;
  const eave = 5;
  const surfaces = flatTopBox(spanWidth, eave);
  const profile = makeProfile(spanWidth, (along) => (along >= 1 && along <= 2 ? 6 : eave));
  const result = reconcile({ buildingId: 'test:coplanar', surfaces, plane: plane(spanWidth), profile });
  const surface = result.patch![0];
  // Front-face vertices are exactly those with y (depth) == 0 in this frame.
  const frontVertices = surface.vertices.filter((v) => Math.abs(v[1]) < 1e-6);
  check(frontVertices.length > 0, 'front-face vertices exist');
  check(
    frontVertices.every((v) => Math.abs(v[1]) < 0.01),
    'every front-face vertex is within 1 cm of the facade plane',
  );
}

// --- Validity: no degenerate triangles ---
{
  const spanWidth = 3;
  const eave = 5;
  const surfaces = flatTopBox(spanWidth, eave);
  const profile = makeProfile(spanWidth, (along) => (along >= 1 && along <= 2 ? 6 : eave));
  const result = reconcile({ buildingId: 'test:degenerate', surfaces, plane: plane(spanWidth), profile });
  const surface = result.patch![0];
  const area = (a: Point3, b: Point3, c: Point3) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    return Math.hypot(cx, cy, cz) / 2;
  };
  check(
    surface.triangles.every(([i, j, k]) => area(surface.vertices[i], surface.vertices[j], surface.vertices[k]) > 1e-6),
    'every triangle has non-negligible area',
  );
}

// --- Validity: normals point outward (front face normal points away from the building) ---
{
  const spanWidth = 3;
  const eave = 5;
  const surfaces = flatTopBox(spanWidth, eave);
  const profile = makeProfile(spanWidth, (along) => (along >= 1 && along <= 2 ? 6 : eave));
  const result = reconcile({ buildingId: 'test:normals', surfaces, plane: plane(spanWidth), profile });
  const surface = result.patch![0];
  // Any triangle whose vertices are all at depth (y) == 0 is a front-face triangle;
  // its normal should point in -y (away from the building, towards the street).
  const isFront = (tri: [number, number, number]) => tri.every((i) => Math.abs(surface.vertices[i][1]) < 1e-6);
  const frontNormals = surface.triangles
    .map((tri, i) => ({ tri, normal: surface.normals[i] }))
    .filter(({ tri }) => isFront(tri));
  check(frontNormals.length > 0, 'at least one front-face triangle exists');
  check(
    frontNormals.every(({ normal }) => normal[1] < -0.99),
    'front-face triangle normals point outward (-y, away from the building)',
  );
}

// --- Validity: closed — the screen's bottom meets S with no gap ---
{
  const spanWidth = 3;
  const eave = 5;
  const surfaces = flatTopBox(spanWidth, eave);
  const alongs = Array.from({ length: 31 }, (_, i) => width(i * sampleM));
  const section = computeSection(surfaces, plane(spanWidth), { x: 1, y: 0 }, { x: 0, y: 1 }, alongs, sampleM);
  const profile = makeProfile(spanWidth, (along) => (along >= 1 && along <= 2 ? 6 : eave));
  const result = reconcile({ buildingId: 'test:closed', surfaces, plane: plane(spanWidth), profile });
  const surface = result.patch![0];
  // Bottom vertices sit at depth 0 or thicknessM with the minimum height in the surface.
  const minZ = Math.min(...surface.vertices.map((v) => v[2]));
  check(Math.abs(minZ - eave) < 1e-9, `the screen's lowest point sits exactly on S = eave (${minZ})`);
}

// --- Validity: peak above ridge + 6 m is rejected as an invalid screen (a conflict, not a patch) ---
{
  const spanWidth = 3;
  const eave = 5;
  const surfaces = flatTopBox(spanWidth, eave);
  const profile = makeProfile(spanWidth, (along) => (along >= 1 && along <= 2 ? eave + 10 : eave));
  const result = reconcile({ buildingId: 'test:too-tall', surfaces, plane: plane(spanWidth), profile });
  check(result.patch === null, 'an implausible 10 m rise produces no patch');
  check(
    result.conflicts.some((c) => c.kind === 'invalid-screen'),
    'an implausible rise is recorded as an invalid-screen conflict instead',
  );
}

// --- Validity: triangle budget holds even for a wide, densely-sampled rises span with no gable fit ---
{
  const spanWidth = 8;
  const eave = 5;
  const surfaces = flatTopBox(spanWidth, eave, 6);
  // A noisy profile with no template fit: every 0.1 m column differs slightly, which
  // would build far more than 80 triangles without column capping.
  const profile = makeProfile(spanWidth, (along) => eave + 1 + 0.05 * Math.sin(along * 17));
  const result = reconcile({ buildingId: 'test:budget', surfaces, plane: plane(spanWidth), profile });
  check(result.patch != null && result.patch.length === 1, 'a wide noisy rises span still produces one screen');
  check(result.patch![0].triangles.length <= 80, `triangle count ${result.patch![0].triangles.length} stays within the 80-triangle budget`);
}

console.log(`roofReconcile.test.ts: ${checks} checks passed`);
