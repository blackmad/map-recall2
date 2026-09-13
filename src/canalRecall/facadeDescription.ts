/** Source annotations are independent of fitted geometry and human review.
 * Bounds use image pixels; homographies map those pixels to the wall axis in
 * metres and the canonical surface height datum. No image-ratio projection.
 */
export type Bounds = [number, number, number, number];
export type Disposition = 'machine-observed-unreviewed' | 'agent-inspected' | 'human-reviewed' | 'revoked' | 'unknown';
export interface FacadeFeature {
  id: string; bounds: Bounds; disposition: Disposition;
  kind: 'door' | 'window' | 'material' | 'awning' | 'fascia';
  head?: 'rectangular' | 'segmental' | 'rounded' | 'unknown';
  lintelHead?: 'segmental' | 'rounded';
  /** Independent masonry-lintel rise. It never changes the glazing head. */
  lintelRise?: number;
  row?: number; bay?: number; paired?: boolean;
  /** Rise as a fraction of this opening's height. It describes glazing only
   * when `head` is curved; a separate masonry lintel uses `lintelHead`. */
  archRise?: number;
  /** Radius fraction of min(width,height), for a rectangular head with only
   * its top corners rounded. This is not a segmental glazing arch. */
  topCornerRadius?: number;
  transom?: number; mullions?: number[]; thresholdHeightM?: number;
  /** Optional door grammar; omitted style uses restrained panelled joinery. */
  doorStyle?: 'panelled' | 'glazed' | 'plain';
  doorFurniture?: 'knob' | 'pull' | 'none';
  colour?: string; frameColour?: string; surroundColour?: string;
  material?: 'brick' | 'stone' | 'plaster' | 'paint' | 'unknown';
  region?: 'upper-wall' | 'ground-floor' | 'plinth' | 'surround' | 'band' | 'accent';
  awningProfile?: 'sloped' | 'curved';
  stripeColour?: string; stripeCount?: number; valance?: 'straight'|'scalloped';
  installation?: 'folding' | 'roller' | 'fixed' | 'unknown';
  state?: 'extended' | 'retracted' | 'absent' | 'unknown';
  text?: string; physicalSignId?: string; textColour?: string; signFont?: string;
  /** Fascia normally mounts on the wall; a reviewed shop-window sign sits in
   * front of glazing so it does not disappear behind the pane. */
  signMount?: 'wall' | 'glazing';
}
export interface FacadeDescription {
  version: 1; extractionVersion: string; buildingId: string; geometryRevision: string;
  evidenceKey: string; frontage: [number[], number[]]; surfaceIndices: number[];
  sources: Partial<Record<'full' | 'ground', {
    cropSha256: string; captureDate: string; imageDimensions: { width: number; height: number };
    registration: { status: 'registered' | 'ambiguous' | 'failed'; uncertaintyM: number; imageToWall: number[]; surfaceIndex: number;
      sourceDatum?: 'NAP'; canonicalDatum?: 'surface-base'; pixelConvention?: 'pixel-edge'; wallDirection?: [number, number];
      /** Candidate native-plane transform used only by an explicit local
       * inspection preview. It is never a registered transform. */
      preview?: { kind: 'native-crop-plane'; cropSha256: string; imageDimensions: { width: number; height: number }; imageToWall: number[]; note: string };
      alignment?: { wallIdentity: 'verified'; boundaryEvidence: true; rooflineEvidence: true; cameraHeightResolved: true; orientationVerified: true } };
    openingsComplete?: boolean; features: FacadeFeature[];
  }>>;
}
export interface FittedFacadeFeature extends FacadeFeature { t: number; y: number; width: number; height: number; uncertaintyM: number }
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function boundFacadeSource(record: any, owner: {id:string;geometryRevision:string}, surfaceIndex: number, kind: 'full'|'ground') {
  const d: FacadeDescription | undefined = record.facadeDescription;
  if (!d || d.version !== 1 || !d.extractionVersion || d.buildingId !== owner.id || d.geometryRevision !== owner.geometryRevision
    || d.evidenceKey !== record.evidenceKey || !d.surfaceIndices?.includes(surfaceIndex)
    || !equal(d.frontage, [record.localStart,record.localEnd]) || record.machineRevocation?.revoked
    || ['rejected','uncertain','crop-repair'].includes(record.review?.placement)) return null;
  const source = d.sources?.[kind], image = record.images?.[kind];
  if (!source || !/^[a-f0-9]{64}$/i.test(source.cropSha256) || source.cropSha256 !== image?.sha256
    || !source.captureDate || source.captureDate !== (image.date ?? image.capturedAt)) return null;
  if (!Number.isInteger(source.imageDimensions?.width) || !Number.isInteger(source.imageDimensions?.height)
    || source.imageDimensions.width <= 0 || source.imageDimensions.height <= 0
    || source.imageDimensions.width !== image?.width || source.imageDimensions.height !== image?.height) return null;
  if (!Array.isArray(source.features) || source.features.length > 256 || new Set(source.features.map(f=>f.id)).size !== source.features.length) return null;
  const ids=Object.values(d.sources).flatMap(s=>Array.isArray(s?.features)?s.features.map(f=>f.id):[]);
  if(new Set(ids).size!==ids.length)return null;
  const r = source.registration;
  if (!r || r.status !== 'registered' || r.surfaceIndex !== surfaceIndex || !Number.isFinite(r.uncertaintyM)
    || r.uncertaintyM < 0 || r.uncertaintyM > .15 || r.imageToWall?.length !== 9 || !r.imageToWall.every(Number.isFinite)) return null;
  if (r.sourceDatum && r.sourceDatum !== 'NAP' || r.canonicalDatum && r.canonicalDatum !== 'surface-base' || r.pixelConvention && r.pixelConvention !== 'pixel-edge'
    || r.wallDirection && (!Array.isArray(r.wallDirection) || r.wallDirection.length !== 2 || !r.wallDirection.every(Number.isFinite) || Math.abs(Math.hypot(...r.wallDirection) - 1) > .001)) return null;
  if (!r.alignment || r.alignment.wallIdentity !== 'verified' || r.alignment.boundaryEvidence !== true
    || r.alignment.rooflineEvidence !== true || r.alignment.cameraHeightResolved !== true || r.alignment.orientationVerified !== true) return null;
  return source;
}
/** Candidate transforms are intentionally isolated from `boundFacadeSource`.
 * This helper is for a locally requested inspection preview only; callers must
 * opt in at the compiler boundary and its result can never satisfy a gate. */
export function previewFacadeSource(record: any, owner: {id:string;geometryRevision:string}, surfaceIndex:number, kind:'full'|'ground') {
  const d: FacadeDescription | undefined = record.facadeDescription;
  if (!d || d.version !== 1 || !d.extractionVersion || d.buildingId !== owner.id || d.geometryRevision !== owner.geometryRevision
    || d.evidenceKey !== record.evidenceKey || !d.surfaceIndices?.includes(surfaceIndex)
    || !equal(d.frontage, [record.localStart,record.localEnd]) || record.machineRevocation?.revoked
    || ['rejected','uncertain','crop-repair'].includes(record.review?.placement)) return null;
  const source=d.sources?.[kind],image=record.images?.[kind],r=source?.registration,preview=r?.preview;
  if (!source || !image || !/^[a-f0-9]{64}$/i.test(source.cropSha256) || source.cropSha256!==image.sha256 || source.captureDate!==(image.date??image.capturedAt)
    || !Number.isInteger(source.imageDimensions?.width) || !Number.isInteger(source.imageDimensions?.height) || source.imageDimensions.width<=0 || source.imageDimensions.height<=0
    || source.imageDimensions.width!==image.width || source.imageDimensions.height!==image.height
    || !Array.isArray(source.features) || source.features.length>256 || new Set(source.features.map(feature=>feature.id)).size!==source.features.length || r?.status!=='ambiguous' || r.surfaceIndex!==surfaceIndex
    || r.sourceDatum!=='NAP' || r.canonicalDatum!=='surface-base' || r.pixelConvention!=='pixel-edge'
    || !preview || preview.kind!=='native-crop-plane' || preview.cropSha256!==source.cropSha256
    || preview.imageDimensions?.width!==source.imageDimensions.width || preview.imageDimensions?.height!==source.imageDimensions.height
    || !Array.isArray(preview.imageToWall) || preview.imageToWall.length!==9 || !preview.imageToWall.every(Number.isFinite) || !preview.note?.trim()) return null;
  // Use a conservative fitting residual only; this value is not a certificate.
  return {...source,registration:{...r,imageToWall:preview.imageToWall,uncertaintyM:.15}};
}
export function fitFacadeFeature(feature: FacadeFeature, source: NonNullable<ReturnType<typeof boundFacadeSource>>, record: any): FittedFacadeFeature | null {
  const override = record.review?.facadeFeatures?.[feature.id];
  if (feature.disposition === 'revoked' || override?.disposition === 'revoked' || record.featureRevocations?.[feature.id]
    || (record.visualReview?.fieldEligibility?.[feature.id] === false && override?.disposition !== 'human-reviewed')) return null;
  const f: FacadeFeature = override?.disposition === 'human-reviewed' ? {...feature,...override} : feature;
  if (!['machine-observed-unreviewed','agent-inspected','human-reviewed'].includes(f.disposition)) return null;
  if(f.signMount!==undefined&&(!['wall','glazing'].includes(f.signMount)||f.kind!=='fascia'))return null;
  if(f.doorStyle!==undefined&&(!['panelled','glazed','plain'].includes(f.doorStyle)||f.kind!=='door')||f.doorFurniture!==undefined&&(!['knob','pull','none'].includes(f.doorFurniture)||f.kind!=='door'))return null;
  if (!f.id || !Array.isArray(f.bounds) || f.bounds.length !== 4 || !f.bounds.every(Number.isFinite)) return null;
  if (f.archRise !== undefined && (!Number.isFinite(f.archRise) || f.archRise <= 0 || f.archRise > .5 || !['rounded','segmental'].includes(f.head ?? ''))) return null;
  if (f.lintelRise !== undefined && (!Number.isFinite(f.lintelRise) || f.lintelRise <= 0 || f.lintelRise > .5 || !['rounded','segmental'].includes(f.lintelHead ?? ''))) return null;
  if (f.topCornerRadius !== undefined && (!Number.isFinite(f.topCornerRadius) || f.topCornerRadius <= 0 || f.topCornerRadius > .25 || f.head !== 'rectangular')) return null;
  const [x0,y0,x1,y1] = f.bounds;
  if (x0 < 0 || y0 < 0 || x1 <= x0 || y1 <= y0) return null;
  const image=Object.values(record.images??{}).find((im:any)=>im.sha256===source.cropSha256) as any;
  if (x1 > source.imageDimensions.width || y1 > source.imageDimensions.height) return null;
  const h = source.registration.imageToWall;
  const pixels = [[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  const denominators = pixels.map(([x,y])=>h[6]*x+h[7]*y+h[8]);
  if (denominators.some(v=>Math.abs(v)<1e-8) || denominators.some(v=>Math.sign(v)!==Math.sign(denominators[0]))) return null;
  const p = pixels.map(([x,y],i)=>[(h[0]*x+h[1]*y+h[2])/denominators[i],(h[3]*x+h[4]*y+h[5])/denominators[i]]);
  // An image-aligned box is not necessarily a wall-aligned rectangle. Abstain
  // when the residual exceeds the declared registration tolerance.
  const tolerance = Math.max(.03,source.registration.uncertaintyM);
  if (Math.max(Math.abs(p[0][1]-p[1][1]),Math.abs(p[2][1]-p[3][1]),Math.abs(p[0][0]-p[3][0]),Math.abs(p[1][0]-p[2][0])) > tolerance) return null;
  const xs=p.map(v=>v[0]),ys=p.map(v=>v[1]),width=Math.max(...xs)-Math.min(...xs),height=Math.max(...ys)-Math.min(...ys);
  if (![width,height,...xs,...ys].every(Number.isFinite) || width <= .02 || height <= .02) return null;
  // Bounds are authored left-to-right in source pixels. A signed wall axis may
  // run the other way, so retain the physical mullion order after normalising
  // fitted bounds. Vertical transforms do not change a transom fraction.
  const mullions=p[0][0]>p[1][0]&&Array.isArray(f.mullions)?f.mullions.map(value=>1-value).sort((a,b)=>a-b):f.mullions;
  return {...f,...(mullions?{mullions}:{}),t:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2,width,height,uncertaintyM:source.registration.uncertaintyM};
}
