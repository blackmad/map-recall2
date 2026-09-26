/** Pure mesh evidence, never a roof classification. Coordinates are scene [x,y,z], y up. */
export const ROOF_COMPONENT_VERSION='source-labelled-roof-components/v1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const round=v=>Number(v.toFixed(3));
const range=values=>[Math.min(...values),Math.max(...values)];
function normalArea(ring){
  const n=[0,0,0];for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length];n[0]+=(p[1]-q[1])*(p[2]+q[2]);n[1]+=(p[2]-q[2])*(p[0]+q[0]);n[2]+=(p[0]-q[0])*(p[1]+q[1]);}
  const size=Math.hypot(...n);return {area:size/2,normal:size?n.map(v=>v/size*(n[1]<0?-1:1)):[0,1,0]};
}
const edges=rings=>rings.flatMap(r=>r.map((p,i)=>[p,r[(i+1)%r.length]]));
const horizontalLength=([a,b])=>Math.hypot(b[0]-a[0],b[2]-a[2]);
/** Nontrivial approximately collinear projected edge overlap; height checked at both overlap ends. */
function edgeRelation(a,b,tolerance,minOverlap){
  const length=horizontalLength(a);if(length<minOverlap||horizontalLength(b)<minOverlap)return null;
  const ux=(a[1][0]-a[0][0])/length,uz=(a[1][2]-a[0][2])/length;
  const project=p=>({t:(p[0]-a[0][0])*ux+(p[2]-a[0][2])*uz,d:Math.abs((p[0]-a[0][0])*uz-(p[2]-a[0][2])*ux)});
  const p=project(b[0]),q=project(b[1]);if(Math.max(p.d,q.d)>tolerance)return null;
  const lo=Math.max(0,Math.min(p.t,q.t)),hi=Math.min(length,Math.max(p.t,q.t));if(hi-lo<minOverlap||Math.abs(q.t-p.t)<1e-8)return null;
  const heights=t=>[a[0][1]+t/length*(a[1][1]-a[0][1]),b[0][1]+(t-p.t)/(q.t-p.t)*(b[1][1]-b[0][1])];
  const differences=[lo,hi].map(t=>{const h=heights(t);return Math.abs(h[0]-h[1]);});
  return {overlapM:hi-lo,projectedGapM:Math.max(p.d,q.d),maxHeightGapM:Math.max(...differences)};
}
function segmentDistance(p,a,b){const dx=b[0]-a[0],dz=b[2]-a[2],d=dx*dx+dz*dz,t=d?clamp(((p[0]-a[0])*dx+(p[2]-a[2])*dz)/d,0,1):0;return Math.hypot(p[0]-a[0]-t*dx,p[2]-a[2]-t*dz);}
function projectedDistance(a,b){
  const cross=(p,q,r)=>(q[0]-p[0])*(r[2]-p[2])-(q[2]-p[2])*(r[0]-p[0]);
  const c=[cross(a[0],a[1],b[0]),cross(a[0],a[1],b[1]),cross(b[0],b[1],a[0]),cross(b[0],b[1],a[1])];
  if(c[0]*c[1]<0&&c[2]*c[3]<0)return 0;
  return Math.min(segmentDistance(a[0],...b),segmentDistance(a[1],...b),segmentDistance(b[0],...a),segmentDistance(b[1],...a));
}
export function roofFrontageComponents(building,frontage,options={}){
  const cfg={flatSlopeDeg:12,edgeToleranceM:.4,edgeHeightToleranceM:.4,minEdgeOverlapM:.25,frontProximityM:2,lowerLevelGapM:2,reviewMinAreaM2:1,reviewMinProjectedAreaM2:.25,reviewMinRiseM:.5,reviewMinFrontContactM:.5,...options};
  const a=[frontage.localStart[0],0,frontage.localStart[1]],b=[frontage.localEnd[0],0,frontage.localEnd[1]],wall=[a,b],length=horizontalLength(wall);
  if(!Number.isFinite(length)||length<=0)throw Error('Nonzero finite frontage required');
  const ux=(b[0]-a[0])/length,uz=(b[2]-a[2])/length;
  const faces=building.surfaces.flatMap((surface,surfaceIndex)=>{
    if(surface.type!=='roof'||!surface.rings?.[0]?.length)return[];
    const n=normalArea(surface.rings[0]),area=n.area-surface.rings.slice(1).reduce((sum,r)=>sum+normalArea(r).area,0);
    if(area<=1e-8)return[]; // Numerical degeneracy only; no building-wide area suppression.
    const vertices=surface.rings.flat(),es=edges(surface.rings),slope=Math.acos(clamp(n.normal[1],-1,1))*180/Math.PI;
    const along=range(vertices.map(p=>(p[0]-a[0])*ux+(p[2]-a[2])*uz)),overlap=Math.max(0,Math.min(length,along[1])-Math.max(0,along[0]));
    // Only external boundary edges establish frontage association; hole boundaries are not frontage.
    const outerEdges=edges([surface.rings[0]]),contacts=outerEdges.map(e=>edgeRelation(wall,e,cfg.edgeToleranceM,cfg.minEdgeOverlapM)).filter(Boolean);
    const distance=Math.min(...outerEdges.map(e=>projectedDistance(wall,e)));
    return[{surfaceIndex,areaM2:area,projectedAreaM2:area*Math.abs(n.normal[1]),slopeDeg:slope,heightRange:range(vertices.map(p=>p[1])),geometryQuality:{subHalfSquareMetre:area<.5,subSquareMetre:area<1,note:area<1?'Tiny face retained; inspect fitting/segmentation artifact before treating as roof volume.':null},edges:es,frontage:{overlapM:overlap,nearestProjectedEdgeM:distance,edgeContactOverlapM:contacts.reduce((sum,c)=>sum+c.overlapM,0),association:contacts.length?'projected-edge-contact':distance<=cfg.frontProximityM&&overlap>=cfg.minEdgeOverlapM?'projected-nearby':'not-frontage-linked'}}];
  });
  const adjacency=(f,g)=>f.edges.flatMap(e=>g.edges.map(other=>edgeRelation(e,other,cfg.edgeToleranceM,cfg.minEdgeOverlapM))).filter(r=>r&&r.maxHeightGapM<=cfg.edgeHeightToleranceM);
  const flat=faces.filter(f=>f.slopeDeg<cfg.flatSlopeDeg),groups=[];
  const unseen=new Set(flat.map(f=>f.surfaceIndex));
  for(const seed of flat){if(!unseen.delete(seed.surfaceIndex))continue;const group=[seed];for(let i=0;i<group.length;i++)for(const f of flat)if(unseen.has(f.surfaceIndex)&&adjacency(group[i],f).length){unseen.delete(f.surfaceIndex);group.push(f);}groups.push(group);}
  const decks=groups.map(group=>({sourceFaceIndices:group.map(f=>f.surfaceIndex),projectedAreaM2:group.reduce((s,f)=>s+f.projectedAreaM2,0),heightRange:range(group.flatMap(f=>f.heightRange))})).sort((a,b)=>b.projectedAreaM2-a.projectedAreaM2);
  const main=decks[0]??null,mainFaces=main?faces.filter(f=>main.sourceFaceIndices.includes(f.surfaceIndex)):[];
  const pitched=faces.filter(f=>f.slopeDeg>=cfg.flatSlopeDeg).map(f=>{
    const projectedContacts=mainFaces.flatMap(deck=>f.edges.flatMap(e=>deck.edges.map(other=>edgeRelation(e,other,cfg.edgeToleranceM,cfg.minEdgeOverlapM))).filter(Boolean).map(r=>({surfaceIndex:deck.surfaceIndex,...r})));
    const adjoining=projectedContacts.filter(r=>r.maxHeightGapM<=cfg.edgeHeightToleranceM);
    const gap=main?main.heightRange[0]-f.heightRange[1]:null;
    const verticalRelation=!main?'no-reference-deck':gap>cfg.lowerLevelGapM?'lower-than-reference-deck':f.heightRange[0]>main.heightRange[1]+cfg.lowerLevelGapM?'above-reference-deck':f.heightRange[1]>=main.heightRange[0]-cfg.edgeHeightToleranceM&&f.heightRange[0]<=main.heightRange[1]+cfg.edgeHeightToleranceM?'height-compatible':'separate-height';
    const {edges,...facts}=f;return {...facts,deckRelation:{verticalRelation,belowDeckGapM:gap,adjoiningReferenceFaceIndices:[...new Set(adjoining.map(a=>a.surfaceIndex))],compatibleEdgeContacts:adjoining,projectedBoundaryContacts:projectedContacts}};
  });
  const linked=pitched.filter(f=>f.frontage.association!=='not-frontage-linked');
  const substantive=linked.filter(f=>f.frontage.association==='projected-edge-contact'&&f.frontage.edgeContactOverlapM>=cfg.reviewMinFrontContactM&&f.areaM2>=cfg.reviewMinAreaM2&&f.projectedAreaM2>=cfg.reviewMinProjectedAreaM2&&f.heightRange[1]-f.heightRange[0]>=cfg.reviewMinRiseM);
  const compact=v=>JSON.parse(JSON.stringify(v,(_k,x)=>typeof x==='number'?round(x):x));
  return compact({version:ROOF_COMPONENT_VERSION,source:'3DBAG-LoD2.2-source-face-diagnostic',buildingId:building.id,coordinateSystem:'scene metres, Y up; no new NAP conversion',thresholds:cfg,frontageLengthM:length,retainedRoofFaceCount:faces.length,flatDeckCandidates:decks,mainDeckCandidate:main?{...main,selection:'largest projected-area connected flat component; provisional reference only'}:null,pitchedFaces:pitched,facts:{noPitchObservedInMesh:pitched.length===0,frontageLinkedPitchFaceIndices:linked.map(f=>f.surfaceIndex),substantiveFrontagePitchFaceIndices:substantive.map(f=>f.surfaceIndex),substantiveMainDeckHeightFrontagePitchFaceIndices:substantive.filter(f=>f.deckRelation.verticalRelation==='height-compatible').map(f=>f.surfaceIndex),lowerLevelPitchFaceIndices:pitched.filter(f=>f.deckRelation.verticalRelation==='lower-than-reference-deck').map(f=>f.surfaceIndex),mainDeckAdjoiningFrontPitchFaceIndices:linked.filter(f=>f.frontage.association==='projected-edge-contact'&&f.deckRelation.adjoiningReferenceFaceIndices.length).map(f=>f.surfaceIndex)},absenceIsEvidenceOfAbsence:false,authoritativeRoofClass:null,caveats:['Positive mesh components are hypotheses, not surveyed truth.','No observed pitch in simplified mesh does not refute visible image pitch.','Projected proximity alone does not prove frontage ownership or physical roof adjacency.','Substantive facts use explicit absolute-size thresholds for review routing, not roof truth; every face remains retained.','A largest flat component can be a low annex in a complex building; inspect reference height and face IDs.','Facade ornament, materials, occupancy and roof class are not inferred.']});
}
