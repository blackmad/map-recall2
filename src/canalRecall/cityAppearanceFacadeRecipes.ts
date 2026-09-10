/** Conservative, explicitly synthetic facade rhythm. These recipes never write
 * extracted opening counts, roof shapes, commercial identities or review labels.
 * Evidence selects a physical interval and ground-floor class; geometry supplies
 * a restrained display prior within that interval, including source holes.
 */
// @ts-expect-error Shared browser JS module has no separate declaration file.
import { wallAxis, wallObservationIntervals, intervalFaceFrame } from '../../public/canal-drive/da-costa-block/wall-intervals.js';
// @ts-expect-error Shared browser JS module has no separate declaration file.
import { rectangleFitsFace } from '../../public/canal-drive/da-costa-block/face-containment.js';
// @ts-expect-error Shared browser JS module has no separate declaration file.
import { mayRenderReviewedAwning } from '../../public/canal-drive/da-costa-block/awning-evidence.js';
import type { BlockAppearanceGeometry } from './cityAppearanceThree.js';
import type { AppearanceTile } from './cityAppearanceTiles.js';

type Owner = AppearanceTile<BlockAppearanceGeometry, any>['owners'][number];
type Surface = BlockAppearanceGeometry['building']['surfaces'][number];
type Frame = { a: number[]; u: number[]; n: number[]; width: number; bottom: number; top: number; polygon: number[][]; holes: number[][][]; intervalBounded?: boolean };
export type FacadeRecipePatch = {
  triangles: number[];
  colour: 'windowGlass' | 'windowGlassBlue' | 'windowGlassWarm' | 'windowFrame' | 'windowFrameDark' | 'doorWood' | 'shopGlass' | 'awningFabric' | 'facadeTrimLight' | 'facadeTrimDark';
  observationId: string | null;
  featureId: string;
  featureKind: 'window-prior' | 'contextual-window-prior' | 'contextual-door-prior' | 'contextual-trim-prior' | 'shopfront-prior' | 'reviewed-awning-prior';
  styleSource: 'procedural-prior-not-measured';
};
export const FACADE_PATCH_COLOURS:Record<FacadeRecipePatch['colour'],string>={windowGlass:'#526a6b',windowGlassBlue:'#4b6268',windowGlassWarm:'#62685d',windowFrame:'#ddd8c7',windowFrameDark:'#676963',doorWood:'#3f342d',shopGlass:'#354a4b',awningFabric:'#807765',facadeTrimLight:'#b9ad96',facadeTrimDark:'#61584e'};

function inside(point: number[], ring: number[][]): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}
function insideBuilding(point: number[], geometry: BlockAppearanceGeometry['building']['footprint']): boolean {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(polygon => inside(point, polygon[0]) && !polygon.slice(1).some(hole => inside(point, hole)));
}
function neighbourAt(point: number[], owner: Owner, neighbours: Owner[]): boolean {
  const origin = owner.geometry.frame.originRD;
  return neighbours.some(other => {
    if (other.id === owner.id) return false;
    const otherOrigin = other.geometry.frame.originRD;
    return insideBuilding([point[0] + origin.x - otherOrigin.x, point[1] + otherOrigin.y - origin.y], other.geometry.building.footprint);
  });
}
function rectangleClear(frame: Frame, t: number, width: number, owner: Owner, neighbours: Owner[]): boolean {
  return [-.5, 0, .5].every(fraction => {
    const along = t + width * fraction;
    return !neighbourAt([frame.a[0] + frame.u[0] * along + frame.n[0] * .08, frame.a[1] + frame.u[1] * along + frame.n[1] * .08], owner, neighbours);
  });
}

function frameFor(surface: Surface, owner: Owner, neighbours: Owner[]): Frame | null {
  const axis = wallAxis(surface);
  if (!axis || axis.length < 1.5) return null;
  if (surface.rings.flat().some(point => Math.abs((point[0] - axis.origin[0]) * axis.u[1] - (point[2] - axis.origin[1]) * axis.u[0]) > .1)) return null;
  const a = axis.origin, u = axis.u, midpoint = [a[0] + u[0] * axis.length / 2, a[1] + u[1] * axis.length / 2];
  let n = [-u[1], u[0]];
  const offset = (direction: number[], depth: number) => [midpoint[0] + direction[0] * depth, midpoint[1] + direction[1] * depth];
  if (insideBuilding(offset(n, .25), owner.geometry.building.footprint)) n = n.map(value => -value);
  if (insideBuilding(offset(n, .25), owner.geometry.building.footprint)) return null;
  // Context owners may use another local RD origin. Compare in each neighbour's
  // own coordinate frame, never assume a city-wide tile-local origin.
  if (neighbourAt(offset(n, .25), owner, neighbours)) return null;
  const project = (point: number[]) => [(point[0] - a[0]) * u[0] + (point[2] - a[1]) * u[1], point[1]];
  const rings = surface.rings.map(ring => ring.map(project));
  return { a, u, n, width: axis.length, bottom: Math.min(...rings[0].map(point => point[1])), top: Math.max(...rings[0].map(point => point[1])), polygon: rings[0], holes: rings.slice(1) };
}
const contextualPrimaryWall=new WeakMap<object,number>();
function primaryExteriorWall(owner:Owner,neighbours:Owner[]):number{const cached=contextualPrimaryWall.get(owner);if(cached!==undefined)return cached;let primary=-1,width=0;owner.geometry.building.surfaces.forEach((surface,index)=>{if(surface.type!=='wall')return;const frame=frameFor(surface,owner,neighbours);if(frame&&frame.width>width){width=frame.width;primary=index;}});contextualPrimaryWall.set(owner,primary);return primary;}

const usableSource = (record: any, kind: string) => {
  const image = record.images?.[kind];
  return !!image && /^[a-f0-9]{64}$/i.test(image.sha256 ?? '') && /^[a-f0-9]{64}$/i.test(image.panoramaSha256 ?? '');
};
const validPlacement = (record: any) => !['rejected', 'uncertain', 'crop-repair'].includes(record.review?.placement);

/** Envelope/source binding is separate from individual field eligibility. */
export function facadeRecipeRecords(owners: Owner[]): any[] {
  return owners.flatMap(owner => owner.observations.filter(observation => {
    const record = observation.payload;
    return observation.buildingId === owner.id && observation.geometryRevision === owner.geometryRevision
      && observation.evidenceKey && record?.evidenceKey === observation.evidenceKey && record?.derivationKey
      && record.renderBuildingId === owner.id && validPlacement(record);
  }).map(observation => observation.payload));
}

function groundSupported(record: any): boolean {
  if (!usableSource(record, 'ground') || !['yes', 'no'].includes(record.effectiveProposal?.shopfront)) return false;
  const human = record.review?.placement === 'accepted' && record.proposalSources?.shopfront === 'human-review';
  if (human) return true;
  if (record.visualReview?.fieldEligibility?.shopfront === false) return false;
  return record.visualReview?.fieldEligibility?.shopfront === true || record.effectiveProposal?.groundUsable === 'yes';
}
function upperSupported(record: any): boolean {
  return usableSource(record, 'full') && record.effectiveProposal?.wholeUsable === 'yes'
    && record.visualReview?.appearanceEligible !== false;
}
const onFace = (frame: Frame, t: number, y: number, depth: number): number[] => [frame.a[0] + frame.u[0] * t + frame.n[0] * depth, y, frame.a[1] + frame.u[1] * t + frame.n[1] * depth];
function quad(frame: Frame, t: number, y: number, width: number, height: number, depth: number): number[] {
  const points = [[t - width / 2, y - height / 2], [t + width / 2, y - height / 2], [t + width / 2, y + height / 2], [t - width / 2, y + height / 2]].map(([x, z]) => onFace(frame, x, z, depth));
  const indices = -frame.u[1] * frame.n[0] + frame.u[0] * frame.n[1] >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
  return indices.flatMap(index => points[index]);
}

/** City-wide close-LOD display prior. Geometry and neighbour clearance choose
 * exterior walls; construction year only adjusts rhythm. It creates no
 * observation identity and is never an extracted facade fact. */
export function contextualFacadePatches(owner:Owner,surface:Surface,surfaceIndex:number,neighbours:Owner[]):FacadeRecipePatch[]{
  if(surface.type!=='wall')return[];const frame=frameFor(surface,owner,neighbours);if(!frame||frame.width<2.2||frame.top-frame.bottom<5)return[];
  const ground=Number.isFinite(owner.geometry.building.groundNAP)?owner.geometry.building.groundNAP!-.65:frame.bottom,usableTop=Math.min(frame.top,ground+42),height=usableTop-ground;if(height<5)return[];
  const year=Number(owner.geometry.building.year),floorHeight=Number.isFinite(year)&&year<1940?3.45:3.15,floors=Math.max(1,Math.min(10,Math.floor(height/floorHeight))),bayTarget=Number.isFinite(year)&&year<1940?2.45:3.05,bays=Math.max(1,Math.min(14,Math.round(frame.width/bayTarget))),bayWidth=frame.width/bays;
  const width=Math.min(Number.isFinite(year)&&year<1940?1.18:1.48,bayWidth*.55),windowHeight=Math.min(Number.isFinite(year)&&year<1940?1.85:1.55,floorHeight*.58),patches:FacadeRecipePatch[]=[];
  const identityTone=[...owner.id].reduce((sum,char)=>sum*31+char.charCodeAt(0),0)>>>0;
  const frameColour:FacadeRecipePatch['colour']=Number.isFinite(year)&&year>=1970||identityTone%11===0?'windowFrameDark':'windowFrame';
  const glassColour:FacadeRecipePatch['colour']=identityTone%3===0?'windowGlassBlue':identityTone%3===1?'windowGlassWarm':'windowGlass';
  const primary=primaryExteriorWall(owner,neighbours),doorBay=[...owner.id].reduce((sum,char)=>sum+char.charCodeAt(0),0)%bays,hasDoor=surfaceIndex===primary&&frame.bottom<=ground+.7;
  const historicMullion=Number.isFinite(year)&&year<1965;
  for(let floor=0;floor<floors;floor++)for(let bay=0;bay<bays;bay++){if(hasDoor&&floor===0&&bay===doorBay)continue;const t=(bay+.5)*bayWidth,y=ground+.55+(floor+.5)*floorHeight;if(!rectangleFitsFace(frame,t,y,width+.16,windowHeight+.16)||!rectangleClear(frame,t,width+.16,owner,neighbours))continue;const featureId=`${owner.id}:${surfaceIndex}:context-window:${floor}:${bay}`;patches.push({triangles:quad(frame,t,y,width+.2,windowHeight+.2,.05),colour:frameColour,observationId:null,featureId,featureKind:'contextual-window-prior',styleSource:'procedural-prior-not-measured'},{triangles:quad(frame,t,y,width,windowHeight,.038),colour:glassColour,observationId:null,featureId,featureKind:'contextual-window-prior',styleSource:'procedural-prior-not-measured'},{triangles:quad(frame,t,y+windowHeight*.12,width,.065,.058),colour:frameColour,observationId:null,featureId,featureKind:'contextual-window-prior',styleSource:'procedural-prior-not-measured'});if(historicMullion)patches.push({triangles:quad(frame,t,y,.055,windowHeight-.14,.058),colour:frameColour,observationId:null,featureId,featureKind:'contextual-window-prior',styleSource:'procedural-prior-not-measured'});patches.push({triangles:quad(frame,t,y-windowHeight/2-.045,width+.28,.09,.07),colour:frameColour,observationId:null,featureId,featureKind:'contextual-window-prior',styleSource:'procedural-prior-not-measured'});}
  if(hasDoor){const t=(doorBay+.5)*bayWidth,doorWidth=Math.min(1.15,bayWidth*.48),doorHeight=Math.min(2.45,floorHeight*.76),y=ground+.12+doorHeight/2;if(rectangleFitsFace(frame,t,y,doorWidth+.2,doorHeight+.16)&&rectangleClear(frame,t,doorWidth+.2,owner,neighbours)){const featureId=`${owner.id}:${surfaceIndex}:context-door`,door=(triangles:number[],colour:FacadeRecipePatch['colour'])=>patches.push({triangles,colour,observationId:null,featureId,featureKind:'contextual-door-prior',styleSource:'procedural-prior-not-measured'});door(quad(frame,t,y,doorWidth+.2,doorHeight+.16,.036),frameColour);door(quad(frame,t,y,doorWidth,doorHeight,.05),'doorWood');if(historicMullion){const transomHeight=Math.min(.42,doorHeight*.18),transomY=y+doorHeight/2-transomHeight/2-.1;door(quad(frame,t,transomY,doorWidth-.18,transomHeight,.062),glassColour);door(quad(frame,t,transomY-transomHeight/2-.045,doorWidth,.09,.068),frameColour);}door(quad(frame,t,ground+.1,doorWidth+.28,.1,.075),frameColour);}}
  const trimWidth=frame.width-.32,trimColour:FacadeRecipePatch['colour']=Number.isFinite(year)&&year>=1965?'facadeTrimDark':'facadeTrimLight';
  const addTrim=(name:string,y:number,trimHeight:number)=>{if(trimWidth<1.8||!rectangleFitsFace(frame,frame.width/2,y,trimWidth,trimHeight)||!rectangleClear(frame,frame.width/2,trimWidth,owner,neighbours))return;patches.push({triangles:quad(frame,frame.width/2,y,trimWidth,trimHeight,.072),colour:trimColour,observationId:null,featureId:`${owner.id}:${surfaceIndex}:context-trim:${name}`,featureKind:'contextual-trim-prior',styleSource:'procedural-prior-not-measured'});};
  if(floors>1)addTrim('street-datum',ground+floorHeight,.12);
  if(Number.isFinite(year)&&year<1965)addTrim('facade-top',usableTop-.18,.24);
  return patches;
}

export function facadeRecipePatches(owner: Owner, surface: Surface, surfaceIndex: number, records: any[], neighbours: Owner[], reviewedAwnings = false): FacadeRecipePatch[] {
  if (surface.type !== 'wall') return [];
  const frame = frameFor(surface, owner, neighbours);
  if (!frame || frame.top - frame.bottom < 2.5) return [];
  // The shared partitioner normally gates whole-wall appearance. Here it only
  // partitions placement: individual original fields are checked separately
  // below, so a bad full crop cannot erase independently usable ground evidence.
  const originals = new Map(records.map(record => [record.id, record]));
  const patches: FacadeRecipePatch[] = [];
  const wallYs = owner.geometry.building.surfaces.filter(face => face.type === 'wall').flatMap(face => face.rings[0].map(point => point[1]));
  const groundBase = Number.isFinite(owner.geometry.building.groundNAP) ? owner.geometry.building.groundNAP! - .65 : Math.min(...wallYs);
  // Resolve upper and ground candidates independently. An unknown ground field
  // cannot outvote a supported shopfront merely because its full crop is usable.
  const fieldIntervals = ['upper', 'ground'].flatMap(field => {
    const placementViews = records.map(record => ({ ...record, effectiveProposal: (field === 'upper' ? upperSupported(record) : groundSupported(record)) ? { wholeUsable: 'unknown' } : null }));
    const partition = wallObservationIntervals(surface, surfaceIndex, owner.id, placementViews);
    return partition.intervals.map((interval: any) => ({ field, interval, axis: partition.axis }));
  });
  for (const { field, interval, axis } of fieldIntervals) {
    if (!interval.observation || interval.status === 'conflict') continue;
    const record = originals.get(interval.observation.id), f: Frame | null = intervalFaceFrame(frame, axis, interval);
    if (!record || !f || f.width < 1.5) continue;
    const add = (triangles: number[], colour: FacadeRecipePatch['colour'], featureId: string, featureKind: FacadeRecipePatch['featureKind']) => patches.push({ triangles, colour, observationId: record.id, featureId, featureKind, styleSource: 'procedural-prior-not-measured' });
    const window = (t: number, y: number, width: number, height: number, featureId: string) => {
      if (!rectangleFitsFace(f, t, y, width + .18, height + .18) || !rectangleClear(f, t, width + .18, owner, neighbours)) return;
      add(quad(f, t, y, width + .18, height + .18, .05), 'windowFrame', featureId, 'window-prior');
      add(quad(f, t, y, width, height, .038), 'windowGlass', featureId, 'window-prior');
      add(quad(f, t, y + height * .12, width, .065, .058), 'windowFrame', featureId, 'window-prior');
      add(quad(f, t, y, .055, height - .14, .058), 'windowFrame', featureId, 'window-prior');
    };
    // A common 3.5 m display rhythm aligns stacked source surfaces. A high wall
    // component must never acquire another shop at its own elevated "bottom".
    const floorHeight = 3.5;
    const floorCount = Math.max(1, Math.min(12, Math.ceil((f.top - groundBase) / floorHeight)));
    const bays = Math.max(1, Math.min(16, Math.round(f.width / 2.7))), bayWidth = f.width / bays;
    const windowWidth = Math.min(1.25, bayWidth * .53), windowHeight = Math.min(1.9, floorHeight * .56);
    const baseId = `${owner.id}:${surfaceIndex}:${record.id}`;
    if (field === 'upper') {
      for (let floor = 1; floor < floorCount; floor++) for (let bay = 0; bay < bays; bay++) {
        window((bay + .5) * bayWidth, groundBase + (floor + .48) * floorHeight, windowWidth, windowHeight, `${baseId}:window:${floor}:${bay}`);
      }
      continue;
    }
    if (!groundSupported(record) || f.bottom > groundBase + 1.5) continue;
    const groundHeight = Math.min(2.35, floorHeight * .66), groundY = groundBase + .55 + groundHeight / 2;
    if (record.effectiveProposal.shopfront === 'no') {
      for (let bay = 0; bay < bays; bay++) window((bay + .5) * bayWidth, groundY, windowWidth, Math.min(1.8, groundHeight), `${baseId}:window:0:${bay}`);
      continue;
    }
    const width = Math.min(f.width - .5, 12), t = f.width / 2;
    if (!rectangleFitsFace(f, t, groundY, width + .16, groundHeight + .16) || !rectangleClear(f, t, width + .16, owner, neighbours)) continue;
    const featureId = `${baseId}:shop`;
    add(quad(f, t, groundY, width + .16, groundHeight + .16, .05), 'windowFrame', featureId, 'shopfront-prior');
    add(quad(f, t, groundY, width, groundHeight, .038), 'shopGlass', featureId, 'shopfront-prior');
    // Generic mullions, not a guessed entrance or tenant partition.
    const panes = Math.max(2, Math.ceil(width / 1.7));
    for (let pane = 1; pane < panes; pane++) add(quad(f, t - width / 2 + width * pane / panes, groundY, .065, groundHeight, .058), 'windowFrame', featureId, 'shopfront-prior');
    if (reviewedAwnings && mayRenderReviewedAwning(record)) {
      const awningY = groundY + groundHeight / 2 + .3;
      if (!rectangleFitsFace(f, t, awningY, width, .2)) continue;
      const points = [onFace(f, t - width / 2, awningY, .07), onFace(f, t + width / 2, awningY, .07), onFace(f, t + width / 2, awningY - .24, .8), onFace(f, t - width / 2, awningY - .24, .8)];
      add([0, 1, 2, 0, 2, 3].flatMap(index => points[index]), 'awningFabric', `${baseId}:awning`, 'reviewed-awning-prior');
    }
  }
  return patches;
}
