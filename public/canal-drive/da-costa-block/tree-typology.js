/** Loose inventory-driven priors, not surveyed crowns. Three shared sphere instances per tree. */
export const TREE_TYPOLOGY_VERSION='inventory-crown-priors/v1';
const nursery=name=>'https://www.vdberk.com/trees/'+name+'/';
const rules=[
  [/^platanus (?:hispanica|acerifolia) 'tremonia'$/,'pyramidal','cultivar-prior',nursery('platanus-hispanica-tremonia')],
  [/^platanus (?:hispanica|acerifolia)$/,'rounded','species-prior',nursery('platanus-hispanica')],
  [/^ulmus 'new horizon'$/,'pyramidal','cultivar-prior',nursery('ulmus-new-horizon')],
  [/^ulmus 'dodoens'$/,'pyramidal','cultivar-prior','https://www.vdberk.nl/bomen/Ulmus-Dodoens/'],
  [/^ulmus hollandica 'vegeta'$/,'pyramidal','cultivar-prior',nursery('ulmus-hollandica-vegeta')],
  [/^ulmus 'clusius'$/,'upright-oval','cultivar-prior',nursery('ulmus-clusius')],
  [/^ulmus glabra$/,'upright-oval','species-prior',nursery('ulmus-glabra')],
  [/^ginkgo biloba$/,'upright-oval','species-prior','https://www.rhs.org.uk/plants/7990/ginkgo-biloba/details'],
  [/^(?:cupressocyparis|cuprocyparis|cupressus) leylandii$/,'conical-evergreen','species-prior','https://www.rhs.org.uk/plants/321515/cupressus-%C3%97-leylandii/details'],
  [/^prunus serrulata 'kanzan'$/,'vase','cultivar-prior',nursery('prunus-serrulata-kanzan')],
];
export function normalizedTreeName(value){return String(value||'').toLowerCase().replace(/[’‘`]/g,"'").replace(/×/g,' ').replace(/\bx\s+/g,'').replace(/\s+/g,' ').trim();}
function numberSeed(id){let n=2166136261;for(const c of String(id??''))n=Math.imul(n^c.charCodeAt(0),16777619);return(n>>>0)/4294967296;}

export function treeTypology(tree){
  const type=String(tree.type||'').trim().toLowerCase();
  if(type==='stobbe')return null;
  const species=normalizedTreeName(tree.species),rule=rules.find(([pattern])=>pattern.test(species));
  const managed=type==='gekandelaberde boom';
  const archetype=managed?'candelabra-pruned':rule?.[1]||'rounded';
  const validHeight=Number.isFinite(tree.height)&&tree.height>0&&tree.height<=60;
  // Do not substitute a species' potential adult height for this inventory record.
  const height=validHeight?tree.height:9;
  const heightClassKnown=/\d/.test(String(tree.heightClass||''));
  const heightSource=validHeight&&heightClassKnown?'inventory-height-class-proxy':'authored-height-fallback';
  const h=height,baseRadius=Math.max(1.3,h*.22),variation=.96+numberSeed(tree.id)*.04;
  const r=baseRadius*variation;
  const lobe=(dx,y,dz,sx,sy,sz,tone)=>({offset:[dx,y,dz],scale:[sx,sy,sz],tone});
  let lobes;
  if(archetype==='pyramidal')lobes=[lobe(0,h*.65,0,r*.84,h*.19,r*.78,2),lobe(0,h*.80,0,r*.62,h*.16,r*.59,0),lobe(0,h*.90,0,r*.34,h*.10,r*.34,1)];
  else if(archetype==='upright-oval')lobes=[lobe(0,h*.73,0,r*.80,h*.27,r*.72,0),lobe(-r*.28,h*.68,r*.14,r*.51,h*.22,r*.48,1),lobe(r*.25,h*.65,-r*.12,r*.5,h*.23,r*.48,2)];
  else if(archetype==='conical-evergreen')lobes=[lobe(0,h*.55,0,r*.70,h*.24,r*.70,2),lobe(0,h*.74,0,r*.49,h*.19,r*.49,0),lobe(0,h*.90,0,r*.25,h*.10,r*.25,1)];
  else if(archetype==='vase')lobes=[lobe(0,h*.65,0,r*.6,h*.19,r*.58,2),lobe(-r*.4,h*.84,0,r*.70,h*.16,r*.75,0),lobe(r*.4,h*.84,0,r*.70,h*.16,r*.75,1)];
  else if(archetype==='candelabra-pruned')lobes=[lobe(0,h*.85,0,r*.43,h*.15,r*.50,0),lobe(-r*.5,h*.82,0,r*.36,h*.14,r*.40,1),lobe(r*.5,h*.82,0,r*.36,h*.14,r*.40,2)];
  else lobes=[lobe(0,h*.76,0,r,h*.24,r*.88,0),lobe(-r*.48,h*.72,r*.25,r*.65,h*.18,r*.67,1),lobe(r*.44,h*.70,-r*.23,r*.66,h*.22,r*.65,2)];
  return {version:TREE_TYPOLOGY_VERSION,id:tree.id,position:[...tree.position],height,archetype,lobes,
    trunkHeight:h*(managed?.78:.60),trunkWidth:.35,
    provenance:{position:'municipal inventory',height:heightSource,heightClass:tree.heightClass??null,
      crownBasis:managed?'explicit-inventory-management':rule?.[2]||'authored-fallback',reference:managed?null:rule?.[3]||null,
      species:tree.species??null,type:tree.type??null,measuredCrown:false,
      note:'Shape, width, clearance and summer foliage are authored priors. Not freely growing does not imply pollarding; age, pruning and actual crown extent are unverified.'}};
}
