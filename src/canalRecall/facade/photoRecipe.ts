import { authoredField, type BuildingRecipe, type RecipeOpening } from './recipe.ts';
import { buildElevations } from './elevations.ts';
import { dependencyHash } from './registrationGold.ts';

export interface PhotoColour {
  hex: string; note?: string; rgb?: number[]; p10?: number[]; p90?: number[];
  pixels?: number; basis?: string; state?: string;
}
export interface PhotoWindowAppearance {
  boundBox: [number, number, number, number];
  trimColour: PhotoColour | null; glassColour: PhotoColour | null; panelColour?: PhotoColour | null;
  bars: Array<{ axis: 'horizontal' | 'vertical'; fraction: number; sourceLine: number[]; support?: number; colour?: PhotoColour | null; basis: string; state: string }>;
  style: { value: string | null; basis: string; state: string; confidence: number | null };
  note: string; unknown: string[];
}
export interface PhotoAppearance {
  version: string; state: string;
  region?: { rows: [number, number]; basis: string; state: string; note: string };
  wall?: { colour: PhotoColour | null; selectedPatchId?: string; patches: Array<{ id: string; box: number[]; colour: PhotoColour }>;
    material: { value: string | null; basis: string; state?: string };
    texture: { horizontalRepeats: Array<{ patchId: string; spacingM: number; lagPx: number; correlation: number }>; note: string } };
  coverage?: { imageRowsFraction: number; rawOpeningCount: number; proposedOpeningCount: number; unknownOpeningCount: number };
}
export interface PhotoOpening {
  id: string; kind: 'window' | 'door'; box: [number, number, number, number];
  state: 'proposed' | 'needs-review' | 'corrected' | 'rejected';
  reasons: string[]; maskPixels?: number; maskFill?: number; confidence?: number | null;
  appearance?: PhotoWindowAppearance | null;
  basis?: 'observed' | 'inferred' | 'authored' | 'unknown';
  fit?: { applied: boolean; rawBox: number[]; candidateBox: number[] };
}
export interface PhotoRecord {
  id: string; sourceSha256: string; maskSha256?: string;
  source: { address: string; pandId: string; panoramaId: string; capturedAt: string };
  width: number; height: number; registration: string;
  status: 'proposed' | 'rejected' | 'needs-review'; reason?: string;
  frame?: { metresPerPixelX: number; metresPerPixelY: number; leftM: number; topM: number; wallWidthM: number; note: string };
  openings: PhotoOpening[];
  /** Explicit image-space review crop; never interpreted as a measured roof/ground. */
  visibleRows?: [number, number];
  wallColour?: PhotoColour | null;
  appearance?: PhotoAppearance;
}

export interface PhotoRenderOptions {
  details?: boolean;
  wallFinish?: 'auto' | 'flat' | 'procedural-brick' | 'ambientcg-Bricks057';
}

/** A stand-alone elevation study: never invent BAG placement from an image label.
 * The local floor is the bottom of the crop, NOT the ground in Amsterdam.
 * Keeps camera/identity acceptance independent of feature editing.
 */
export async function photoToRecipe(record: PhotoRecord, extractionHash: string, options: PhotoRenderOptions = {}) {
  if (record.status !== 'proposed' || !record.frame) throw new Error(record.reason || 'This observation has no render proposal');
  if (!/^[a-f0-9]{64}$/.test(record.sourceSha256) || !/^[a-f0-9]{64}$/.test(extractionHash)) throw new Error('Missing source or extraction hash');
  const { width, height, frame } = record;
  if (![width, height, frame.metresPerPixelX, frame.metresPerPixelY, frame.wallWidthM].every(v => Number.isFinite(v) && v > 0)
      || !Number.isFinite(frame.leftM)) throw new Error('Invalid photo frame');
  const [topRow, bottomRow] = record.visibleRows ?? [0, height];
  if (![topRow, bottomRow].every(Number.isFinite) || topRow < 0 || bottomRow > height || bottomRow <= topRow)
    throw new Error('Invalid visible wall rows');
  const localHeight = (bottomRow - topRow) * frame.metresPerPixelY;
  const buildingId = `fixture:photo-${record.sourceSha256.slice(0, 16)}`;
  const outer = [{ x: 0, y: 0 }, { x: frame.wallWidthM, y: 0 }, { x: frame.wallWidthM, y: 1 }, { x: 0, y: 1 }];
  const wall = buildElevations(outer, { pandId: buildingId }).find(w => w.normal.y < -0.9)!;
  const included: RecipeOpening[] = [], omitted: Array<{ id: string; reason: string }> = [];
  const staleDetails: string[] = [];
  const ids = new Set<string>();
  for (const b of record.openings) {
    if (!b.id || ids.has(b.id)) throw new Error('Duplicate or missing opening ID');
    ids.add(b.id);
    if (!['window', 'door'].includes(b.kind)) throw new Error('Unknown opening kind');
    if (!['proposed', 'needs-review', 'corrected', 'rejected'].includes(b.state)) throw new Error('Unknown opening state');
    const [x0, y0, x1, y1] = b.box;
    if (b.box.length !== 4 || !b.box.every(Number.isFinite) || x0 < 0 || y0 < 0 || x1 > width || y1 > height || x1 <= x0 || y1 <= y0)
      throw new Error(`Invalid pixel box: ${b.id}`);
    if (b.state === 'rejected' || b.state === 'needs-review') {
      omitted.push({ id: b.id, reason: b.reasons.join('; ') || b.state }); continue;
    }
    const leftM = frame.leftM + x0 * frame.metresPerPixelX;
    const widthM = (x1 - x0) * frame.metresPerPixelX;
    const bottomM = (bottomRow - y1) * frame.metresPerPixelY, heightM = (y1 - y0) * frame.metresPerPixelY;
    if (y0 < topRow || y1 > bottomRow) {
      omitted.push({ id: b.id, reason: 'Outside the reviewed visible wall rows' }); continue;
    }
    if (leftM < 0 || leftM + widthM > frame.wallWidthM) {
      omitted.push({ id: b.id, reason: 'Outside the supplied target wall' }); continue;
    }
    if (included.some(o => leftM < o.leftM + o.widthM && leftM + widthM > o.leftM
      && bottomM < o.bottomM + o.heightM && bottomM + heightM > o.bottomM)) {
      omitted.push({ id: b.id, reason: 'Overlaps another proposed opening; split or correct its box' }); continue;
    }
    const opening: RecipeOpening = { id: b.id, kind: b.kind, leftM, bottomM, widthM, heightM };
    const appearance = b.appearance;
    if (options.details !== false && appearance) {
      if (appearance.boundBox.length !== 4 || !appearance.boundBox.every((v, i) => v === b.box[i])) staleDetails.push(b.id);
      else {
        const bars = appearance.bars.filter(bar => bar.state === 'proposed' && bar.fraction > .1 && bar.fraction < .9);
        const vertical = bars.filter(b => b.axis === 'vertical').sort((a,b) => a.fraction-b.fraction);
        const horizontal = bars.filter(b => b.axis === 'horizontal').sort((a,b) => b.fraction-a.fraction);
        opening.appearance = {
          value: { trimColour: appearance.trimColour?.hex ?? '#e5dfd1',
            glassColour: (b.kind === 'door' ? appearance.panelColour?.hex : appearance.glassColour?.hex) ?? (b.kind === 'door' ? '#333d38' : '#31464a'),
            verticalBars: vertical.map(b => b.fraction), horizontalBars: horizontal.map(b => 1-b.fraction), barWidthM: .035,
            barColours: { vertical: vertical.map(b => b.colour?.hex ?? appearance.trimColour?.hex ?? '#e5dfd1'),
              horizontal: horizontal.map(b => b.colour?.hex ?? appearance.trimColour?.hex ?? '#e5dfd1') } },
          basis: appearance.style.basis === 'authored' ? 'authored' : 'inferred', state: 'proposed', evidence: [record.sourceSha256, extractionHash],
          note: b.kind === 'door'
            ? 'Frame/panel camera colours. Door glazing, panel layout, thickness and mechanism are unresolved.'
            : 'Frame/glass camera colours and supported line candidates. Bar thickness and shallow trim are simplifications; mechanism/style not accepted.',
        };
      }
    }
    included.push(opening);
  }
  const revisionHash = await dependencyHash({ record, extractionHash, options });
  const evidence = [record.sourceSha256, extractionHash, revisionHash];
  const note = 'Local diagnostic wall; depth and crop extent are display choices. No georeferenced building asset.';
  const finish = options.wallFinish ?? 'auto';
  const wallMaterial = finish === 'auto'
    ? (record.appearance?.wall?.material.value === 'masonry-candidate' ? 'procedural-brick' : 'flat') : finish;
  const wallColour = record.wallColour?.hex ?? '#888888';
  const registrationReviewed = record.registration === 'reviewed-development';
  const mortar = '#' + [1,3,5].map(i => Math.min(255, parseInt(wallColour.slice(i, i+2),16) + 12).toString(16).padStart(2,'0')).join('');
  const recipe: BuildingRecipe = {
    schemaVersion: 1, buildingId, label: `${record.source.address} · photo proposal`, aliases: [],
    identity: { state: 'proposed', sourceHash: record.sourceSha256,
      note: registrationReviewed
        ? `Development-reviewed panorama registration for BAG ${record.source.pandId}. Building identity and feature correctness remain proposals; not placed in the map.`
        : `Unreviewed source label BAG ${record.source.pandId}. Not placed in the map.` },
    footprint: authoredField([{ outer, holes: [] }], note),
    groundNapM: authoredField(0, 'Display origin only: crop bottom. No NAP ground measurement.'),
    wallTopM: { value: localHeight, basis: 'inferred', state: 'proposed', evidence, note: 'Crop height from provisional metric mapping; NOT actual eaves or ridge.' },
    elevations: [{ elevationId: wall.elevationId, polygonIndex: 0,
      openings: { value: included, basis: record.openings.some(o => included.some(i => i.id===o.id) && (o.basis==='inferred' || o.fit?.applied)) ? 'inferred' : 'observed', state: 'proposed', evidence,
        note: 'Image detection proposals, bounded fitting and explicit pixel edits retain their source record. Fitted coordinates are inferred, not newly observed. Neither registration nor feature accuracy is accepted.' },
      parapet: authoredField([], 'Roof/gable unobserved: no silhouette inferred from crop edge.') }],
    palette: { value: { wall: wallColour, trim: '#e5dfd1', glass: '#31464a', door: '#333d38', roof: '#777777' },
      basis: 'inferred', state: 'proposed', evidence,
      note: record.wallColour?.state === 'needs-review'
        ? 'Wall uses a camera-RGB candidate from a geometric sampling envelope that needs review; other surface colours are display defaults.'
        : 'Wall uses proposed masked camera RGB if available; other surface colours are display defaults, not measured.' },
    detailing: { value: { wallMaterial, windowStyle: 'plain', cornice: 'none', gableTrim: false,
      brickAppearance: { mortarColour: mortar, variation: .025 } }, basis: finish === 'auto' ? 'inferred' : 'authored', state: 'proposed', evidence,
      note: 'Masonry texture candidate maps to a generic running bond. Bond, brick dimensions, mortar colour and variation are display choices, not extracted measurements. Per-opening lines remain proposals.' },
    simplifications: [note, 'Only explicit opening records are rendered; any inferred grid cell remains individually identified.', 'Window trim and glass quads are display conventions.',
      registrationReviewed
        ? 'Metric scale and camera mapping come from a development-reviewed panorama registration; ground and wall-surface interpretation remain proposed.'
        : 'Metric scale is provisional; the supplied strip does not certify its ground, wall or camera.'],
  };
  return { recipe, included: included.map(o => o.id), omitted, staleDetails, revisionHash };
}
