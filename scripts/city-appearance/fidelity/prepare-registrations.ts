/** Build a registration artifact from a frozen source manifest without looking
 * at or changing extraction responses. Usage: tsx ... --input=in.json --out=out.json */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { prepareRegistration, validateGroundContact, type GroundContact, type RegistrationInput } from './registration.js';

const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const inputPath = arg('input'), outputPath = arg('out');
if (!inputPath || !outputPath) throw Error('Usage: --input=<source-manifest.json> --out=<registration-artifact.json>');
const input = JSON.parse(await fs.readFile(inputPath, 'utf8'));
if (![1, 2].includes(input.version) || !Array.isArray(input.cases)) throw Error('Frozen source manifest version 1 or 2 with cases is required');
const evidenceCache = new Map<string, any>();
async function nativeRecord(item: any, source: any) {
  try {
    const crop = path.resolve(path.dirname(inputPath), source.path);
    const manifestPath = path.join(path.dirname(path.dirname(crop)), 'manifest.json');
    let manifest = evidenceCache.get(manifestPath);
    if (!manifest) { manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')); evidenceCache.set(manifestPath, manifest); }
    return manifest.records?.find((record: any) => record.id === (item.sourceObservationId ?? item.id)) ?? null;
  } catch { return null; }
}
function candidateInput(item: any, tier: 'full' | 'ground', source: any, native: any): RegistrationInput {
  const image = native?.images?.[tier];
  const plane = image?.plane, wall = native?.wall;
  const width = source.actualDimensions?.width, height = source.actualDimensions?.height;
  const dx = Number(plane?.end?.x) - Number(plane?.start?.x), dy = Number(plane?.end?.y) - Number(plane?.start?.y);
  const wallDx = Number(wall?.end?.x) - Number(wall?.start?.x), wallDy = Number(wall?.end?.y) - Number(wall?.start?.y);
  const wallLength = Math.hypot(wallDx, wallDy), ux = wallDx / wallLength, uy = wallDy / wallLength;
  // Native rectification planes intentionally include a small physical margin
  // beyond the BAG edge. Measure that margin against the actual wall start,
  // rather than pretending the crop's left pixel is the surface origin.
  const t0 = plane && wallLength ? (plane.start.x - wall.start.x) * ux + (plane.start.y - wall.start.y) * uy : NaN;
  const t1 = plane && wallLength ? (plane.end.x - wall.start.x) * ux + (plane.end.y - wall.start.y) * uy : NaN;
  const atPixel = (t: number) => width * (t - t0) / (t1 - t0);
  const nativeMargins = Number.isFinite(t0) && Number.isFinite(t1) && Number.isFinite(width)
    ? { left: Math.max(0, atPixel(0)), top: 0, right: Math.max(0, width - atPixel(wallLength)), bottom: 0 }
    : { left: 0, top: 0, right: 0, bottom: 0 };
  return { tier, cropSha256: source.cropSha256, actualDimensions: source.actualDimensions, declaredDimensions: source.declaredDimensions,
    cropMarginsPx: source.cropMarginsPx ?? nativeMargins, surfaceIndex: item.surfaceIndices?.length === 1 ? item.surfaceIndices[0] : NaN,
    wallDirection: wallLength ? [ux, uy] : [NaN, NaN],
    plane: plane ? { pixelEdges: [0, 0, width, height], wallAlongM: [t0, t1], napAtTopBottomM: [plane.topZ, plane.baseZ], surfaceBaseNapM: native.groundNAP } : null as any,
    alignment: { wallIdentity: native?.metricEligible === true ? 'verified' : native?.wall ? 'ambiguous' : 'failed',
      boundaryEvidence: native?.metricEligible === true, rooflineEvidence: native?.metricEligible === true && tier === 'full',
      cameraHeightResolved: image?.heightInferred === false && !/unsolved|approximate/i.test(String(image?.datum ?? '')), orientationVerified: false,
      uncertaintyM: Number.isFinite(native?.registrationUncertaintyM) ? native.registrationUncertaintyM : NaN }
  } as RegistrationInput;
}
const cases = await Promise.all(input.cases.map(async (item: any) => {
  const sources: Record<string, unknown> = {};
  for (const tier of ['full', 'ground'] as const) {
    const source = item.sources?.[tier];
    if (!source) continue;
    const native = await nativeRecord(item, source);
    const registration = prepareRegistration(candidateInput(item, tier, source, native));
    sources[tier] = { cropSha256: source.cropSha256, captureDate: source.captureDate, width: source.actualDimensions?.width,
      height: source.actualDimensions?.height, registration };
  }
  const contact = item.groundContact ? validateGroundContact({ ...item.groundContact, registration: (sources.ground as any)?.registration } as GroundContact) : null;
  return { id: item.id, buildingId: item.buildingId, geometryRevision: item.geometryRevision, evidenceKey: item.evidenceKey, frontage: item.frontage,
    surfaceIndices: item.surfaceIndices, sources, groundContact: item.groundContact ? { ...item.groundContact, verdict: contact } : undefined };
}));
const artifact = { version: 1, kind: 'facade-registration-artifact', sourceManifestSha256: crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex'),
  canonicalDatum: 'surface-base', pixelConvention: 'pixel-edge', cases };
await fs.writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({ cases: cases.length, registered: cases.flatMap((item: any) => Object.values(item.sources)).filter((source: any) => source.registration.status === 'registered').length,
  abstentions: cases.flatMap((item: any) => Object.values(item.sources)).filter((source: any) => source.registration.status !== 'registered').length }));
