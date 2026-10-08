import { GABLE_SHAPES, localOuterRing, roofPlanForFeature, type RoofPlan } from './roofMesh.js';
import { admittedStreetAppearanceVisualClass, type StreetAppearanceProfile } from './streetAppearance.js';

type Feature = { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown };
/** A reviewed, baked frontage may guide an unsurveyed procedural crown.
 * It never changes the native height, footprint, construction date or source facts.
 */
export function sourceVisualRoof<T extends Feature>(feature: T, profiles: readonly StreetAppearanceProfile[]): { feature: T; plan: RoofPlan } | undefined {
  const p = feature.properties;
  const geometry = feature.geometry as { type?: string; coordinates?: unknown[] };
  // A generic crown is withheld on open courts and multipart source geometry.
  if (geometry.type !== 'Polygon' || !geometry.coordinates || geometry.coordinates.length !== 1) return;
  if (!p.facade || p.kitWall || p.frontCarrier || p.facadeMappedColour || p.sideColourSource === 'measured-accepted') return;
  // Roof decoration marks generated eaves. Unmarked eaves and explicit tags remain authoritative.
  if (Number(p.roofEavesHeightM) > 0 && !p.roofPlanned || p.roofShapeTag || p.roofVertices || p.roofGeometry || p.roofHeightSource === 'measured-accepted') return;
  if (!p.roofPlanned && p.roofShape && p.roofShape !== 'flat') return;
  const id = String(p.id ?? '');
  const candidates = profiles.filter(profile=>admittedStreetAppearanceVisualClass(profile)||
    profile.status==='pilot'&&!profile.holdout&&!profile.learnedFrom&&profile.buildingIds?.includes(id)&&
    profile.evidence.some(e=>e.kind==='municipal-panorama'&&e.quality>=.8&&e.inference==='agent-visual-review'&&!!e.captureDate&&Number.isFinite(Date.parse(e.captureDate))&&!!e.panoramaId&&/^https:\/\/t[1-4]\.data\.amsterdam\.nl\/panorama\//.test(e.url??'')&&/^[a-f0-9]{64}$/.test(e.sha256)));
  for (const profile of candidates) {
    const front = profile.frontages?.find(f => f.buildingId === id);
    if (!front) continue; // Complete source-cohort admission, never a tile-local guessed membership.
    const selected = profile.recipes[front.recipeIndex];
    if (!front.frontage || selected?.heightMin != null && Number(p.height) < selected.heightMin || selected?.heightMax != null && Number(p.height) > selected.heightMax) continue;
    if (selected?.frontageMin != null && front.frontage.widthM < selected.frontageMin || selected?.frontageMax != null && front.frontage.widthM > selected.frontageMax) continue;
    const recipe = selected?.recipe;
    if(recipe?.interwarFrontage&&recipe.roofFamily==='flat-parapet'){
      const height=Number(p.height),parapetM=.12;
      if(!Number.isFinite(height)||height<5)continue;
      const plan:RoofPlan={kind:'parapet',gable:'plain',riseM:parapetM,parapetM,nativeEnvelopeM:parapetM,dormers:false,chimney:false,accents:false,material:'slate',tone:.4,seed:id,keepLid:true,trimHex:recipe.wallHex??'#76564c'};
      return {feature:{...feature,properties:{...p,roofPlanned:true,roofShape:'parapet',roofEavesHeightM:height-parapetM}},plan};
    }
    if(recipe?.repeatedTerraceFrontage&&recipe.repeatedTerraceRoof){
      const t=recipe.repeatedTerraceRoof,height=Number(p.height),eaves=height-t.riseM;
      const ring=localOuterRing(feature.geometry);if(!ring||!Number.isFinite(eaves)||eaves<5)continue;
      const [lng0,lat0]=(geometry.coordinates![0] as number[][])[0],kx=111320*Math.cos(lat0*Math.PI/180);
      const point=([lng,lat]:readonly number[]):[number,number]=>[(lng-lng0)*kx,(lat-lat0)*110540];
      const start=point(front.frontage.start),end=point(front.frontage.end),dx=end[0]-start[0],dy=end[1]-start[1],length=Math.hypot(dx,dy);
      // Require a real exterior native edge; a baked line through a rear building is not a roof carrier.
      const same=(a:number[],b:number[])=>Math.hypot(a[0]-b[0],a[1]-b[1])<.03;
      if(length<8||t.widthM>=length*.6||!ring.slice(0,-1).some((a,i)=>same(a,start)&&same(ring[i+1],end)||same(a,end)&&same(ring[i+1],start)))continue;
      const area=ring.slice(0,-1).reduce((s,a,i)=>s+a[0]*ring[i+1][1]-ring[i+1][0]*a[1],0);
      const edge=ring.slice(0,-1).findIndex((a,i)=>same(a,start)&&same(ring[i+1],end));
      const sign=(area>0?1:-1)*(edge>=0?1:-1),normal:[number,number]=[sign*dy/length,-sign*dx/length];
      const plan:RoofPlan={kind:'pitched',gable:'plain',riseM:t.riseM,nativeEnvelopeM:t.riseM,dormers:false,chimney:false,accents:false,material:'slate',tone:.55,seed:id,
        repeatedTerrace:{front:{start,end,normal},widthM:t.widthM,gable:t.gable,exposedEnds:t.exposedEnds,wallHex:recipe.wallHex??'#82664f',frameHex:recipe.frameHex??'#e4e0cd',sashHex:recipe.sashHex??'#244c3d'}};
      return {feature:{...feature,properties:{...p,roofPlanned:true,roofShape:'pitched',roofEavesHeightM:eaves}},plan};
    }
    if (!recipe?.crownShape) continue;
    const official = profile.registerCrowns?.find(c => c.buildingId === id);
    const registerShape = official?.shape ?? (typeof p.monumentGable === 'string' && GABLE_SHAPES.includes(p.monumentGable as any) ? p.monumentGable : undefined);
    const roofFeature = { ...feature, properties: { ...p, facadeStyle: 'canal', monumentGable: registerShape ?? recipe.crownShape, roofPlanned: true } };
    const planned = roofPlanForFeature(roofFeature);
    if (!planned || planned.kind !== 'gable') continue;
    const bound = (p: RoofPlan): RoofPlan => ({ ...p, nativeEnvelopeM: p.riseM, chimney: false, dormers: false, accents: recipe.crownTrim ?? true, trimHex: recipe.frameHex ?? p.trimHex, pieces: p.pieces?.map(piece => ({...piece, plan: bound(piece.plan)})) });
    const explicitCrownAssembly = recipe.crownTrim != null || recipe.crownWindows != null || !!official;
    const admittedRise = Math.max(planned.riseM, Math.min(3.5, Math.max(2.6,front.frontage.widthM*.52)));
    const plan = explicitCrownAssembly ? bound({...planned,riseM:admittedRise,pieces:planned.pieces?.map(piece=>({...piece,plan:{...piece.plan,riseM:Math.min(admittedRise,Math.max(piece.plan.riseM,admittedRise*.78))}}))}) : planned;
    if(explicitCrownAssembly)plan.keepLid=true;
    if (explicitCrownAssembly) {
    const ring=localOuterRing(feature.geometry)!;
    const [lng0,lat0]=(geometry.coordinates![0] as number[][])[0],kx=111320*Math.cos(lat0*Math.PI/180);
    const point=([lng,lat]:readonly number[]):[number,number]=>[(lng-lng0)*kx,(lat-lat0)*110540];
    let start=point(front.frontage.start),end=point(front.frontage.end);
    const mx=(start[0]+end[0])/2,my=(start[1]+end[1])/2;
    let area=0;for(let i=0;i<ring.length-1;i++)area+=ring[i][0]*ring[i+1][1]-ring[i+1][0]*ring[i][1];
    let nearest=Infinity,normal:[number,number]=[0,0];
    for(let i=0;i<ring.length-1;i++) {
      const a=ring[i],b=ring[i+1],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy);if(l<.1)continue;
      const t=Math.max(0,Math.min(1,((mx-a[0])*dx+(my-a[1])*dy)/(l*l))),distance=Math.hypot(mx-a[0]-t*dx,my-a[1]-t*dy);
      if(distance<nearest){nearest=distance;normal=area>0?[dy/l,-dx/l]:[-dy/l,dx/l];}
    }
    // Averaging several exposed walls can put a baked cohort line inside its
    // concave footprint. Recover an actual parallel outer wall facing the same
    // admitted street, rather than inventing a carrier through the building.
    if(nearest>.65) {
      const streetA=point(profile.segment[0]),streetB=point(profile.segment[1]),streetDx=streetB[0]-streetA[0],streetDy=streetB[1]-streetA[1],streetLength2=streetDx*streetDx+streetDy*streetDy;
      const tx=end[0]-start[0],ty=end[1]-start[1],frontWidth=Math.hypot(tx,ty);
      let best=Infinity;
      for(let i=0;i<ring.length-1;i++) {
        const a=ring[i],b=ring[i+1],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy);
        if(l<Math.max(2.4,frontWidth*.55)||l>frontWidth*1.8||Math.abs((dx*tx+dy*ty)/(l*frontWidth))<.9)continue;
        const n:[number,number]=area>0?[dy/l,-dx/l]:[-dy/l,dx/l],cx=(a[0]+b[0])/2,cy=(a[1]+b[1])/2;
        const t=Math.max(0,Math.min(1,((cx-streetA[0])*streetDx+(cy-streetA[1])*streetDy)/streetLength2));
        const vx=streetA[0]+t*streetDx-cx,vy=streetA[1]+t*streetDy-cy,distance=Math.hypot(vx,vy);
        if(vx*n[0]+vy*n[1]<=0||distance>profile.reachM)continue;
        if(distance<best){best=distance;start=[...a];end=[...b];normal=n;nearest=0;}
      }
    }
    // Only an actual surveyed outer frontage can carry this shared crown.
    if(nearest>.65||Math.hypot(...normal)<.9)continue;
    plan.sourceCrownFront={start,end,normal,shape:plan.gable,pairedOculi:official?.windows==='paired-oculi'};
    }
    const eaves = Number(p.height) - plan.riseM;
    if (!Number.isFinite(eaves) || eaves < 4.5) continue;
    return { feature: { ...feature, properties: { ...p, roofPlanned: true, roofShape: plan.kind, roofEavesHeightM: eaves } }, plan };
  }
}
