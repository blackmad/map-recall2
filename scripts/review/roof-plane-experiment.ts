/** Case 20 source-space roof hypothesis. Depths are display assumptions, not
 * measured metres or a recovered panorama camera. Nothing here edits 3DBAG. */
export type RoofPoint = [number, number, number];
export type RoofSurface = { name: string; role: 'main-roof' | 'dormer-front' | 'dormer-side' | 'dormer-cap' | 'dormer-opening'; colour: string; vertices: RoofPoint[]; faces: number[] };
export type RoofExperiment = { mode: 'source-space-provisional-roof-planes'; sourceSha256: string; captureDate: string; sourceAligned: true; wallTopY: number; wallRing: RoofPoint[]; surfaces: RoofSurface[]; assumptions: string[] };

const CASE20_SOURCE = 'c85f193a00e009915f48bc506ec9c589cdaefdaa3351e3a0cc5a5c5f72b672c0';
const CASE20_DATE = '2023-01-12T09:15:50.506690Z';
const OUTLINE = [[0,184],[68,184],[73,138],[126,99],[169,133],[153,184],[263,184],[263,811],[0,811]];
const WIDTH = 283, HEIGHT = 811, SCALE = .01;
const at = (x: number, y: number, depth: number): RoofPoint => [WIDTH*SCALE-x*SCALE, HEIGHT*SCALE-y*SCALE, depth];
const finite = (p: RoofPoint) => p.every(Number.isFinite);
const surface = (name: string, role: RoofSurface['role'], colour: string, vertices: RoofPoint[], faces: number[]): RoofSurface => ({name,role,colour,vertices,faces});

/** Requires the exact dated crop and preserved reviewed silhouette. A different
 * crop must be inspected before this trial can be applied to it. */
export function buildCase20RoofPlaneExperiment(source: {sha256: string; captureDate: string; width: number; height: number}, silhouette?: {polygonPx?: number[][]}): RoofExperiment {
  if (source.sha256 !== CASE20_SOURCE || source.captureDate !== CASE20_DATE || source.width !== WIDTH || source.height !== HEIGHT || JSON.stringify(silhouette?.polygonPx) !== JSON.stringify(OUTLINE)) {
    throw new Error('Case 20 roof experiment requires its reviewed source crop and silhouette');
  }
  const wallTopY = at(0,184,0)[1];
  const wallRing: RoofPoint[] = [at(0,184,0),at(263,184,0),at(263,811,0),at(0,811,0)];
  // Positive depth is behind the source wall. The original preview camera
  // views along +depth; the dormer front therefore projects before the roof.
  const roof = surface('main-roof','main-roof','#414940',[
    at(0,184,.015),at(263,184,.015),at(263,148,.52),at(0,148,.52)
  ],[0,1,2,0,2,3]);
  // Projected source apex x=126 is deliberately made central. This is an
  // architectural hypothesis to review, not an asserted image landmark.
  const front = surface('dormer-front','dormer-front','#c6c5b8',[
    at(73,184,-.25),at(161,184,-.25),at(161,139,-.25),at(117,100,-.25),at(73,139,-.25)
  ],[0,1,2,0,2,3,0,3,4]);
  const left = surface('dormer-left','dormer-side','#a9a99f',[
    at(73,184,-.25),at(73,139,-.25),at(73,139,.28),at(73,158,.28)
  ],[0,1,2,0,2,3]);
  const right = surface('dormer-right','dormer-side','#94978c',[
    at(161,184,-.25),at(161,139,-.25),at(161,139,.28),at(161,158,.28)
  ],[0,1,2,0,2,3]);
  const capL = surface('dormer-cap-left','dormer-cap','#444c43',[
    at(73,139,-.27),at(117,100,-.27),at(117,100,.30),at(73,139,.30)
  ],[0,1,2,0,2,3]);
  const capR = surface('dormer-cap-right','dormer-cap','#353d37',[
    at(117,100,-.27),at(161,139,-.27),at(161,139,.30),at(117,100,.30)
  ],[0,1,2,0,2,3]);
  const opening = surface('dormer-opening','dormer-opening','#6d7775',[
    at(94,183,-.254),at(143,183,-.254),at(143,148,-.254),at(94,148,-.254)
  ],[0,1,2,0,2,3]);
  const surfaces = [roof,left,right,front,capL,capR,opening];
  if (surfaces.some(s => s.vertices.some(p => !finite(p)) || s.faces.some(i => i < 0 || i >= s.vertices.length))) throw new Error('Invalid provisional roof surface');
  return {mode:'source-space-provisional-roof-planes',sourceSha256:source.sha256,captureDate:source.captureDate,sourceAligned:true,wallTopY,wallRing,surfaces,assumptions:[
    'Depth and roof pitch are display hypotheses in a synthetic source-space frame.',
    'Main roof upper extent follows the reviewed visible fill at source row 148; any roof beyond it remains unknown.',
    'Gable apex is centred over the dormer front to test a straight architectural profile.',
    'The comparison uses source crop coordinates, not a solved panorama camera or metric placement.'
  ]};
}

/** Keep all non-roof evidence, including the lower doors and windows. Clip
 * broad material triangles to the eave so their original flat roof fill cannot
 * appear behind the separate roof surfaces. */
export function makeCase20RoofStudyView<T extends {owner: any; patches: {featureId:string; triangles:number[]}[]}>(study: T, experiment: RoofExperiment): T {
  const copy = structuredClone(study);
  const wall = copy.owner?.geometry?.building?.surfaces?.[0];
  if (!wall || !Array.isArray(wall.rings)) throw new Error('Missing source-space wall');
  wall.rings = [experiment.wallRing];
  copy.patches = copy.patches.filter(p => !p.featureId.endsWith('full:review:dormer') && !p.featureId.endsWith('full:review:roof-slate')).map(p => {
    if (!p.featureId.endsWith('full:material-1')) return p;
    const triangles: number[] = [];
    for (let i=0;i<p.triangles.length;i+=9) {
      const tri: RoofPoint[] = [[p.triangles[i],p.triangles[i+1],p.triangles[i+2]],[p.triangles[i+3],p.triangles[i+4],p.triangles[i+5]],[p.triangles[i+6],p.triangles[i+7],p.triangles[i+8]]];
      const polygon: RoofPoint[] = [];
      for (let j=0;j<3;j++) {
        const a=tri[j],b=tri[(j+1)%3],insideA=a[1]<=experiment.wallTopY+1e-9,insideB=b[1]<=experiment.wallTopY+1e-9;
        if (insideA) polygon.push(a);
        if (insideA!==insideB) {const t=(experiment.wallTopY-a[1])/(b[1]-a[1]);polygon.push([a[0]+t*(b[0]-a[0]),experiment.wallTopY,a[2]+t*(b[2]-a[2])]);}
      }
      for(let j=1;j+1<polygon.length;j++)triangles.push(...polygon[0],...polygon[j],...polygon[j+1]);
    }
    return {...p,triangles};
  });
  return copy;
}
