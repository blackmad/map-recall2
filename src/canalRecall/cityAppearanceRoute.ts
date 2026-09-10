import { buildRoadGraph, findRoadRoute, nearestRoadGraphNode, type RoadGraphPoint } from './routing/roadGraph.js';
import { lngLatToRd } from './facade/rdNew.js';
export type AreaRoute={version:1;points:[number,number][];distanceM:number;streetNames:string[];legs:{fromM:number;toM:number;streetName:string|null}[];sourceSegments:number};
type Street={name?:string;highway?:string;path?:[number,number][];paths?:[number,number][][]};
const distance=(a:RoadGraphPoint,b:RoadGraphPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
export function compileAreaRoute(streets:Street[],bbox:[number,number,number,number],origin:{x:number;y:number}):AreaRoute{
  const [west,south,east,north]=bbox,pad=.00025,inside=([lat,lon]:[number,number])=>lon>=west-pad&&lon<=east+pad&&lat>=south-pad&&lat<=north+pad;
  const segments:{points:RoadGraphPoint[];metadata:{name:string}}[]=[];
  for(const street of streets){for(const path of street.paths??(street.path?[street.path]:[])){let run:RoadGraphPoint[]=[];const flush=()=>{if(run.length>1)segments.push({points:run,metadata:{name:street.name??''}});run=[];};for(let i=0;i<path.length;i++){const point=path[i],keep=inside(point)||i>0&&inside(path[i-1])||i+1<path.length&&inside(path[i+1]);if(!keep){flush();continue;}const rd=lngLatToRd([point[1],point[0]]);run.push({x:rd.x,y:rd.y});}flush();}}
  if(!segments.length)throw Error('No routable streets intersect area');const graph=buildRoadGraph(segments,{mergeSize:2,junctionStitchRadius:3,gridCellSize:80,gridPadding:8});
  const midLon=(west+east)/2,midLat=(south+north)/2,edges=[[west,midLat],[east,midLat],[midLon,south],[midLon,north]].map(point=>nearestRoadGraphNode(graph,lngLatToRd(point as [number,number])));
  let best:RoadGraphPoint[]=[];for(const [i,j]of[[0,1],[2,3]]){if(!edges[i]||!edges[j])continue;const path=findRoadRoute(graph,edges[i]!,edges[j]!);if(path.length>1&&path.slice(1).reduce((sum,p,k)=>sum+distance(path[k],p),0)>best.slice(1).reduce((sum,p,k)=>sum+distance(best[k],p),0))best=path;}
  if(best.length<2)throw Error('Area road graph has no cross-area route');const names=new Set<string>(),legs:AreaRoute['legs']=[];let travelled=0;
  for(let i=1;i<best.length;i++){const a=nearestRoadGraphNode(graph,best[i-1]),b=nearestRoadGraphNode(graph,best[i]),edge=a?.edges.find(item=>item.node===b),length=distance(best[i-1],best[i]);const candidates=[...new Set((edge?.segmentMetadata??[]).map(metadata=>metadata?.name).filter(Boolean))].sort() as string[],streetName=candidates[0]??null;for(const name of candidates)names.add(name);const fromM=travelled;travelled+=length;const prior=legs.at(-1);if(prior?.streetName===streetName)prior.toM=Number(travelled.toFixed(2));else legs.push({fromM:Number(fromM.toFixed(2)),toM:Number(travelled.toFixed(2)),streetName});}
  return{version:1,points:best.map(point=>[Number((point.x-origin.x).toFixed(3)),Number((origin.y-point.y).toFixed(3))]),distanceM:Number(travelled.toFixed(2)),streetNames:[...names].sort(),legs,sourceSegments:segments.length};
}
