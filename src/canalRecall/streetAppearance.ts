/** Approximate street-side priors. They never change surveyed geometry or POI facts. */
export type StreetPoint = readonly [number, number]; // longitude, latitude
export interface ArchitecturalRecipe {
  family: 'masonry' | 'punched' | 'ribbon' | 'curtain';
  period: 'canal' | 'c19' | 'school' | 'postwar' | 'modern' | 'tower';
  wallHex?: string; frameHex?: string; groundWallHex?: string;
  bayScale?: number; storeyScale?: number; groundScale?: number;
  windowWidth?: number; windowHeight?: number;
  windowProportions?: 'tall' | 'balanced' | 'wide';
  windowHead?: 'flat' | 'segmental';
  frameColor?: 'pale' | 'dark'; lintel?: 'flat' | 'arch' | 'none'; paleAccents?: boolean;
  sash?: 'plain' | 'transom' | 'paired-transom' | 'six-over-six';
  facadeAssembly?: 'stacked-open-balcony' | 'stacked-iron-balcony'; trimDensity?: 'restrained' | 'ornate';
  wallMaterial?: 'brick' | 'smooth';
  atticWindows?: boolean;
  /** One complete frontage group, independent of tessellation and construction date. */
  openingGroup?: 'canal-two' | 'canal-three';
  groundAssembly?: 'tall-side-entry' | 'tall-commercial';
  /** Observed rigid shop canopy; opt-in for a source-registered street frontage only. */
  shopCanopy?: { kind: 'continuous-rigid'; projectionM: number; fasciaHeightM: number; fasciaHex: string; edgeHex: string };
  /** Procedural crown prior for an admitted source-visual frontage, not surveyed geometry. */
  crownShape?: 'neck' | 'plain' | 'bell' | 'cornice';
  crownWindows?: 'rectangular' | 'paired-oculi';
  crownTrim?: boolean;
  /** Reviewed frontage can omit guessed balconies while retaining explicit assemblies. */
  balconyPolicy?: 'assembly-only';
  detailPolicy?: 'architectural';
  /** Source-supported entrance assembly, independent of construction facts. */
  entranceAssembly?: 'raised-pilaster' | 'raised-plain';
  trim?: { frames: number; lintels: number; cornice: number; courses: number; quoins: number; arches: number };
  confidence: number; profileId?: string;
}
export interface StreetAppearanceEvidence {
  id: string; kind: 'municipal-panorama' | 'user-reference';
  captureDate?: string; sha256: string; url?: string; panoramaId?: string;
  inference: 'agent-visual-review' | 'model'; model?: string;
  quality: number; notes: string;
}
export interface StreetAppearanceVisualClass {
  kind: 'historic-frontage'; sourceEvidenceIds: string[]; constructionYearPolicy: 'source-visual';
}
export interface StreetAppearanceFrontage { start: StreetPoint; end: StreetPoint; widthM: number }
export interface StreetAppearanceProfile {
  id: string; streetName: string; revision: string;
  /** Reviewed architectural appearance; never a replacement construction fact. */
  visualClass?: StreetAppearanceVisualClass;
  /** Explicit official Pand links, independent of image registration or palette allocation. */
  registerCrowns?: Array<{buildingId:string;shape:'neck'|'plain'|'bell'|'cornice';windows?:'paired-oculi';sourceUrl:string;sourceSnapshotSha256:string}>;
  segment: readonly [StreetPoint, StreetPoint]; side: -1 | 1;
  reachM: number; confidence: number; assemblyM: number;
  /** Each joint recipe is observed as one combination, never independently shuffled. */
  recipes: Array<{ weight: number; recipe: ArchitecturalRecipe; yearMin?: number; yearMax?: number; heightMin?: number; heightMax?: number; frontageMin?: number; frontageMax?: number; priority?: number; cornerOnly?: boolean }>;
  evidence: StreetAppearanceEvidence[];
  status: 'pilot' | 'reviewed'; holdout?: boolean;
  /** Validation extent receives training prior; its own photographs never tune that prior. */
  learnedFrom?: string;
  /** Baked from all eligible surveyed street fronts, stable across streamed tiles. */
  frontages?: Array<{ buildingId: string; recipeIndex: number; frontage?: StreetAppearanceFrontage }>;
}
export interface StreetAppearanceStreetPath { highway?: string; points: StreetPoint[] }
export interface StreetAppearanceCatalog { schemaVersion: 1; revision: string; profiles: StreetAppearanceProfile[]; streetFrontPaths?: StreetAppearanceStreetPath[] }
export interface StreetAppearanceWall { start: StreetPoint; end: StreetPoint; normal: readonly [number, number]; frontage?: StreetAppearanceFrontage }
export interface StreetAppearanceBuilding { id: string; year: number | null; heightM: number; streetCorner?: boolean }
export interface StreetAppearanceFront { building: StreetAppearanceBuilding; wall: StreetAppearanceWall; eligible?: boolean }
export type StreetAppearanceAssignments = ReadonlyMap<string, ArchitecturalRecipe>;
export const streetAppearanceAssignmentKey = (profile: Pick<StreetAppearanceProfile, 'id' | 'revision'>, buildingId: string) => JSON.stringify([profile.id, profile.revision, buildingId]);
const frontageCache = new WeakMap<StreetAppearanceProfile,Map<string,NonNullable<StreetAppearanceProfile['frontages']>[number]>>();
const compiledFrontages = new WeakMap<StreetAppearanceAssignments,Map<string,StreetAppearanceFrontage>>();
const hash = (text: string) => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };
export function profileLocation(profile: StreetAppearanceProfile, point: StreetPoint) {
  const [a, b] = profile.segment, kx = 111320 * Math.cos(a[1] * Math.PI / 180), ky = 110540;
  const dx = (b[0] - a[0]) * kx, dy = (b[1] - a[1]) * ky, lengthM = Math.hypot(dx, dy);
  if (lengthM < 1) return undefined;
  const px = (point[0] - a[0]) * kx, py = (point[1] - a[1]) * ky;
  return { alongM: (px * dx + py * dy) / lengthM, depthM: (dx * py - dy * px) / lengthM, lengthM, dx, dy };
}
const municipalEvidenceUrl = (url: unknown) => {
  if (typeof url !== 'string') return false;
  try { const parsed=new URL(url);return parsed.protocol==='https:' && (parsed.hostname==='amsterdam.nl'||parsed.hostname.endsWith('.amsterdam.nl')); } catch { return false; }
};
/** Source-visual dates are admitted only by reviewed, attributable municipal views. */
export function admittedStreetAppearanceVisualClass(profile: StreetAppearanceProfile): boolean {
  const v = profile.visualClass;
  return !!v && v.kind === 'historic-frontage' && v.constructionYearPolicy === 'source-visual' &&
    profile.status === 'reviewed' && !profile.holdout && !profile.learnedFrom &&
    Array.isArray(v.sourceEvidenceIds) && v.sourceEvidenceIds.length > 0 &&
    new Set(v.sourceEvidenceIds).size === v.sourceEvidenceIds.length &&
    v.sourceEvidenceIds.every(id => typeof id === 'string' && !!id && profile.evidence.some(e => e.id === id && e.kind === 'municipal-panorama' &&
      e.inference === 'agent-visual-review' && e.quality >= .45 && /^[a-f0-9]{64}$/.test(e.sha256) &&
      typeof e.panoramaId === 'string' && !!e.panoramaId && typeof e.captureDate === 'string' && !!e.captureDate && Number.isFinite(Date.parse(e.captureDate)) &&
      municipalEvidenceUrl(e.url)));
}
function spatialMatch(profile: StreetAppearanceProfile, wall: StreetAppearanceWall, bounded = true) {
  if ((profile.holdout && !profile.learnedFrom) || profile.confidence < .45 || !profile.evidence.some(e => e.quality >= .45) || profile.visualClass && !admittedStreetAppearanceVisualClass(profile)) return undefined;
  const run = wall.frontage ?? wall;
  const midpoint: StreetPoint = [(run.start[0] + run.end[0]) / 2, (run.start[1] + run.end[1]) / 2];
  const loc = profileLocation(profile, midpoint); if (!loc) return undefined;
  if (bounded && (loc.alongM < 0 || loc.alongM > loc.lengthM) || loc.depthM * profile.side <= 0 || Math.abs(loc.depthM) > profile.reachM) return undefined;
  const inwardX = profile.side * loc.dy / loc.lengthM, inwardY = -profile.side * loc.dx / loc.lengthM;
  const normalLength = Math.hypot(...wall.normal); if (!normalLength) return undefined;
  const facing = (wall.normal[0] * inwardX + wall.normal[1] * inwardY) / normalLength;
  if (facing < .65) return undefined;
  return { profile, alongM: loc.alongM, lengthM: loc.lengthM, score: profile.confidence * facing / (1 + Math.abs(loc.depthM) / profile.reachM) };
}
const candidateOrder = (a: NonNullable<ReturnType<typeof spatialMatch>>, b: NonNullable<ReturnType<typeof spatialMatch>>) =>
  Number(!!b.profile.visualClass) - Number(!!a.profile.visualClass) || b.score-a.score || a.profile.id.localeCompare(b.profile.id);
/** Spatial lookup only; use resolveStreetAppearanceProfile for eligibility and fallback. */
export function matchStreetAppearanceProfile(profiles: readonly StreetAppearanceProfile[], wall: StreetAppearanceWall) {
  return profiles.map(profile => spatialMatch(profile, wall)).filter((m): m is NonNullable<typeof m> => !!m).sort(candidateOrder)[0];
}
const eligibleRecipes = (profile: StreetAppearanceProfile, building: StreetAppearanceBuilding, widthM?: number) => {
  const sourceVisual = admittedStreetAppearanceVisualClass(profile);
  const compatible = profile.recipes.filter(x => x.weight > 0 && x.recipe.confidence >= .45 &&
    !(building.heightM > 28 && ['canal','c19','school'].includes(x.recipe.period)) &&
    (x.heightMin == null || building.heightM >= x.heightMin) && (x.heightMax == null || building.heightM <= x.heightMax) && (!x.cornerOnly || building.streetCorner === true) &&
    (x.frontageMin == null || widthM != null && widthM >= x.frontageMin) && (x.frontageMax == null || widthM != null && widthM <= x.frontageMax) &&
    (sourceVisual || (building.year == null ? (x.priority ?? 0) === 0 : ((x.yearMin == null || building.year >= x.yearMin) && (x.yearMax == null || building.year <= x.yearMax)))));
  const priority = Math.max(0, ...compatible.map(x => x.priority ?? 0));
  return compatible.filter(x => (x.priority ?? 0) === priority);
};
function bakedFrontage(profile: StreetAppearanceProfile, buildingId: string) {
  if (!profile.frontages) return undefined;
  let fronts = frontageCache.get(profile);
  if (!fronts) { fronts = new Map(profile.frontages.map(front => [front.buildingId,front])); frontageCache.set(profile,fronts); }
  return fronts.get(buildingId);
}
/** Complete exposed run required for width classes; an individual tessellated edge is never evidence. */
export function resolveStreetAppearanceProfile(profiles: readonly StreetAppearanceProfile[], wall: StreetAppearanceWall, building: StreetAppearanceBuilding, assignments?: StreetAppearanceAssignments) {
  const candidates = profiles.map(profile => {
    const key = streetAppearanceAssignmentKey(profile,building.id);
    const bounded = !!profile.visualClass || profile.recipes.some(r=>r.frontageMin!=null||r.frontageMax!=null);
    const frontage = bakedFrontage(profile,building.id)?.frontage ?? wall.frontage ?? (bounded && assignments ? compiledFrontages.get(assignments)?.get(key) : undefined);
    if (profile.visualClass && !frontage) return undefined;
    const match = spatialMatch(profile,{...wall,frontage}); if (!match) return undefined;
    const choices = eligibleRecipes(profile,building,frontage?.widthM); if (!choices.length) return undefined;
    const baked = bakedFrontage(profile,building.id);
    // An explicit full-cohort visual bake also bounds admitted identities in streamed subsets.
    if (profile.visualClass && profile.frontages && !baked) return undefined;
    if (baked && !choices.includes(profile.recipes[baked.recipeIndex])) return undefined;
    return {...match,choices,frontage};
  }).filter((m): m is NonNullable<typeof m> => !!m).sort(candidateOrder);
  return candidates[0];
}
const resolvedRecipe = (profile: StreetAppearanceProfile, recipe: ArchitecturalRecipe): ArchitecturalRecipe => ({ ...recipe, confidence: Math.min(recipe.confidence, profile.confidence), profileId: profile.id });

/** Compile once from a complete segment cohort (or tile plus its segment halo).
 * Holes, hidden walls, non-street fronts and curated appearance must be excluded by
 * the caller. Split outlines of one real building count once per street side;
 * corner faces belong to separate profile cohorts. No exact facade registration.
 */
export function compileStreetAppearanceAssignments(profiles: readonly StreetAppearanceProfile[], fronts: readonly StreetAppearanceFront[]): Map<string, ArchitecturalRecipe> {
  type Member = { key: string; id: string; profile: StreetAppearanceProfile; choices: ReturnType<typeof eligibleRecipes>; intervals: Array<[number,number]>; alongM: number; widthM: number };
  const members = new Map<string,Member>();
  // Group before matching the short segment. Do not clip a broad frontage to the
  // observed class boundary or let its small tessellated edges pass a width gate.
  const runs = new Map<string, { profile: StreetAppearanceProfile; fronts: StreetAppearanceFront[]; intervals: Array<[number,number,number]> }>();
  for (const front of fronts) if (front.eligible !== false) for (const profile of profiles) {
    if (!spatialMatch(profile,front.wall,false)) continue;
    const a=profileLocation(profile,front.wall.start)!, b=profileLocation(profile,front.wall.end)!;
    const kx=111320*Math.cos(profile.segment[0][1]*Math.PI/180);
    const projected=Math.abs(a.alongM-b.alongM), length=Math.hypot((front.wall.end[0]-front.wall.start[0])*kx,(front.wall.end[1]-front.wall.start[1])*110540);
    const interval: [number,number,number]=[Math.min(a.alongM,b.alongM),Math.max(a.alongM,b.alongM),length/projected];
    if (interval[1]-interval[0]<.1) continue;
    const key=streetAppearanceAssignmentKey(profile,front.building.id), run=runs.get(key);
    if(run){run.fronts.push(front);run.intervals.push(interval);}else runs.set(key,{profile,fronts:[front],intervals:[interval]});
  }
  const geometry = new Map<string,StreetAppearanceFrontage>();
  for (const [key,run] of runs) {
    const intervals=run.intervals.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const endpoints=[...new Set(intervals.flatMap(([a,b])=>[a,b]))].sort((a,b)=>a-b);
    let widthM=0;
    // Union duplicate spans while retaining actual run length, rather than
    // shortening an oblique broad frontage to its street projection.
    for(let i=1;i<endpoints.length;i++){
      const a=endpoints[i-1],b=endpoints[i],middle=(a+b)/2;
      const scales=intervals.filter(([start,end])=>start<=middle&&end>=middle).map(([, , scale])=>scale);
      if(scales.length)widthM+=(b-a)*Math.max(...scales);
    }
    const end=endpoints[endpoints.length-1];
    const loc=profileLocation(run.profile,run.fronts[0].wall.start)!, kx=111320*Math.cos(run.profile.segment[0][1]*Math.PI/180);
    const depth=run.fronts.reduce((sum,f)=>sum+profileLocation(run.profile,[(f.wall.start[0]+f.wall.end[0])/2,(f.wall.start[1]+f.wall.end[1])/2])!.depthM,0)/run.fronts.length;
    const point=(along:number):StreetPoint=>[run.profile.segment[0][0]+(along*loc.dx/loc.lengthM-depth*loc.dy/loc.lengthM)/kx,run.profile.segment[0][1]+(along*loc.dy/loc.lengthM+depth*loc.dx/loc.lengthM)/110540];
    const stablePoint=(along:number)=>point(along).map(n=>Math.round(n*1e12)/1e12) as unknown as StreetPoint;
    geometry.set(key,{start:stablePoint(intervals[0][0]),end:stablePoint(end),widthM:Math.round(widthM*1e6)/1e6});
  }
  // Complete groups share the runtime candidate resolver, including fallback.
  for (const front of fronts) {
    if(front.eligible===false)continue;
    const candidates=profiles.flatMap(profile=>{
      const key=streetAppearanceAssignmentKey(profile,front.building.id), frontage=geometry.get(key);if(!frontage)return [];
      // Compilation is authoritative: previous baked cohort records cannot gate a new bake.
      const unbaked={...profile,frontages:undefined};
      const bounded=!!profile.visualClass||profile.recipes.some(r=>r.frontageMin!=null||r.frontageMax!=null);
      const match=resolveStreetAppearanceProfile([unbaked],{...front.wall,frontage:bounded?frontage:front.wall.frontage},front.building);if(!match)return [];
      const run=runs.get(key)!;
      const choices=match.choices.filter(choice=>run.fronts.every(f=>eligibleRecipes(unbaked,f.building,frontage.widthM).includes(choice)));
      return choices.length?[{...match,profile,choices,frontage,bounded}]:[];
    }).sort(candidateOrder);
    const match=candidates[0];if(!match)continue;
    const key=streetAppearanceAssignmentKey(match.profile,front.building.id);
    if(match.bounded){
      if(members.has(key))continue;
      const a=profileLocation(match.profile,match.frontage.start)!,b=profileLocation(match.profile,match.frontage.end)!;
      members.set(key,{key,id:front.building.id,profile:match.profile,choices:match.choices,intervals:[],alongM:Math.min(a.alongM,b.alongM),widthM:match.frontage.widthM});
    }else{
      // Preserve existing general palette allocation: clipped projected exposure,
      // one vote per identity, independent of duplicate or split wall parts.
      const a=profileLocation(match.profile,front.wall.start)!,b=profileLocation(match.profile,front.wall.end)!;
      const interval:[number,number]=[Math.max(0,Math.min(a.alongM,b.alongM)),Math.min(match.lengthM,Math.max(a.alongM,b.alongM))];
      if(interval[1]-interval[0]<.1)continue;
      const member=members.get(key);
      if(member)member.intervals.push(interval);
      else members.set(key,{key,id:front.building.id,profile:match.profile,choices:match.choices,intervals:[interval],alongM:0,widthM:0});
    }
  }
  const cohorts = new Map<string,Member[]>();
  for (const member of members.values()) {
    if (!member.choices.length) continue;
    if(member.intervals.length){
      const intervals=member.intervals.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
      let start=intervals[0][0],end=intervals[0][1];member.alongM=start;
      for(const next of intervals.slice(1)){if(next[0]<=end)end=Math.max(end,next[1]);else{member.widthM+=end-start;start=next[0];end=next[1];}}
      member.widthM+=end-start;
    }
    const cohortKey = JSON.stringify([member.profile.id,member.profile.revision,member.choices.map(recipe=>member.profile.recipes.indexOf(recipe))]);
    const cohort = cohorts.get(cohortKey); if (cohort) cohort.push(member); else cohorts.set(cohortKey,[member]);
  }
  const assignments = new Map<string,ArchitecturalRecipe>();
  for (const cohort of cohorts.values()) {
    cohort.sort((a,b)=>a.alongM-b.alongM || a.id.localeCompare(b.id));
    const choices = cohort[0].choices, count = cohort.length, total = choices.reduce((s,c)=>s+c.weight,0);
    // Largest-remainder counts allocate the observed joint mixture to actual
    // eligible frontage identities. A dark palette slot cannot fall in a gap or
    // in a modern building that does not admit the historic palette.
    const quota = choices.map(c=>Math.floor(count*c.weight/total));
    const remainder = choices.map((c,index)=>({index,fraction:count*c.weight/total-quota[index]})).sort((a,b)=>b.fraction-a.fraction || a.index-b.index);
    for (let i=0, left=count-quota.reduce((s,q)=>s+q,0);i<left;i++) quota[remainder[i].index]++;
    const width = cohort.reduce((s,m)=>s+m.widthM,0), assignedWidth = choices.map(()=>0);
    let passedWidth = 0;
    for (const member of cohort) {
      // Favor the palette with greatest frontage deficit; quota constraints keep
      // minority colors represented while unequal widths still inform ordering.
      let selected = -1, largestDeficit = -Infinity;
      for (let i=0;i<choices.length;i++) if (quota[i]>0) {
        const target = (passedWidth+member.widthM/2)/width * (width*choices[i].weight/total);
        const deficit = target-assignedWidth[i];
        if (deficit>largestDeficit) { largestDeficit=deficit;selected=i; }
      }
      quota[selected]--;assignedWidth[selected]+=member.widthM;passedWidth+=member.widthM;
      assignments.set(member.key,resolvedRecipe(member.profile,choices[selected].recipe));
    }
  }
  compiledFrontages.set(assignments,geometry);
  return assignments;
}
/** Persist the full-cohort solution into the sparse public profile catalog. */
export function streetAppearanceFrontageRecords(profile: StreetAppearanceProfile, assignments: StreetAppearanceAssignments): NonNullable<StreetAppearanceProfile['frontages']> {
  const comparable = (recipe:ArchitecturalRecipe) => { const {confidence:_confidence,profileId:_profileId,...fields}=recipe;return JSON.stringify(fields); };
  const recipes=profile.recipes.map(choice=>comparable(choice.recipe));
  const records:NonNullable<StreetAppearanceProfile['frontages']>=[];
  for(const [key,recipe] of assignments){
    const [profileId,revision,buildingId]=JSON.parse(key);if(profileId!==profile.id||revision!==profile.revision)continue;
    const recipeIndex=recipes.indexOf(comparable(recipe));if(recipeIndex<0)throw Error('assignment recipe missing from profile');
    const frontage=compiledFrontages.get(assignments)?.get(key);
    records.push({buildingId,recipeIndex,...(profile.visualClass || profile.recipes.some(r=>r.frontageMin!=null||r.frontageMax!=null) ? {frontage}: {})});
  }
  return records.sort((a,b)=>a.buildingId.localeCompare(b.buildingId));
}
/** Normal must point out of the wall in east/north coordinates. Back/courtyard walls fail facing. */
export function recipeForWall(profiles: readonly StreetAppearanceProfile[], wall: StreetAppearanceWall, building: StreetAppearanceBuilding, assignments?: StreetAppearanceAssignments): ArchitecturalRecipe | undefined {
  const best=resolveStreetAppearanceProfile(profiles,wall,building,assignments);if(!best)return undefined;
  const choices=best.choices;
  const baked=bakedFrontage(best.profile,building.id);
  if(baked)return resolvedRecipe(best.profile,best.profile.recipes[baked.recipeIndex].recipe);
  if(assignments) {
    const assigned=assignments.get(streetAppearanceAssignmentKey(best.profile,building.id));
    if(assigned)return assigned;
  }
  const { profile, alongM, lengthM } = best;
  // Shared local assemblies dominate; a minority of buildings supplies residual variation.
  const assemblyWidth = Math.max(6, profile.assemblyM);
  const assemblies = Math.max(1, Math.ceil(lengthM / assemblyWidth));
  const assembly = Math.min(assemblies - 1, Math.floor(alongM / assemblyWidth));
  // Short streets cannot rely on independent random rolls: three rolls can all
  // pick a minority pale facade and erase the observed dark/red rhythm. Sample
  // each quantile once, in a stable permutation, while retaining local repeats.
  const gcd = (a: number, b: number): number => { while (b) [a, b] = [b, a % b]; return a; };
  let stride = Math.max(1, Math.floor(hash(`${profile.id}:stride`) * assemblies));
  while (gcd(stride, assemblies) !== 1) ++stride;
  const shift = Math.floor(hash(`${profile.id}:${profile.revision}:shift`) * assemblies);
  const shared = (((assembly * stride + shift) % assemblies) + .5) / assemblies;
  const selection = shared;
  const total = choices.reduce((sum, x) => sum + x.weight, 0); let remaining = selection * total;
  let selected = choices[choices.length - 1]; for (const x of choices) { remaining -= x.weight; if (remaining < 0) { selected = x; break; } }
  return resolvedRecipe(profile,selected.recipe);
}

/** Strict admission at the IO boundary prevents malformed model output entering workers. */
export function validateStreetAppearanceCatalog(value: unknown): StreetAppearanceCatalog {
  const c = value as StreetAppearanceCatalog;
  if (!c || c.schemaVersion !== 1 || typeof c.revision !== 'string' || !Array.isArray(c.profiles)) throw Error('invalid street appearance catalog');
  if(c.streetFrontPaths!=null){
    if(!Array.isArray(c.streetFrontPaths))throw Error('invalid appearance street paths');
    for(const path of c.streetFrontPaths)if(!path||path.highway!=null&&typeof path.highway!=='string'||!Array.isArray(path.points)||path.points.length<2||path.points.some(pt=>!Array.isArray(pt)||pt.length!==2||!pt.every(Number.isFinite)||Math.abs(pt[0])>180||Math.abs(pt[1])>90))throw Error('invalid appearance street path');
  }
  const unit = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
  const ids = new Set<string>();
  for (const p of c.profiles) {
    if (!p || typeof p.id !== 'string' || ids.has(p.id) || typeof p.revision !== 'string' || typeof p.streetName !== 'string' || ![-1, 1].includes(p.side) || !unit(p.confidence) || !Number.isFinite(p.reachM) || p.reachM <= 0 || !Number.isFinite(p.assemblyM) || p.assemblyM < 6) throw Error('invalid street profile');
    ids.add(p.id);
    if (!Array.isArray(p.segment) || p.segment.length !== 2 || p.segment.some(pt => !Array.isArray(pt) || pt.length !== 2 || !pt.every(Number.isFinite) || Math.abs(pt[0]) > 180 || Math.abs(pt[1]) > 90) || !profileLocation(p, p.segment[0])) throw Error('invalid street segment');
    if (!['pilot', 'reviewed'].includes(p.status) || !Array.isArray(p.evidence) || !p.evidence.length || !Array.isArray(p.recipes) || !p.recipes.length) throw Error('missing street evidence');
    for (const e of p.evidence) if (!e || !unit(e.quality) || !/^[a-f0-9]{64}$/.test(e.sha256) || !['municipal-panorama', 'user-reference'].includes(e.kind) || !['agent-visual-review', 'model'].includes(e.inference)) throw Error('invalid street evidence');
    if(p.visualClass&&!admittedStreetAppearanceVisualClass(p))throw Error('invalid source visual class');
    if(p.registerCrowns){
      const members=new Set<string>();
      if(!p.visualClass||!Array.isArray(p.registerCrowns))throw Error('unadmitted register crown metadata');
      for(const r of p.registerCrowns){
        if(!r||!/^NL\.IMBAG\.Pand\.\d+$/.test(r.buildingId)||members.has(r.buildingId)||!['neck','plain','bell','cornice'].includes(r.shape)||r.windows!=null&&r.windows!=='paired-oculi'||!/^https:\/\/monumentenregister\.cultureelerfgoed\.nl\/monumenten\/\d+$/.test(r.sourceUrl)||! /^[a-f0-9]{64}$/.test(r.sourceSnapshotSha256))throw Error('invalid explicit register crown');
        members.add(r.buildingId);
      }
    }
    for (const { weight, recipe: r, yearMin, yearMax, heightMin, heightMax, frontageMin, frontageMax, priority, cornerOnly } of p.recipes) {
      if (!Number.isFinite(weight) || weight <= 0 || !r || !['masonry', 'punched', 'ribbon', 'curtain'].includes(r.family) || !['canal', 'c19', 'school', 'postwar', 'modern', 'tower'].includes(r.period) || !unit(r.confidence)) throw Error('invalid architectural recipe');
      if (yearMin != null && !Number.isFinite(yearMin) || yearMax != null && !Number.isFinite(yearMax) || yearMin != null && yearMax != null && yearMin > yearMax) throw Error('invalid period range');
      if(heightMin!=null&&(!Number.isFinite(heightMin)||heightMin<0)||heightMax!=null&&(!Number.isFinite(heightMax)||heightMax<=0)||heightMin!=null&&heightMax!=null&&heightMin>heightMax)throw Error('invalid height range');
      if(frontageMin!=null&&(!Number.isFinite(frontageMin)||frontageMin<=0)||frontageMax!=null&&(!Number.isFinite(frontageMax)||frontageMax<=0)||frontageMin!=null&&frontageMax!=null&&frontageMin>frontageMax)throw Error('invalid frontage range');
      if(p.visualClass&&(frontageMin==null||frontageMax==null||heightMin==null||heightMax==null||r.family!=='masonry'||!['canal','c19'].includes(r.period)))throw Error('unbounded visual frontage recipe');
      if(cornerOnly!=null&&typeof cornerOnly!=='boolean')throw Error('invalid corner qualification');
      if(priority!=null&&(!Number.isInteger(priority)||priority<0||priority>10))throw Error('invalid character priority');
      for (const hex of [r.wallHex, r.frameHex, r.groundWallHex]) if (hex != null && !/^#[a-f0-9]{6}$/i.test(hex)) throw Error('invalid recipe colour');
      for (const ratio of [r.windowWidth, r.windowHeight]) if (ratio != null && !unit(ratio)) throw Error('invalid opening fraction');
      for (const scale of [r.bayScale, r.storeyScale, r.groundScale]) if (scale != null && (!Number.isFinite(scale) || scale < .5 || scale > 2)) throw Error('invalid recipe scale');
      if (r.windowProportions != null && !['tall','balanced','wide'].includes(r.windowProportions) || r.frameColor != null && !['pale','dark'].includes(r.frameColor) || r.lintel != null && !['flat','arch','none'].includes(r.lintel) || r.paleAccents != null && typeof r.paleAccents !== 'boolean') throw Error('invalid recipe accent');
      if(r.windowHead!=null&&(!['flat','segmental'].includes(r.windowHead)||r.family!=='masonry'||r.windowHead==='segmental'&&(!r.openingGroup||r.period!=='canal')))throw Error('invalid window head');
      if(r.sash!=null&&!['plain','transom','paired-transom','six-over-six'].includes(r.sash)||r.trimDensity!=null&&!['restrained','ornate'].includes(r.trimDensity))throw Error('invalid recipe detail');
      if(r.facadeAssembly!=null){
        const modern=r.facadeAssembly==='stacked-open-balcony'&&r.family==='punched'&&['modern','postwar'].includes(r.period);
        const historic=r.facadeAssembly==='stacked-iron-balcony'&&r.family==='masonry'&&['canal','c19'].includes(r.period);
        if(!modern&&!historic)throw Error('incompatible facade assembly');
      }
      if(r.entranceAssembly!=null&&(!['raised-pilaster','raised-plain'].includes(r.entranceAssembly)||r.family!=='masonry'||r.period!=='c19'))throw Error('incompatible entrance assembly');
      if(r.balconyPolicy!=null&&r.balconyPolicy!=='assembly-only')throw Error('invalid balcony policy');
      if(r.detailPolicy!=null&&r.detailPolicy!=='architectural')throw Error('invalid detail policy');
      if(r.wallMaterial!=null&&!['brick','smooth'].includes(r.wallMaterial))throw Error('invalid recipe wall material');
      if(r.openingGroup!=null&&(!['canal-two','canal-three'].includes(r.openingGroup)||r.family!=='masonry'||r.period!=='canal'))throw Error('incompatible frontage opening group');
      if(r.groundAssembly!=null&&(!['tall-side-entry','tall-commercial'].includes(r.groundAssembly)||!r.openingGroup))throw Error('incompatible frontage ground assembly');
      if(r.shopCanopy!=null){
        const c=r.shopCanopy;
        if(c.kind!=='continuous-rigid'||r.family!=='masonry'||!['c19','school'].includes(r.period)||!Number.isFinite(c.projectionM)||c.projectionM<.3||c.projectionM>1.8||!Number.isFinite(c.fasciaHeightM)||c.fasciaHeightM<.12||c.fasciaHeightM>.4||![c.fasciaHex,c.edgeHex].every(hex=>/^#[a-f0-9]{6}$/i.test(hex)))throw Error('invalid source shop canopy');
      }
      if(r.crownShape!=null&&(!['neck','plain','bell','cornice'].includes(r.crownShape)||!p.visualClass||r.family!=='masonry'||!['canal','c19'].includes(r.period)))throw Error('incompatible source crown prior');
      if(r.crownWindows!=null&&(!['rectangular','paired-oculi'].includes(r.crownWindows)||!p.visualClass||!r.crownShape))throw Error('incompatible source crown windows');
      if(r.crownTrim!=null&&(typeof r.crownTrim!=='boolean'||!p.visualClass||!r.crownShape))throw Error('incompatible source crown trim');
      if(r.atticWindows!=null&&typeof r.atticWindows!=='boolean')throw Error('invalid recipe attic window hint');
      if (r.trim && ['frames','lintels','cornice','courses','quoins','arches'].some(key => !unit(r.trim![key as keyof NonNullable<ArchitecturalRecipe['trim']>]))) throw Error('invalid recipe trim');
    }
    if(p.frontages!=null){
      if(!Array.isArray(p.frontages))throw Error('invalid baked frontages');const buildingIds=new Set<string>();
      for(const front of p.frontages){if(!front||typeof front.buildingId!=='string'||!front.buildingId||buildingIds.has(front.buildingId)||!Number.isInteger(front.recipeIndex)||front.recipeIndex<0||front.recipeIndex>=p.recipes.length)throw Error('invalid baked frontage');buildingIds.add(front.buildingId);
        if(front.frontage&&(!Number.isFinite(front.frontage.widthM)||front.frontage.widthM<=0||[front.frontage.start,front.frontage.end].some(pt=>!Array.isArray(pt)||pt.length!==2||!pt.every(Number.isFinite)||Math.abs(pt[0])>180||Math.abs(pt[1])>90)))throw Error('invalid baked frontage run');
        if(p.visualClass&&!front.frontage)throw Error('missing baked visual frontage run');
      }
    }
  }
  for (const p of c.profiles) if (p.learnedFrom != null && (typeof p.learnedFrom !== 'string' || !c.profiles.some(training => training.id === p.learnedFrom && !training.holdout && JSON.stringify(training.recipes) === JSON.stringify(p.recipes)))) throw Error('invalid holdout transfer');
  return c;
}
