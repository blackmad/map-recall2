/** Loose inventory-driven priors, not surveyed crowns. Three shared faceted crown instances per tree. */
export const TREE_TYPOLOGY_VERSION='inventory-crown-priors/v2';
const nursery=name=>'https://www.vdberk.com/trees/'+name+'/';
const rules=[
  [/^taxodium distichum$/,'conical-deciduous','species-prior',nursery('taxodium-distichum')],
  [/^larix decidua$/,'conical-deciduous','species-prior',nursery('larix-decidua')],
  [/^larix kaempferi$/,'conical-deciduous','species-prior',nursery('larix-kaempferi')],
  [/^thuja plicata$/,'conical-evergreen','species-prior',nursery('thuja-plicata')],
  [/^thuja occidentalis$/,'conical-evergreen','species-prior',nursery('thuja-occidentalis')],
  [/^chamaecyparis lawsoniana$/,'conical-evergreen','species-prior',nursery('chamaecyparis-lawsoniana')],
  [/^picea omorika$/,'conical-evergreen','species-prior',nursery('picea-omorika')],
  [/^salix babylonica$/,'weeping','species-prior',nursery('salix-babylonica')],
  [/^taxus baccata 'fastigiata'$/,'columnar','cultivar-prior',nursery('taxus-baccata-fastigiata')],
  [/^betula pubescens$/,"upright-oval","species-prior",nursery("betula-pubescens")],
  [/^alnus cordata$/,"pyramidal","species-prior",nursery("alnus-cordata")],
  [/^quercus palustris$/,"pyramidal","species-prior",nursery("quercus-palustris")],
  [/^populus canescens$/,"irregular-spreading","species-prior",nursery("populus-canescens")],
  [/^populus canadensis 'robusta'$/,"pyramidal","cultivar-prior",nursery("populus-canadensis-robusta")],
  [/^fraxinus excelsior 'westhof's glorie'$/,"airy-oval","cultivar-prior",nursery("fraxinus-excelsior-westhof-s-glorie")],
  [/^tilia europaea 'pallida'$/,"pyramidal","cultivar-prior",nursery("tilia-europaea-pallida")],
  [/^tilia europaea 'euchlora'$/,"domed","cultivar-prior",nursery("tilia-europaea-euchlora")],
  [/^tilia tomentosa 'brabant'$/,"pyramidal","cultivar-prior",nursery("tilia-tomentosa-brabant")],
  [/^carpinus betulus 'fastigiata'$/,"pyramidal","cultivar-prior",nursery("carpinus-betulus-fastigiata")],
  [/^carpinus betulus 'frans fontaine'$/,"columnar","cultivar-prior",nursery("carpinus-betulus-frans-fontaine")],
  [/^ulmus 'lobel'$/,"pyramidal","cultivar-prior",nursery("ulmus-lobel")],
  [/^liquidambar styraciflua$/,"pyramidal","species-prior",nursery("liquidambar-styraciflua")],
  [/^pinus sylvestris$/,"irregular-spreading","species-prior",nursery("pinus-sylvestris")],
  [/^quercus robur$/,'irregular-spreading','species-prior',nursery('quercus-robur')],
  [/^fraxinus excelsior$/,'airy-oval','species-prior',nursery('fraxinus-excelsior')],
  [/^salix alba$/,'upright-oval','species-prior',nursery('salix-alba')],
  [/^acer campestre$/,'rounded','species-prior',nursery('acer-campestre')],
  [/^alnus glutinosa$/,'pyramidal','species-prior',nursery('alnus-glutinosa')],
  [/^ulmus minor$/,'upright-oval','species-prior',nursery('ulmus-minor')],
  [/^tilia europaea$/,'domed','species-prior',nursery('tilia-europaea')],
  [/^tilia cordata$/,'domed','species-prior',nursery('tilia-cordata')],
  [/^tilia americana$/,'domed','species-prior',nursery('tilia-americana')],
  [/^tilia platyphyllos$/,'domed','species-prior',nursery('tilia-platyphyllos')],
  [/^acer pseudoplatanus$/,'domed','species-prior',nursery('acer-pseudoplatanus')],
  [/^carpinus betulus$/,'domed','species-prior',nursery('carpinus-betulus')],
  [/^crataegus monogyna$/,'rounded','species-prior',nursery('crataegus-monogyna')],
  [/^fagus sylvatica$/,'domed','species-prior',nursery('fagus-sylvatica')],
  [/^metasequoia glyptostroboides$/,'conical-deciduous','species-prior',nursery('metasequoia-glyptostroboides')],
  [/^pterocarya fraxinifolia$/,'irregular-spreading','species-prior',nursery('pterocarya-fraxinifolia')],
  [/^aesculus hippocastanum$/,'domed','species-prior',nursery('aesculus-hippocastanum')],
  [/^aesculus hippocastanum 'baumannii'$/,'domed','cultivar-prior',nursery('aesculus-hippocastanum-baumannii')],
  [/^ulmus 'columella'$/,'columnar','cultivar-prior',nursery('ulmus-columella')],
  [/^pyrus calleryana 'chanticleer'$/,'pyramidal','cultivar-prior',nursery('pyrus-calleryana-chanticleer')],
  [/^robinia pseudoacacia 'bessoniana'$/,'airy-oval','cultivar-prior',nursery('robinia-pseudoacacia-bessoniana')],
  [/^robinia pseudoacacia$/,'airy-oval','species-prior',nursery('robinia-pseudoacacia')],
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
  [/^betula pendula$/,'upright-oval','species-prior',nursery('betula-pendula')],
  [/^populus nigra 'italica'$/,'columnar','cultivar-prior',nursery('populus-nigra-italica')],
  [/^picea abies$/,'conical-evergreen','species-prior',nursery('picea-abies')],
  [/^salix sepulcralis 'chrysocoma'$/,'weeping','cultivar-prior',nursery('salix-sepulcralis-chrysocoma')],
];
export function normalizedTreeName(value){return String(value||'').toLowerCase().replace(/[’‘`]/g,"'").replace(/×/g,' ').replace(/\bx\s+/g,'').replace(/\s+/g,' ').trim();}
function numberSeed(id){let n=2166136261;for(const c of String(id??''))n=Math.imul(n^c.charCodeAt(0),16777619);return(n>>>0)/4294967296;}

export function treeTypology(tree){
  const type=String(tree.type||'').trim().toLowerCase();
  if(type==='stobbe')return null;
  const species=normalizedTreeName(tree.species),rule=rules.find(([pattern])=>pattern.test(species));
  const management={'gekandelaberde boom':'candelabra-pruned','knotboom':'pollarded','leiboom':'trained-flat'}[type];
  const managed=!!management;
  const archetype=management||rule?.[1]||'rounded';
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
  else if(archetype==='conical-evergreen'||archetype==='conical-deciduous')lobes=[lobe(0,h*.55,0,r*.70,h*.24,r*.70,2),lobe(0,h*.74,0,r*.49,h*.19,r*.49,0),lobe(0,h*.90,0,r*.25,h*.10,r*.25,1)];
  else if(archetype==='vase')lobes=[lobe(0,h*.65,0,r*.6,h*.19,r*.58,2),lobe(-r*.4,h*.84,0,r*.70,h*.16,r*.75,0),lobe(r*.4,h*.84,0,r*.70,h*.16,r*.75,1)];
  else if(archetype==='candelabra-pruned')lobes=[lobe(0,h*.85,0,r*.43,h*.15,r*.50,0),lobe(-r*.5,h*.82,0,r*.36,h*.14,r*.40,1),lobe(r*.5,h*.82,0,r*.36,h*.14,r*.40,2)];
  else if(archetype==='pollarded')lobes=[lobe(0,h*.83,0,r*.62,h*.17,r*.60,0),lobe(-r*.35,h*.79,0,r*.44,h*.17,r*.44,1),lobe(r*.35,h*.79,0,r*.44,h*.17,r*.44,2)];
  else if(archetype==='trained-flat')lobes=[lobe(0,h*.80,0,r*.55,h*.20,r*.18,0),lobe(-r*.52,h*.76,0,r*.40,h*.18,r*.18,1),lobe(r*.52,h*.76,0,r*.40,h*.18,r*.18,2)];
  else if(archetype==='columnar')lobes=[lobe(0,h*.59,0,r*.39,h*.30,r*.36,2),lobe(0,h*.77,0,r*.32,h*.23,r*.31,0),lobe(0,h*.91,0,r*.18,h*.09,r*.18,1)];
  else if(archetype==='weeping')lobes=[lobe(0,h*.75,0,r*.70,h*.25,r*.70,0),lobe(-r*.36,h*.57,0,r*.62,h*.35,r*.63,1),lobe(r*.36,h*.57,0,r*.62,h*.35,r*.63,2)];
  else if(archetype==='domed')lobes=[lobe(0,h*.75,0,r*.90,h*.25,r*.88,0),lobe(-r*.42,h*.66,r*.12,r*.64,h*.22,r*.64,1),lobe(r*.42,h*.66,-r*.14,r*.64,h*.22,r*.64,2)];
  else if(archetype==='irregular-spreading')lobes=[lobe(-r*.20,h*.76,0,r*.78,h*.24,r*.85,0),lobe(-r*.43,h*.61,r*.21,r*.64,h*.20,r*.70,1),lobe(r*.43,h*.67,-r*.18,r*.64,h*.23,r*.64,2)];
  else if(archetype==='airy-oval')lobes=[lobe(0,h*.79,0,r*.66,h*.21,r*.64,0),lobe(-r*.48,h*.61,r*.20,r*.52,h*.19,r*.48,1),lobe(r*.47,h*.64,-r*.23,r*.53,h*.20,r*.50,2)];
  else lobes=[lobe(0,h*.76,0,r,h*.24,r*.88,0),lobe(-r*.48,h*.72,r*.25,r*.65,h*.18,r*.67,1),lobe(r*.44,h*.70,-r*.23,r*.66,h*.22,r*.65,2)];
  // These summer colours are art direction, not observations from the inventory.
  const foliage=archetype==='conical-evergreen'||/^(?:pinus|taxus)\b/.test(species)?'#496955':species.startsWith('salix')?'#88a06c':species.startsWith('betula')?'#91ad6e':species.startsWith('fagus')?'#587b51':species.startsWith('quercus')?'#648357':species.startsWith('robinia')?'#94a965':species.startsWith('tilia')?'#789655':'#78945a';
  const bark=species.startsWith('betula')?'#d8d9c5':species.startsWith('platanus')?'#aaa68a':species.startsWith('fagus')?'#8a8b80':species.startsWith('metasequoia')?'#935d47':'#665741';
  return {version:TREE_TYPOLOGY_VERSION,id:tree.id,position:[...tree.position],height,archetype,lobes,
    trunkHeight:h*(managed?.78:.60),trunkWidth:Math.min(.52,Math.max(.14,h*.023)),
    foliage,bark,crownGeometry:archetype.startsWith('conical-')?'cone':'faceted',rotation:numberSeed(tree.id)*Math.PI*2,
    provenance:{position:'municipal inventory',height:heightSource,heightClass:tree.heightClass??null,
      crownBasis:managed?'explicit-inventory-management':rule?.[2]||'authored-fallback',reference:managed?null:rule?.[3]||null,
      species:tree.species??null,type:tree.type??null,measuredCrown:false,
      note:'Shape, width, clearance and summer foliage are authored priors. Not freely growing does not imply pollarding; age, pruning and actual crown extent are unverified.'}};
}
