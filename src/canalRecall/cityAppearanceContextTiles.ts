/** Streamable context ownership on a finer grid than heavy building geometry.
 * A compact centroid footprint assigns ownership; the streamer's one-tile margin
 * is wider than these bounded BGT features and loads edge-crossing source geometry.
 */
import { compileAppearanceTiles, type AppearanceBuilding } from './cityAppearanceTiles.js';
import { rdToLngLat } from './facade/rdNew.js';
import { createHash } from 'node:crypto';

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const RENDERED_LAYERS=['wegdeel','ondersteunendwegdeel','waterdeel','begroeidterreindeel','onbegroeidterreindeel','overbruggingsdeel','scheiding_lijn'];
const ownershipFootprint=(x:number,z:number,origin:any)=>{const d=.05,ring=[[-d,-d],[d,-d],[d,d],[-d,d],[-d,-d]].map(([dx,dz])=>rdToLngLat({x:origin.x+x+dx,y:origin.y-z-dz}));return{type:'Polygon' as const,coordinates:[ring]};};

export function compileContextTiles(context:any,zoom=16){
  if(!context?.origin||!Array.isArray(context.bounds))throw Error('Invalid context snapshot');
  const owners:AppearanceBuilding<any>[]=[];
  for(const layer of RENDERED_LAYERS)for(const [index,feature]of (context.layers?.[layer]??[]).entries()){
    const type=feature.geometry?.type;if(!['Polygon','MultiPolygon','LineString','MultiLineString'].includes(type))continue;const points=type==='Polygon'?feature.geometry.coordinates.flat(1):type==='MultiPolygon'?feature.geometry.coordinates.flat(2):type==='MultiLineString'?feature.geometry.coordinates.flat(1):feature.geometry.coordinates,xs=points.map((point:any)=>point[0]),zs=points.map((point:any)=>point[1]);
    const footprint=ownershipFootprint((Math.min(...xs)+Math.max(...xs))/2,(Math.min(...zs)+Math.max(...zs))/2,context.origin);
    const id=`context:${layer}:${feature.id??feature.properties?.identificatie??index}`,geometry={kind:'feature',layer,feature};
    owners.push({id,geometryRevision:hash(geometry),footprint,geometry});
  }
  for(const [index,tree]of (context.trees??[]).entries()){
    const [x,z]=tree.position??[];if(![x,z].every(Number.isFinite))continue;
    const footprint=ownershipFootprint(x,z,context.origin);
    const id=`context:tree:${tree.id??index}`,geometry={kind:'tree',tree};owners.push({id,geometryRevision:hash(geometry),footprint,geometry});
  }
  return compileAppearanceTiles(owners,[],{zoom,halo:0});
}
