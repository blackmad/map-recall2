import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import survey from './centraal-complex-footprints.json';
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
  const [x0,z0,x1,z1]=part.bounds,span=z1-z0,segments=16,columns=part.glass?60:10;
  // A faceted half ellipse; published Zuidkap height is preserved exactly.
  const height=(z:number)=>part.eaves+(part.top-part.eaves)*Math.sqrt(Math.max(0,1-((z-(z0+z1)/2)/(span/2))**2));
  const heightLinear=(z:number)=>{
   const step=span/segments,i=Math.min(segments-1,Math.max(0,Math.floor((z-z0)/step))),a=z0+i*step,c=a+step;
   return height(a)+(height(c)-height(a))*(z-a)/step;
  };
  function panel(xa:number,za:number,xb:number,zb:number,c:Colour,lift=0){
   for(const poly of part.localPolygons){
    const ring=clipRoofPanel(poly[0],xa,za,xb,zb);if(ring.length<3)continue;
    const area=Math.abs(ring.reduce((v,p,i)=>v+p[0]*ring[(i+1)%ring.length][1]-ring[(i+1)%ring.length][0]*p[1],0))/2;
    if(area<.00001)continue;
    const g=new T.ShapeGeometry(new T.Shape(ring.map(p=>new T.Vector2(...p))));
    const p=g.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i);p.setXYZ(i,x,heightLinear(z)+lift,z);}
    g.computeVertexNormals();add(g,c);
   }
  }
  for(let i=0;i<columns;i++)for(let j=0;j<segments;j++){
   let c:Colour=part.glass?'glass':'slate';
   // Letter colors belong to existing glass panels, not pasted text geometry.
   if(part.glass){const u=columns-1-i,glyph=Math.floor((u-3)/6),col=(u-3)%6,row=8-j,word='AMSTERDAM';
    if(glyph>=0&&glyph<word.length&&col>=0&&col<5&&row>=0&&row<7&&letters[word[glyph]][row][col]==='1')c=(i+j)%3===0?'gold':'red';
   }else if(j===7||j===8)c='glass';
   panel(x0+(x1-x0)*i/columns,z0+span*j/segments,x0+(x1-x0)*(i+1)/columns,z0+span*(j+1)/segments,c);
  }
  // Thin double-sided strips keep the repeated steel arches inexpensive.
  for(let i=0;i<part.frames;i++){
   const x=x0+.3+(x1-x0-.6)*i/(part.frames-1);
   for(let j=0;j<segments;j++)panel(x-.1,z0+span*j/segments,x+.1,z0+span*(j+1)/segments,'frame',.06);
  }
  for(const j of [0,4,8,12,16]){
   const z=z0+span*j/segments;panel(x0,z-.055,x1,z+.055,'frame',.065);
  }
  // Open supports. No filled ground-level station or bike-path slab.
  for(let i=0;i<8;i++)for(const z of [z0+.4,z1-.4]){
   const x=x0+4+(x1-x0-8)*i/7;
   if(clipRoofPanel(part.localPolygons[0][0],x-.3,z-.3,x+.3,z+.3).length<3)continue;
   const base=part.glass?6.5:0;box(x,base,z,.32,Math.max(.2,heightLinear(z)-base),.32,'frame');
  }
  if(part.glass){
   // Raised bus road, shaped to the current IJ canopy outline. Clear below.
   for(const poly of part.localPolygons){const s=new T.Shape(poly[0].map(p=>new T.Vector2(p[0],p[1])));const g=new T.ExtrudeGeometry(s,{depth:.35,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,6.5,0);add(g,'slate');}
   for(let i=0;i<8;i++){const x=x0+12+(x1-x0-24)*i/7;box(x,0,(z0+z1)/2,.65,6.15,.65,'stone');}
  }
 }
}
