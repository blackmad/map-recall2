import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import survey from './centraal-complex-footprints.json';
import {thickenSheet, trianglePositions} from './thicken-sheet';
type Point = [number, number];
type Colour = Parameters<BuildingTools['add']>[1];

/** Clip panels to the actual roof perimeter, including its angled end edges. */
export function clipRoofPanel(ring:number[][],x0:number,z0:number,x1:number,z1:number):Point[] {
 let points = ring.slice(0,-1).map(p=>[p[0],p[1]] as Point);
 for(const [axis,bound,sign] of [[0,x0,1],[0,x1,-1],[1,z0,1],[1,z1,-1]]){
  const next:Point[]=[];
  for(let i=0;i<points.length;i++){
   const a=points[i],b=points[(i+1)%points.length],insideA=(a[axis]-bound)*sign>=-1e-8,insideB=(b[axis]-bound)*sign>=-1e-8;
   if(insideA)next.push(a);
   if(insideA!==insideB){const t=(bound-a[axis])/(b[axis]-a[axis]);next.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  points=next;
 }
 return points;
}

/**
 * AMSTERDAM on the IJ canopy (the glass roof over the bus station), measured on the rectified PDOK 2023 orthophoto
 * (2023_orthoHR, open data; artifacts/centraal-lane/ortho.ts). The word is laid out to be read from the IJ: tops of
 * the letters face the station, so from above, with north up, it reads M-A-D-R-E-T-S-M-A west to east, upside down.
 * Glyph boxes are along the canopy (model x, west to east). Rows are across it: the letters run from 2.5 to 22 m south
 * of the canopy's north edge on the photo. The photo is not true-ortho (the 22 m roof leans 3.7 m north and reads 6%
 * wider), so the band is scaled onto the 3DBAG outline: z -164.9 (letter feet) to -146.5 (letter tops).
 */
export const AMSTERDAM_GLYPHS:[string,number,number][]=[
 ['M',-127.5,-101],['A',-94,-71],['D',-66.7,-45.7],['R',-35.7,-16.7],['E',-9.7,7.6],['T',12.6,32.6],['S',36.6,58.6],['M',64.9,92.9],['A',98.9,123.9],
];
export const AMSTERDAM_BAND:[number,number]=[-164.9,-146.5];
const letters:Record<string,string[]>={
 A:['01110','10001','10001','11111','10001','10001','10001'],
 M:['10001','11011','10101','10101','10001','10001','10001'],
 S:['01111','10000','10000','01110','00001','00001','11110'],
 T:['11111','00100','00100','00100','00100','00100','00100'],
 E:['11111','10000','10000','11110','10000','10000','11111'],
 R:['11110','10001','10001','11110','10100','10010','10001'],
 D:['11110','10001','10001','10001','10001','10001','11110'],
};

/**
 * The IJ canopy's cross-section (feedback bbbeaceb, 2026-10-29), measured, not the symmetric half ellipse it used to be (an
 * opaque tube whose north side fell vertically from 22 m to 9.2 m at the OSM outline, with nothing on the quay).
 * AHN4 DSM 0.5 m (PDOK WCS, CC0), sampled across the canopy at x -120, -60, -5, 60, 120 and 170 in this frame: the south eave
 * sits at 10.3 m over the bus deck (z -118.8), the vault rises fast to a 22 m crest at z -149, and the north side sweeps down
 * through 18 m at z -162 and 12.5-13.9 m at z -170/-172, past the OSM outline (z -164.4 to -167.3). The steel arch ribs carry on
 * below the glass edge and land on the De Ruijterkade quay: their feet are at z -178.1 on the 2023 orthophoto (rotated to this
 * frame; artifacts in the #99 lane scratchpad), 29 of them at x = 0.9 + 12.56 k, k = -14..14 (peaks along the quay, spread
 * under 0.4 m). Panoramas recording_2025-06-17_09-10-34_02640 and _02605 (CC BY 4.0) show the ribs as plain grey blades that
 * rise steeply from a shoe on the quay and curve over under the glass.
 */
export const IJ_CANOPY={crestZ:-149.1,crest:22,southEave:10.3,southSpan:30.3,glassEdgeZ:-171,footZ:-178.1,ribX0:.9,ribPitch:12.56,ribCount:29,ribBelowGlass:.6};
/**
 * Rib centre line north of the crest. Under the glass, 21.4 m x (1 - 0.613 u^1.5), u from 0 at the crest to 1 at the foot (fits the
 * AHN samples within 0.4 m); past the glass edge it drops to its shoe as sqrt(1 - s)(1 + 0.2 s), vertical at the quay and matching
 * the glass slope at the edge.
 */
export function ijRibNorth(z:number){
 const c=IJ_CANOPY,top=c.crest-c.ribBelowGlass,span=c.crestZ-c.footZ,u=Math.min(1,Math.max(0,(c.crestZ-z)/span)),ue=(c.crestZ-c.glassEdgeZ)/span;
 const under=(v:number)=>top*(1-.613*Math.pow(v,1.5));
 if(u<=ue)return under(u);
 const s=(u-ue)/(1-ue);return under(ue)*Math.sqrt(Math.max(0,1-s))*(1+.2*s);
}
/** Glass vault height: rib + 0.6 m on the north side; on the south a 0.6-exponent quarter ellipse down to the 10.3 m eave. */
export function ijCanopyHeight(z:number){const c=IJ_CANOPY;if(z<=c.crestZ)return ijRibNorth(z)+c.ribBelowGlass;const v=Math.min(1,(z-c.crestZ)/c.southSpan);return c.southEave+(c.crest-c.southEave)*Math.pow(Math.max(0,1-v*v),.6);}
export const ijRibXs=()=>Array.from({length:IJ_CANOPY.ribCount},(_,i)=>IJ_CANOPY.ribX0+IJ_CANOPY.ribPitch*(i-(IJ_CANOPY.ribCount-1)/2));
/** A rectangular blade swept along a centre line in the plane x = const: width across x, depth in the line's normal. */
export function sweptRib(x:number,line:[number,number][],width:number,depth:number){
 const pos:number[]=[],quad=(a:number[],b:number[],c:number[],d:number[])=>pos.push(...a,...b,...c,...a,...c,...d);
 const frames=line.map(([z,y],i)=>{const [za,ya]=line[Math.max(0,i-1)],[zb,yb]=line[Math.min(line.length-1,i+1)];const tz=zb-za,ty=yb-ya,L=Math.hypot(tz,ty)||1;const nz=-ty/L,ny=tz/L;
  return [[x-width/2,y+ny*depth/2,z+nz*depth/2],[x+width/2,y+ny*depth/2,z+nz*depth/2],[x+width/2,y-ny*depth/2,z-nz*depth/2],[x-width/2,y-ny*depth/2,z-nz*depth/2]];});
 for(let i=0;i+1<frames.length;i++){const a=frames[i],b=frames[i+1];for(let k=0;k<4;k++)quad(a[k],b[k],b[(k+1)%4],a[(k+1)%4]);}
 for(const [f,flip] of [[frames[0],true],[frames[frames.length-1],false]] as const){if(flip)quad(f[3],f[2],f[1],f[0]);else quad(f[0],f[1],f[2],f[3]);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();return g;
}

/** Four original roof structures behind the existing Cuypers facade. */
export function buildCentraalComplex(b:BuildingTools){
 const {add,box}=b;
 for(const surveyed of survey.parts){
  // The IJ canopy's glass runs 4-7 m past the OSM outline's north edge (AHN, IJ_CANOPY): its roof outline moves to the measured
  // glass edge. The raised bus deck below keeps the surveyed outline.
  const roofPolygons=surveyed.glass?surveyed.localPolygons.map(poly=>poly.map(ring=>ring.map(([x,z])=>[x,z<-160?IJ_CANOPY.glassEdgeZ:z]))):surveyed.localPolygons;
  const part={...surveyed,localPolygons:roofPolygons,bounds:surveyed.glass?[surveyed.bounds[0],IJ_CANOPY.glassEdgeZ,surveyed.bounds[2],surveyed.bounds[3]]:surveyed.bounds};
  const [x0,z0,x1,z1]=part.bounds,span=z1-z0,columns=part.glass?60:10;
  // Rows north of the letter band: three for the curved IJ canopy edge (it falls 13.5 -> 16.7 m there), one elsewhere.
  const pre=part.glass?3:1;
  // Row boundaries across the roof. The glass canopy puts seven rows exactly on the measured letter band.
  const uniform=(a:number,b:number,n:number)=>Array.from({length:n},(_,i)=>a+(b-a)*i/n);
  const zs=part.glass
   ?[...uniform(z0,AMSTERDAM_BAND[0],pre),...uniform(AMSTERDAM_BAND[0],AMSTERDAM_BAND[1],7),...uniform(AMSTERDAM_BAND[1],z1,9),z1]
   :[...uniform(z0,z1,16),z1];
  const segments=zs.length-1;
  // A faceted half ellipse; published Zuidkap height is preserved exactly.
  const height=(z:number)=>part.glass?ijCanopyHeight(z):part.eaves+(part.top-part.eaves)*Math.sqrt(Math.max(0,1-((z-(z0+z1)/2)/(span/2))**2));
  const heightLinear=(z:number)=>{
   let i=0;while(i<segments-1&&z>zs[i+1])i++;const a=zs[i],c=zs[i+1];
   return height(a)+(height(c)-height(a))*(z-a)/(c-a);
  };
  function panel(xa:number,za:number,xb:number,zb:number,c:Colour,lift=0,sink?:number[],emit=true){
   for(const poly of part.localPolygons){
    const ring=clipRoofPanel(poly[0],xa,za,xb,zb);if(ring.length<3)continue;
    const area=Math.abs(ring.reduce((v,p,i)=>v+p[0]*ring[(i+1)%ring.length][1]-ring[(i+1)%ring.length][0]*p[1],0))/2;
    if(area<.00001)continue;
    const g=new T.ShapeGeometry(new T.Shape(ring.map(p=>new T.Vector2(...p))));
    const p=g.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i);p.setXYZ(i,x,heightLinear(z)+lift,z);}
    g.computeVertexNormals();if(emit)add(g,c);if(sink)sink.push(...trianglePositions(g));
   }
  }
  // The sheds are closed slabs, not single-sided sheets: an underside and skirts close every edge (the audit read 800 m of open roof perimeter).
  // Skirts follow a coarse copy of the sheet (one panel per segment): the same outline without a vertex at every arch, so the eaves are
  // not cut into 20 cm skirt pieces (the fine sheet's eave edges lie on these skirts, within the shell audit's 3 cm).
  function slab(sink:number[],d:number,c:Colour){if(!sink.length)return;const bottom:number[]=[],top:number[]=[];for(let j=0;j<segments;j++){panel(x0,zs[j],x1,zs[j+1],c,-d,bottom,false);panel(x0,zs[j],x1,zs[j+1],c,0,top,false);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(thickenSheet(top,d,{vertical:true,bottom}),3));g.computeVertexNormals();add(g,c);}
  const roofSink:number[]=[];
  // The steel arches are a material split of the roof sheet: 20 cm 'frame' bands between the panels, in the sheet's own plane.
  // They used to be separate strips floating 2.2 cm over the cells (and 1.6 cm purlins across them), which z-fought from
  // the air (lane zfight-audit 2026-10-13: 1,166 m2 of overlap under 3 cm). The purlin strips are gone; the glazed
  // bands at rows 7-8 already mark the ridge.
  // On the IJ canopy the bands sit over its arch ribs (ijRibXs), so the rib rhythm reads from above as it does on the orthophoto.
  const frameX=part.glass?ijRibXs():Array.from({length:part.frames},(_,i)=>x0+.3+(x1-x0-.6)*i/(part.frames-1));
  const glyphCuts=part.glass?AMSTERDAM_GLYPHS.flatMap(([,a,b])=>Array.from({length:6},(_,k)=>a+(b-a)*k/5)):[];
  const cuts=[x0,x1,...(part.glass?glyphCuts:Array.from({length:columns-1},(_,i)=>x0+(x1-x0)*(i+1)/columns)),...frameX.flatMap(x=>[x-.1,x+.1])].filter(x=>x>=x0&&x<=x1).sort((a,b)=>a-b);
  const strips=cuts.slice(1).map((xb,k)=>({xa:cuts[k],xb})).filter(s=>s.xb-s.xa>=1e-4).map(s=>{
   const mid=(s.xa+s.xb)/2;return {...s,arch:frameX.some(x=>Math.abs(mid-x)<.1),i:Math.min(columns-1,Math.floor((mid-x0)/(x1-x0)*columns))};
  });
  for(let j=0;j<segments;j++){
   const colour=(s:typeof strips[number]):Colour=>{
    if(s.arch)return 'frame';
    // Letter colors belong to existing glass panels, not pasted text geometry.
    if(part.glass){
     // Rotated 180 degrees: the glyph's top row is the southernmost band row and its left column the eastern one.
     const mid=(s.xa+s.xb)/2,g=AMSTERDAM_GLYPHS.find(([,a,b])=>mid>a&&mid<b),row=6+pre-j;
     if(!g||row<0||row>6)return 'canopyGlass';
     const col=4-Math.min(4,Math.floor((mid-g[1])/(g[2]-g[1])*5));
     return letters[g[0]][row][col]==='1'?'pink':'canopyGlass';
    }
    return j===7||j===8?'glass':'bronze';
   };
   // Neighbouring strips of one colour in one segment are coplanar: one panel (keeps the GLB under its 500 kB budget).
   for(let k=0;k<strips.length;){
    const c=colour(strips[k]);let e=k;while(e+1<strips.length&&colour(strips[e+1])===c)e++;
    panel(strips[k].xa,zs[j],strips[e].xb,zs[j+1],c,0,roofSink);k=e+1;
   }
  }
  slab(roofSink,.14,part.glass?'canopyGlass':'bronze');
  // Open supports. No filled ground-level station or bike-path slab.
  // The Zuidkap's station-side posts stand 0.8 m off its edge: clear of the Cuypers rear wall (z -15.8) they used to pierce.
  // The IJ canopy's north side stands on its arch ribs, not on posts.
  for(let i=0;i<8;i++)for(const z of part.glass?[z1-.4]:[z0+.4,z1-(part.name==='Zuidkap'?.8:.4)]){
   const x=x0+4+(x1-x0-8)*i/7;
   if(clipRoofPanel(part.localPolygons[0][0],x-.3,z-.3,x+.3,z+.3).length<3)continue;
   const base=part.glass?6.5:0;box(x,base,z,.32,Math.max(.2,heightLinear(z)-base),.32,'frame');
  }
  if(part.glass){
   // Raised bus road, shaped to the current IJ canopy outline. Clear below.
   for(const poly of surveyed.localPolygons){const s=new T.Shape(poly[0].map(p=>new T.Vector2(p[0],p[1])));const g=new T.ExtrudeGeometry(s,{depth:.35,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,6.5,0);add(g,'bronze');}
   for(let i=0;i<8;i++){const x=x0+12+(x1-x0-24)*i/7;box(x,0,(surveyed.bounds[1]+z1)/2,.65,6.15,.65,'stone');}
   // The arch ribs (IJ_CANOPY): one grey blade per measured position, 0.6 m under the faceted glass from the south eave to the glass
   // edge, then on the measured curve down to its shoe on the quay. Under the glass it follows the panels' own facets (heightLinear),
   // so the 0.6 m gap holds between rows too.
   const c=IJ_CANOPY,line:[number,number][]=[];
   for(let i=0;i<=8;i++){const t=i/8*Math.PI/2,z=c.footZ+(c.glassEdgeZ-c.footZ)*(1-Math.cos(t));line.push([z,ijRibNorth(z)]);}
   // Under the glass the offset is along the facets' normal, not straight down: near the steep south eave a vertical 0.6 m left
   // the blade's top 3 cm under the slab (zfight-tight, 2026-10-29).
   const glassLine=zs.map(z=>[z,heightLinear(z)] as [number,number]);
   for(let i=1;i<glassLine.length;i++){
    const [za,ya]=glassLine[i-1],[zb,yb]=glassLine[i],[zc,yc]=glassLine[Math.min(glassLine.length-1,i+1)];
    const n1=[ya-yb,zb-za],n2=[yb-yc,zc-zb],L1=Math.hypot(...n1)||1,L2=Math.hypot(...n2)||1;
    const nz=(n1[0]/L1+(i+1<glassLine.length?n2[0]/L2:n1[0]/L1)),ny=(n1[1]/L1+(i+1<glassLine.length?n2[1]/L2:n1[1]/L1)),L=Math.hypot(nz,ny);
    // Mitred offset: at a facet joint the bisector is stretched so both facets keep the full clearance.
    const cos=Math.max(.5,(nz*n1[0]/L1+ny*n1[1]/L1)/L),k=c.ribBelowGlass/cos;
    line.push([zb-nz/L*k,yb-ny/L*k]);
   }
   for(const x of ijRibXs()){add(sweptRib(x,line,.45,.6),'frame');box(x,0,c.footZ+.35,.9,.35,1.6,'frame');}
  }
 }
}
