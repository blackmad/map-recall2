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

/** Four original roof structures behind the existing Cuypers facade. */
export function buildCentraalComplex(b:BuildingTools){
 const {add,box}=b;
 for(const part of survey.parts){
  const [x0,z0,x1,z1]=part.bounds,span=z1-z0,columns=part.glass?60:10;
  // Row boundaries across the roof. The glass canopy puts seven rows exactly on the measured letter band.
  const uniform=(a:number,b:number,n:number)=>Array.from({length:n},(_,i)=>a+(b-a)*i/n);
  const zs=part.glass
   ?[...uniform(z0,AMSTERDAM_BAND[0],1),...uniform(AMSTERDAM_BAND[0],AMSTERDAM_BAND[1],7),...uniform(AMSTERDAM_BAND[1],z1,9),z1]
   :[...uniform(z0,z1,16),z1];
  const segments=zs.length-1;
  // A faceted half ellipse; published Zuidkap height is preserved exactly.
  const height=(z:number)=>part.eaves+(part.top-part.eaves)*Math.sqrt(Math.max(0,1-((z-(z0+z1)/2)/(span/2))**2));
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
  const frameX=part.glass?[]:Array.from({length:part.frames},(_,i)=>x0+.3+(x1-x0-.6)*i/(part.frames-1));
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
     const mid=(s.xa+s.xb)/2,g=AMSTERDAM_GLYPHS.find(([,a,b])=>mid>a&&mid<b),row=7-j;
     if(!g||row<0||row>6)return 'glass';
     const col=4-Math.min(4,Math.floor((mid-g[1])/(g[2]-g[1])*5));
     return letters[g[0]][row][col]==='1'?'pink':'glass';
    }
    return j===7||j===8?'glass':'bronze';
   };
   // Neighbouring strips of one colour in one segment are coplanar: one panel (keeps the GLB under its 500 kB budget).
   for(let k=0;k<strips.length;){
    const c=colour(strips[k]);let e=k;while(e+1<strips.length&&colour(strips[e+1])===c)e++;
    panel(strips[k].xa,zs[j],strips[e].xb,zs[j+1],c,0,roofSink);k=e+1;
   }
  }
  slab(roofSink,.14,'bronze');
  // Open supports. No filled ground-level station or bike-path slab.
  // The Zuidkap's station-side posts stand 0.8 m off its edge: clear of the Cuypers rear wall (z -15.8) they used to pierce.
  for(let i=0;i<8;i++)for(const z of [z0+.4,z1-(part.name==='Zuidkap'?.8:.4)]){
   const x=x0+4+(x1-x0-8)*i/7;
   if(clipRoofPanel(part.localPolygons[0][0],x-.3,z-.3,x+.3,z+.3).length<3)continue;
   const base=part.glass?6.5:0;box(x,base,z,.32,Math.max(.2,heightLinear(z)-base),.32,'frame');
  }
  if(part.glass){
   // Raised bus road, shaped to the current IJ canopy outline. Clear below.
   for(const poly of part.localPolygons){const s=new T.Shape(poly[0].map(p=>new T.Vector2(p[0],p[1])));const g=new T.ExtrudeGeometry(s,{depth:.35,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,6.5,0);add(g,'bronze');}
   for(let i=0;i<8;i++){const x=x0+12+(x1-x0-24)*i/7;box(x,0,(z0+z1)/2,.65,6.15,.65,'stone');}
  }
 }
}
