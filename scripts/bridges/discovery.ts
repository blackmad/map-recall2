import { lngLatToRd } from '../../src/canalRecall/rdCoordinates.ts';
import { insideBridgeOutline, type BridgePoint as Point } from '../../src/canalRecall/bridgeSurface.ts';

export type RegisterRow = [string,string,string,string,number,string,string,Point[]];
export interface Road { id:string; name:string; highway:string; bridge?:boolean; tunnel?:boolean; path:Point[]; paths?:Point[][]; source?:string; originalSource?:string }
export interface Candidate { row:RegisterRow; road:Road; deck:Point[]; outline:Point[]; roadIds:string[]; match:string; reasons:string[] }
export interface DiscoveryEntry { id:string; name:string; status:string; reasons:string[]; roadIds?:string[]; center:Point }
const distance=(a:Point,b:Point)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const normalise=(name:string)=>name.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export const beltBounds=[4.865,52.355,4.915,52.386];
const closed=(path:Point[])=>distance(path[0],path.at(-1)!)<.1;

/** Remove sub-decimetre survey noise, preserving real corners and concave joins. */
export function simplifyOutline(ring:Point[]):Point[] {
  const result=ring.map(p=>[...p] as Point);
  if(closed(result))result.pop();
  for(let changed=true;changed&&result.length>3;) {
    changed=false;
    for(let i=0;i<result.length&&result.length>3;i++) {
      const a=result[(i+result.length-1)%result.length],p=result[i],b=result[(i+1)%result.length];
      const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;
      const t=l?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l:0;
      if(t>=0&&t<=1&&Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)<.08){result.splice(i--,1);changed=true;}
    }
  }
  return result;
}

/** Spatial overlap owns identity; names only rank paths within that footprint. */
export function discoverBridges(rows:RegisterRow[],roads:Road[],scope='canal-belt',catalog:Road[]=[],waters:Point[][]=[]) {
  const waterSegments=waters.filter(p=>p?.length>=2).map(p=>p.map(([lat,lng])=>lngLatToRd(lng,lat))).filter(p=>!closed(p))
    .flatMap(p=>p.slice(1).map((b,i)=>[p[i],b] as [Point,Point]));
  const intersection=(a:Point,b:Point,c:Point,d:Point)=>{const dx=b[0]-a[0],dy=b[1]-a[1],ex=d[0]-c[0],ey=d[1]-c[1],det=dx*ey-dy*ex;
    if(Math.abs(det)<1e-9)return null;const t=((c[0]-a[0])*ey-(c[1]-a[1])*ex)/det,u=((c[0]-a[0])*dy-(c[1]-a[1])*dx)/det;
    return t>=0&&t<=1&&u>=0&&u<=1?{t,point:[a[0]+dx*t,a[1]+dy*t] as Point}:null;};
  const clipPath=(line:Point[],ring:Point[])=>{const chunks:Point[][]=[];let current:Point[]=[];
    for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],cuts=[0,1];for(let j=0;j<ring.length;j++){const hit=intersection(a,b,ring[j],ring[(j+1)%ring.length]);if(hit)cuts.push(hit.t);}cuts.sort((a,b)=>a-b);
      const at=(t:number):Point=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];for(let j=1;j<cuts.length;j++){if(cuts[j]-cuts[j-1]<1e-7)continue;
        if(insideBridgeOutline(at((cuts[j]+cuts[j-1])/2),ring)){if(!current.length)current.push(at(cuts[j-1]));current.push(at(cuts[j]));}else if(current.length){chunks.push(current);current=[];}}
    }if(current.length)chunks.push(current);return chunks.sort((a,b)=>distance(b[0],b.at(-1)!)-distance(a[0],a.at(-1)!))[0]||[];};
  const paths=[...roads.filter(r=>!r.tunnel&&r.highway!=='steps'),...catalog.map(r=>({...r,bridge:true,source:'bridge-catalogue'}))].flatMap(road=>(road.paths||[road.path])
    .filter(path=>path?.length>=2).map(path=>({road,deck:path.map(([lat,lng])=>lngLatToRd(lng,lat))})))
    .filter(p=>!closed(p.deck));
  const candidates:Candidate[]=[],entries:DiscoveryEntry[]=[];
  const seen=new Set<string>();
  for(const row of rows) {
    const center:Point=[row[7].reduce((sum,p)=>sum+p[0],0)/row[7].length,row[7].reduce((sum,p)=>sum+p[1],0)/row[7].length];
    if(scope==='canal-belt'&&(center[0]<beltBounds[0]||center[0]>beltBounds[2]||center[1]<beltBounds[1]||center[1]>beltBounds[3]))continue;
    const entry:DiscoveryEntry={id:row[0]||`unidentified-${entries.length}`,name:row[1]||`Bridge ${row[0].replace('BRU','')}`,status:'unmatched',reasons:[],center};entries.push(entry);
    if(!row[0]||seen.has(row[0])){entry.status='review';entry.reasons.push('Missing or duplicate municipal identity');continue;}seen.add(row[0]);
    const outline=simplifyOutline(row[7].map(p=>lngLatToRd(...p)));
    if(outline.length>64){entry.status='review';entry.reasons.push('Complex footprint needs a bespoke mesh');continue;}
    const xs=outline.map(p=>p[0]),ys=outline.map(p=>p[1]),box=[Math.min(...xs)-1,Math.min(...ys)-1,Math.max(...xs)+1,Math.max(...ys)+1];
    const overlaps=paths.flatMap(p=>{
      const px=p.deck.map(v=>v[0]),py=p.deck.map(v=>v[1]);
      if(Math.max(...px)<box[0]||Math.min(...px)>box[2]||Math.max(...py)<box[1]||Math.min(...py)>box[3])return[];
      let line=p.deck;
      if(!p.road.bridge){line=clipPath(line,outline);if(line.length<2)return[];
        const crosses=line.slice(1).some((b,i)=>waterSegments.some(([c,d])=>{const a=line[i];
          if(Math.max(a[0],b[0])<Math.min(c[0],d[0])||Math.min(a[0],b[0])>Math.max(c[0],d[0])||Math.max(a[1],b[1])<Math.min(c[1],d[1])||Math.min(a[1],b[1])>Math.max(c[1],d[1]))return false;
          const hit=intersection(a,b,c,d);return hit&&insideBridgeOutline(hit.point,outline); }));
        if(!crosses)return[];
      }
      let overlap=0,length=0;
      for(let i=1;i<line.length;i++) {
        const a=line[i-1],b=line[i],l=distance(a,b),steps=Math.ceil(l);
        length+=l;
        for(let j=0;j<steps;j++)if(insideBridgeOutline([a[0]+(b[0]-a[0])*(j+.5)/steps,a[1]+(b[1]-a[1])*(j+.5)/steps],outline))overlap+=l/steps;
      }
      if(overlap<2)return[];
      const nameMatch=!!row[1]&&normalise(row[1])===normalise(p.road.name);
      const traffic=['primary','secondary','tertiary','residential','unclassified','living_street'].includes(p.road.highway);
      return[{...p,deck:line,road:p.road.bridge?p.road:{...p.road,source:'footprint-and-water-crossing',originalSource:p.road.source},overlap,length,nameMatch,score:overlap+(nameMatch?30:0)+(traffic?8:0)+(p.road.bridge?(p.road.source==='bridge-catalogue'?20:p.road.source==='osm-all-bridge-paths'?40:50):-50)}];
    }).sort((a,b)=>b.score-a.score||a.road.id.localeCompare(b.road.id));
    if(!overlaps.length){entry.reasons.push('No usable crossing alignment in routing, bridge catalogue or recovered OSM paths');continue;}
    const best=overlaps[0],deck=best.deck.map(p=>[...p] as Point),roadIds=new Set([best.road.id]),usedPaths=new Set([best.deck]);
    // Rejoin OSM ways split at a centre node; parallel lanes stay separate.
    for(const reverse of [false,true]) {
      if(reverse)deck.reverse();
      for(let step=0;step<15;step++) {
        const end=deck.at(-1)!,previous=deck.at(-2)!;
        const options=overlaps.filter(p=>!usedPaths.has(p.deck)).flatMap(p=>{
          const line=distance(p.deck[0],end)<.8?p.deck:distance(p.deck.at(-1)!,end)<.8?[...p.deck].reverse():null;
          if(!line)return[];
          const next=line[1],cos=((end[0]-previous[0])*(next[0]-end[0])+(end[1]-previous[1])*(next[1]-end[1]))/(distance(previous,end)*distance(end,next));
          return cos>.8?[{...p,line,cos}]:[];
        }).sort((a,b)=>b.cos-a.cos);
        if(!options.length)break;
        roadIds.add(options[0].road.id);usedPaths.add(options[0].deck);deck.push(...options[0].line.slice(1));
      }
      if(reverse)deck.reverse();
    }
    // Equivalent parallel paths are expected. A competing crossing direction is ambiguous.
    const a=deck[0],b=deck.at(-1)!,length=distance(a,b);
    const competing=overlaps.find(p=>{
      if(roadIds.has(p.road.id)||p.score<best.score-5)return false;
      const c=p.deck[0],d=p.deck.at(-1)!;
      return Math.abs(((b[0]-a[0])*(d[0]-c[0])+(b[1]-a[1])*(d[1]-c[1]))/(length*distance(c,d)))<.8;
    });
    entry.roadIds=[...roadIds];
    if(competing){entry.status='review';entry.reasons.push('Multiple crossing directions fit this footprint');continue;}
    if(length<3||length>65||deck.some(p=>{
      const t=((p[0]-a[0])*(b[0]-a[0])+(p[1]-a[1])*(b[1]-a[1]))/(length*length);
      return Math.hypot(p[0]-a[0]-(b[0]-a[0])*t,p[1]-a[1]-(b[1]-a[1])*t)>1;
    })){entry.status='review';entry.reasons.push('Long or curved crossing needs specialised geometry');continue;}
    entry.status='matched';
    candidates.push({row,road:best.road,deck,outline,roadIds:[...roadIds],match:best.road.source==='bridge-catalogue'?'catalogue-footprint-and-alignment':best.road.source==='footprint-and-water-crossing'?'footprint-and-water-crossing':best.nameMatch?'footprint-and-name':'footprint-and-alignment',reasons:[]});
  }
  const pilots=['BRU0057','BRU0059','BRU0065'];
  candidates.sort((a,b)=>{const rank=(id:string)=>pilots.includes(id)?pilots.indexOf(id):-1;return(rank(a.row[0])<0?3:rank(a.row[0]))-(rank(b.row[0])<0?3:rank(b.row[0]))||a.row[0].localeCompare(b.row[0]);});
  return{candidates,entries};
}
