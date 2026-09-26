/**
 * Builds one read-only comparison between a photographed facade and the actual
 * cached LoD2.2 mesh. It deliberately reports projections, never a fit.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export type Point3 = { x: number; y: number; z: number };
export type SamplingPlane = { start: Point3; end: Point3; baseZ: number; topZ: number };
export type Pose = Point3;

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const finite = (values: number[]) => values.every(Number.isFinite);

/** Project a world point along its camera ray onto the vertical plane used to
 * sample the stored crop. This retains parallax when native mesh and crop plane
 * are offset; it is not an image registration solver. */
export function projectToSamplingPlane(point: Point3, pose: Pose, plane: SamplingPlane, dimensions: { width: number; height: number }) {
  const dx = plane.end.x - plane.start.x, dy = plane.end.y - plane.start.y;
  const length = Math.hypot(dx, dy);
  if (!length || !finite([point.x, point.y, point.z, pose.x, pose.y, pose.z, plane.baseZ, plane.topZ, dimensions.width, dimensions.height])) throw Error('Invalid projection input');
  const ux = dx / length, uy = dy / length, nx = -uy, ny = ux;
  const rx = point.x - pose.x, ry = point.y - pose.y, rz = point.z - pose.z;
  const denominator = rx * nx + ry * ny;
  if (Math.abs(denominator) < 1e-10) return null;
  const lambda = ((plane.start.x - pose.x) * nx + (plane.start.y - pose.y) * ny) / denominator;
  if (!(lambda > 0)) return null;
  const hit = { x: pose.x + lambda * rx, y: pose.y + lambda * ry, z: pose.z + lambda * rz };
  const alongM = (hit.x - plane.start.x) * ux + (hit.y - plane.start.y) * uy;
  const verticalM = plane.topZ - plane.baseZ;
  if (!(verticalM > 0)) throw Error('Invalid sampling-plane height');
  return { x: alongM / length * dimensions.width, y: (plane.topZ - hit.z) / verticalM * dimensions.height, hit, alongM, lambda };
}

const localToWorld = (point: number[], origin: any, napOffset: number): Point3 => ({ x: origin.x + point[0], y: origin.y - point[2], z: point[1] + napOffset });
const ring = (points: number[][], origin: any, napOffset: number, pose: Pose, plane: SamplingPlane, dimensions: any) => points.map(point => ({ world: localToWorld(point, origin, napOffset), projection: projectToSamplingPlane(localToWorld(point, origin, napOffset), pose, plane, dimensions) }));

function page(data: any) {
  const safe = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<!doctype html><meta charset="utf-8"><title>Case 24 · metric mesh vs source</title><style>body{margin:0;background:#f3f1e9;color:#263b2f;font:16px system-ui,sans-serif}main{max-width:1080px;margin:auto;padding:24px}h1{margin:0 0 8px}.warning{background:#fff1cf;border-left:5px solid #b67926;padding:12px;margin:14px 0}.grid{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:18px}.photo{position:relative;max-width:640px;background:#ddd}.photo img{display:block;width:100%;height:auto}.photo svg{position:absolute;inset:0;width:100%;height:100%;overflow:hidden}path{fill:none;stroke-linejoin:round;stroke-linecap:round}.mesh{stroke:#00a9e8;stroke-width:2.5}.roof{stroke:#d48900;stroke-width:2.5}.observed{stroke:#dc3f74;stroke-width:2.5;stroke-dasharray:5 3}code{font-size:.85em;overflow-wrap:anywhere}dl{margin:0}dt{font-weight:700;margin-top:10px}dd{margin:2px 0}a{color:#075d79}</style><main><h1>Case 24: actual LoD2.2 mesh vs dated source</h1><p>Da Costakade 113 · building <code>0363100012155539</code></p><div class="warning">Camera datum and crop-plane registration are unverified. Blue and amber are projections of real cached LoD2.2 vertices; magenta is an approximate source-pixel gable outline. This page reports no fit, residual, acceptance, or runtime change.</div><div class="grid"><section><div class="photo"><img id="photo" alt="Dated full facade source"><svg id="overlay" aria-label="Geometry comparison"></svg></div><p><a id="source" target="_blank">Open original municipal panorama</a> · <a id="crop" target="_blank">Open stored source crop</a></p></section><aside><dl id="facts"></dl><p><b>Reading this page:</b> if magenta remains outside the blue/amber mesh outline, the discrepancy is evidence to investigate; it is not a measured correction.</p></aside></div><h2>Topology and evidence</h2><pre id="json"></pre></main><script>const d=${safe};const p=d.source;document.querySelector('#photo').src=p.publicCropUrl;document.querySelector('#source').href=p.originalPanoramaUrl;document.querySelector('#crop').href=p.publicCropUrl;const svg=document.querySelector('#overlay');svg.setAttribute('viewBox','0 0 '+p.dimensions.width+' '+p.dimensions.height);const draw=(points,klass,closed=true)=>{const valid=points.filter(x=>x&&Number.isFinite(x.x)&&Number.isFinite(x.y));if(valid.length<2)return;const q=document.createElementNS('http://www.w3.org/2000/svg','path');q.setAttribute('class',klass);q.setAttribute('d','M '+valid.map(x=>x.x+','+x.y).join(' L ')+(closed?' Z':''));svg.append(q)};draw(d.metric.wall.projections,'mesh');d.metric.roofs.forEach(x=>draw(x.projections,'roof'));draw(d.observedGableOutlinePx,'observed',false);const facts=[['Photo',p.captureDate],['Panorama',p.panoramaId],['Mesh',d.metric.source],['Wall surface',d.metric.wall.surfaceIndex+' · '+d.metric.wall.vertexCount+' vertices'],['Roof surfaces',d.metric.roofs.map(x=>x.surfaceIndex).join(', ')],['Registration',d.registration.status],['Camera datum',p.datum],['Observed outline',d.observedGableOutlinePx.length+' approximate source-pixel points']];document.querySelector('#facts').innerHTML=facts.map(x=>'<dt>'+x[0]+'</dt><dd>'+x[1]+'</dd>').join('');document.querySelector('#json').textContent=JSON.stringify({source:d.source,metric:d.metric,registration:d.registration,projectionPolicy:d.projectionPolicy},null,2);</script>`;
}

export async function buildBuildingSourceComparison(root = '.') {
  const readBoundJson = async (file: string) => { const bytes = await fs.readFile(path.join(root, file)); return { value: JSON.parse(bytes.toString()), sha256: sha256(bytes) }; };
  const casesPath = 'public/data/facade-repair-preview/cases.json', correctionPath = 'scripts/review/source-geometry-corrections.json';
  const nativePath = '.cache/city-appearance/areas/da-costabuurt-v1/panorama-audit/b4fc23112b0593e31eb3d4ae7226adb95639120d92a75965b4f841fd274a32fd/evidence/manifest.json';
  const casesFile = await readBoundJson(casesPath), correctionFile = await readBoundJson(correctionPath), nativeFile = await readBoundJson(nativePath);
  const cases = casesFile.value, correction = correctionFile.value, native = nativeFile.value;
  const item = cases.cases.find((entry: any) => entry.caseId === 'case-24');
  const correctionCase = correction.cases.find((entry: any) => entry.caseId === 'case-24' && entry.tier === 'full');
  const nativeRecord = native.records.find((entry: any) => entry.id === '0363100012155539_e_19ytu7e');
  if (!item || !correctionCase || !nativeRecord) throw Error('Case 24 source binding unavailable');
  const owner = item.owner, building = owner.geometry.building, image = nativeRecord.images.full, previewImage = item.source?.full;
  if (owner.id !== nativeRecord.buildingId || building.id !== owner.id || previewImage?.sha256 !== image.sha256 || previewImage?.captureDate !== image.date || previewImage?.width !== image.width || previewImage?.height !== image.height) throw Error('Case preview and native full source do not bind the same owner/image');
  const cropPath = path.join(root, 'public/data/city-expansion/evidence', `${image.sha256}.jpg`);
  const rawPath = path.join(root, '.cache/city-appearance/shared-panoramas', `${image.panoramaId}.jpg`);
  if (sha256(await fs.readFile(cropPath)) !== image.sha256) throw Error('Stored crop hash mismatch');
  if (sha256(await fs.readFile(rawPath)) !== image.panoramaSha256) throw Error('Cached panorama hash mismatch');
  if (correctionCase.source.sha256 !== image.sha256 || correctionCase.source.captureDate !== image.date || correctionCase.source.width !== image.width || correctionCase.source.height !== image.height) throw Error('Observed outline is not bound to this crop');
  const plane: SamplingPlane = image.plane, pose: Pose = image.pose, dimensions = { width: image.width, height: image.height }, offset = .65;
  const wallIndex = nativeRecord.wall.index, wall = building.surfaces[wallIndex];
  if (!wall || wall.type !== 'wall') throw Error('Native selected wall is unavailable');
  const roofs = building.surfaces.map((surface: any, index: number) => ({ surface, index })).filter((entry: any) => entry.surface.type === 'roof');
  const data: any = { version: 1, kind: 'read-only-building-source-comparison', generatedAt: new Date().toISOString(), inputs: { casesJson: { path: casesPath, sha256: casesFile.sha256 }, nativeManifest: { path: nativePath, sha256: nativeFile.sha256 }, correctionFile: { path: correctionPath, sha256: correctionFile.sha256 } }, source: { caseId: item.caseId, buildingId: owner.id, cropSha256: image.sha256, panoramaSha256: image.panoramaSha256, captureDate: image.date, panoramaId: image.panoramaId, dimensions, originalPanoramaUrl: image.url, publicCropUrl: `/data/city-expansion/evidence/${image.sha256}.jpg`, cachedManifest: nativePath, datum: image.datum, cameraModel: native.camera, pose, samplingPlane: plane, localToNAPOffsetM: offset }, metric: { source: '3DBAG LoD2.2 cached owner geometry', geometryRevision: owner.geometryRevision, frame: owner.geometry.frame, wall: { surfaceIndex: wallIndex, vertexCount: wall.rings[0].length, localVertices: wall.rings[0], projections: ring(wall.rings[0], owner.geometry.frame.originRD, offset, pose, plane, dimensions).map(x => x.projection) }, roofs: roofs.map(({ surface, index }: any) => ({ surfaceIndex: index, vertexCount: surface.rings[0].length, localVertices: surface.rings[0], projections: ring(surface.rings[0], owner.geometry.frame.originRD, offset, pose, plane, dimensions).map(x => x.projection) })) }, observedGableOutlinePx: correctionCase.silhouetteTopPx.map(([x, y]: number[]) => ({ x, y })), observedOutline: { basis: 'agent-inspected source-pixel outline', approximate: true, correctionFile: correctionPath, note: correctionCase.reason }, registration: { status: 'unverified', accepted: false, residuals: [], missing: ['independent pixel boundary correspondences', 'independent roofline correspondences', 'resolved camera height / vertical datum', 'measured uncertainty at or below 0.15 m'] }, projectionPolicy: 'Camera-ray intersection with the stored vertical sampling plane. Off-plane vertices retain parallax. Projection is diagnostic only.' };
  const json = JSON.stringify(data, null, 2) + '\n', html = page(data);
  const jsonPath = path.join(root, 'review-data/building-source-comparison/case-24.json');
  const htmlPath = path.join(root, 'public/canal-drive/case24-building-source-comparison.html');
  await fs.mkdir(path.dirname(jsonPath), { recursive: true });
  await fs.writeFile(jsonPath, json); await fs.writeFile(htmlPath, html);
  return { jsonPath, htmlPath, wallVertices: wall.rings[0].length, roofSurfaces: roofs.length, accepted: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) buildBuildingSourceComparison().then(value => console.log(JSON.stringify(value))).catch(error => { console.error(error); process.exitCode = 1; });
