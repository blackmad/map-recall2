/** Approximate street-side priors. They never change surveyed geometry or POI facts. */
export type StreetPoint = readonly [number, number]; // longitude, latitude
export interface ArchitecturalRecipe {
  family: 'masonry' | 'punched' | 'ribbon' | 'curtain';
  period: 'canal' | 'c19' | 'school' | 'postwar' | 'modern' | 'tower';
  wallHex?: string; frameHex?: string;
  bayScale?: number; storeyScale?: number; groundScale?: number;
  windowWidth?: number; windowHeight?: number;
  windowProportions?: 'tall' | 'balanced' | 'wide';
  frameColor?: 'pale' | 'dark'; lintel?: 'flat' | 'arch' | 'none'; paleAccents?: boolean;
  sash?: 'plain' | 'transom' | 'six-over-six'; trimDensity?: 'restrained' | 'ornate';
  wallMaterial?: 'brick' | 'smooth';
  atticWindows?: boolean;
  trim?: { frames: number; lintels: number; cornice: number; courses: number; quoins: number; arches: number };
  confidence: number; profileId?: string;
}
export interface StreetAppearanceEvidence {
  id: string; kind: 'municipal-panorama' | 'user-reference';
  captureDate?: string; sha256: string; url?: string; panoramaId?: string;
  inference: 'agent-visual-review' | 'model'; model?: string;
  quality: number; notes: string;
}
export interface StreetAppearanceProfile {
  id: string; streetName: string; revision: string;
  segment: readonly [StreetPoint, StreetPoint]; side: -1 | 1;
  reachM: number; confidence: number; assemblyM: number;
  /** Each joint recipe is observed as one combination, never independently shuffled. */
  recipes: Array<{ weight: number; recipe: ArchitecturalRecipe; yearMin?: number; yearMax?: number }>;
  evidence: StreetAppearanceEvidence[];
  status: 'pilot' | 'reviewed'; holdout?: boolean;
  /** Validation extent receives training prior; its own photographs never tune that prior. */
  learnedFrom?: string;
  /** Baked from all eligible surveyed street fronts, stable across streamed tiles. */
  frontages?: Array<{ buildingId: string; recipeIndex: number }>;
}
export interface StreetAppearanceStreetPath { highway?: string; points: StreetPoint[] }
export interface StreetAppearanceCatalog { schemaVersion: 1; revision: string; profiles: StreetAppearanceProfile[]; streetFrontPaths?: StreetAppearanceStreetPath[] }
export interface StreetAppearanceWall { start: StreetPoint; end: StreetPoint; normal: readonly [number, number] }
export interface StreetAppearanceBuilding { id: string; year: number | null; heightM: number }
export interface StreetAppearanceFront { building: StreetAppearanceBuilding; wall: StreetAppearanceWall; eligible?: boolean }
export type StreetAppearanceAssignments = ReadonlyMap<string, ArchitecturalRecipe>;
export const streetAppearanceAssignmentKey = (profile: Pick<StreetAppearanceProfile, 'id' | 'revision'>, buildingId: string) => JSON.stringify([profile.id, profile.revision, buildingId]);
const frontageCache = new WeakMap<StreetAppearanceProfile,Map<string,number>>();
const hash = (text: string) => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };
export function profileLocation(profile: StreetAppearanceProfile, point: StreetPoint) {
  const [a, b] = profile.segment, kx = 111320 * Math.cos(a[1] * Math.PI / 180), ky = 110540;
  const dx = (b[0] - a[0]) * kx, dy = (b[1] - a[1]) * ky, lengthM = Math.hypot(dx, dy);
  if (lengthM < 1) return undefined;
  const px = (point[0] - a[0]) * kx, py = (point[1] - a[1]) * ky;
  return { alongM: (px * dx + py * dy) / lengthM, depthM: (dx * py - dy * px) / lengthM, lengthM, dx, dy };
}
/** Normal must point out of the wall in east/north coordinates. Back/courtyard walls fail facing. */
export function matchStreetAppearanceProfile(profiles: readonly StreetAppearanceProfile[], wall: StreetAppearanceWall) {
  const midpoint: StreetPoint = [(wall.start[0] + wall.end[0]) / 2, (wall.start[1] + wall.end[1]) / 2];
  let best: { profile: StreetAppearanceProfile; alongM: number; lengthM: number; score: number } | undefined;
  for (const profile of profiles) {
    if ((profile.holdout && !profile.learnedFrom) || profile.confidence < .45 || !profile.evidence.some(e => e.quality >= .45)) continue;
    const loc = profileLocation(profile, midpoint); if (!loc) continue;
    if (loc.alongM < 0 || loc.alongM > loc.lengthM || loc.depthM * profile.side <= 0 || Math.abs(loc.depthM) > profile.reachM) continue;
    const inwardX = profile.side * loc.dy / loc.lengthM, inwardY = -profile.side * loc.dx / loc.lengthM;
    const normalLength = Math.hypot(...wall.normal); if (!normalLength) continue;
    const facing = (wall.normal[0] * inwardX + wall.normal[1] * inwardY) / normalLength;
    if (facing < .65) continue;
    const score = profile.confidence * facing / (1 + Math.abs(loc.depthM) / profile.reachM);
    if (!best || score > best.score || (score === best.score && profile.id < best.profile.id)) best = { profile, alongM: loc.alongM, lengthM: loc.lengthM, score };
  }
  return best;
}
const eligibleRecipes = (profile: StreetAppearanceProfile, building: StreetAppearanceBuilding) => profile.recipes.filter(x => x.weight > 0 && x.recipe.confidence >= .45 && !(building.heightM > 28 && ['canal','c19','school'].includes(x.recipe.period)) && (building.year == null || ((x.yearMin == null || building.year >= x.yearMin) && (x.yearMax == null || building.year <= x.yearMax))));
const resolvedRecipe = (profile: StreetAppearanceProfile, recipe: ArchitecturalRecipe): ArchitecturalRecipe => ({ ...recipe, confidence: Math.min(recipe.confidence, profile.confidence), profileId: profile.id });

/** Compile once from a complete segment cohort (or tile plus its segment halo).
 * Holes, hidden walls, non-street fronts and curated appearance must be excluded by
 * the caller. Split outlines of one real building count once per street side;
 * corner faces belong to separate profile cohorts. No exact facade registration.
 */
export function compileStreetAppearanceAssignments(profiles: readonly StreetAppearanceProfile[], fronts: readonly StreetAppearanceFront[]): Map<string, ArchitecturalRecipe> {
  type Member = { key: string; id: string; profile: StreetAppearanceProfile; choices: ReturnType<typeof eligibleRecipes>; intervals: Array<[number,number]>; alongM: number; widthM: number };
  const members = new Map<string,Member>();
  for (const front of fronts) {
    if (front.eligible === false) continue;
    const match = matchStreetAppearanceProfile(profiles, front.wall); if (!match) continue;
    const choices = eligibleRecipes(match.profile, front.building); if (!choices.length) continue;
    const key = streetAppearanceAssignmentKey(match.profile, front.building.id);
    const a = profileLocation(match.profile, front.wall.start)!, b = profileLocation(match.profile, front.wall.end)!;
    const start = Math.max(0, Math.min(a.alongM,b.alongM)), end = Math.min(match.lengthM, Math.max(a.alongM,b.alongM));
    if (end - start < .1) continue;
    const existing = members.get(key);
    if (existing) {
      // Duplicated parts with conflicting source dates use only recipes valid for all parts.
      existing.choices = existing.choices.filter(recipe => choices.includes(recipe));
      existing.intervals.push([start,end]);
    } else members.set(key,{key,id:front.building.id,profile:match.profile,choices,intervals:[[start,end]],alongM:0,widthM:0});
  }
  const cohorts = new Map<string,Member[]>();
  for (const member of members.values()) {
    if (!member.choices.length) continue;
    const intervals = member.intervals.sort((a,b)=>a[0]-b[0] || a[1]-b[1]);
    let start = intervals[0][0], end = intervals[0][1]; member.alongM = start;
    for (const interval of intervals.slice(1)) { if (interval[0] <= end) end = Math.max(end,interval[1]); else { member.widthM += end-start; start=interval[0];end=interval[1]; } }
    member.widthM += end-start;
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
    records.push({buildingId,recipeIndex});
  }
  return records.sort((a,b)=>a.buildingId.localeCompare(b.buildingId));
}
/** Normal must point out of the wall in east/north coordinates. Back/courtyard walls fail facing. */
export function recipeForWall(profiles: readonly StreetAppearanceProfile[], wall: StreetAppearanceWall, building: StreetAppearanceBuilding, assignments?: StreetAppearanceAssignments): ArchitecturalRecipe | undefined {
  const best=matchStreetAppearanceProfile(profiles,wall);if(!best)return undefined;
  const choices = eligibleRecipes(best.profile,building);if(!choices.length)return undefined;
  if(best.profile.frontages){
    let frontages=frontageCache.get(best.profile);
    if(!frontages){frontages=new Map(best.profile.frontages.map(front=>[front.buildingId,front.recipeIndex]));frontageCache.set(best.profile,frontages);}
    const recipeIndex=frontages.get(building.id);
    if(recipeIndex!=null){const selected=best.profile.recipes[recipeIndex];return selected&&choices.includes(selected)?resolvedRecipe(best.profile,selected.recipe):undefined;}
  }
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
    for (const { weight, recipe: r, yearMin, yearMax } of p.recipes) {
      if (!Number.isFinite(weight) || weight <= 0 || !r || !['masonry', 'punched', 'ribbon', 'curtain'].includes(r.family) || !['canal', 'c19', 'school', 'postwar', 'modern', 'tower'].includes(r.period) || !unit(r.confidence)) throw Error('invalid architectural recipe');
      if (yearMin != null && !Number.isFinite(yearMin) || yearMax != null && !Number.isFinite(yearMax) || yearMin != null && yearMax != null && yearMin > yearMax) throw Error('invalid period range');
      for (const hex of [r.wallHex, r.frameHex]) if (hex != null && !/^#[a-f0-9]{6}$/i.test(hex)) throw Error('invalid recipe colour');
      for (const ratio of [r.windowWidth, r.windowHeight]) if (ratio != null && !unit(ratio)) throw Error('invalid opening fraction');
      for (const scale of [r.bayScale, r.storeyScale, r.groundScale]) if (scale != null && (!Number.isFinite(scale) || scale < .5 || scale > 2)) throw Error('invalid recipe scale');
      if (r.windowProportions != null && !['tall','balanced','wide'].includes(r.windowProportions) || r.frameColor != null && !['pale','dark'].includes(r.frameColor) || r.lintel != null && !['flat','arch','none'].includes(r.lintel) || r.paleAccents != null && typeof r.paleAccents !== 'boolean') throw Error('invalid recipe accent');
      if(r.sash!=null&&!['plain','transom','six-over-six'].includes(r.sash)||r.trimDensity!=null&&!['restrained','ornate'].includes(r.trimDensity))throw Error('invalid recipe detail');
      if(r.wallMaterial!=null&&!['brick','smooth'].includes(r.wallMaterial))throw Error('invalid recipe wall material');
      if(r.atticWindows!=null&&typeof r.atticWindows!=='boolean')throw Error('invalid recipe attic window hint');
      if (r.trim && ['frames','lintels','cornice','courses','quoins','arches'].some(key => !unit(r.trim![key as keyof NonNullable<ArchitecturalRecipe['trim']>]))) throw Error('invalid recipe trim');
    }
    if(p.frontages!=null){
      if(!Array.isArray(p.frontages))throw Error('invalid baked frontages');const buildingIds=new Set<string>();
      for(const front of p.frontages){if(!front||typeof front.buildingId!=='string'||!front.buildingId||buildingIds.has(front.buildingId)||!Number.isInteger(front.recipeIndex)||front.recipeIndex<0||front.recipeIndex>=p.recipes.length)throw Error('invalid baked frontage');buildingIds.add(front.buildingId);}
    }
  }
  for (const p of c.profiles) if (p.learnedFrom != null && (typeof p.learnedFrom !== 'string' || !c.profiles.some(training => training.id === p.learnedFrom && !training.holdout && JSON.stringify(training.recipes) === JSON.stringify(p.recipes)))) throw Error('invalid holdout transfer');
  return c;
}
