import * as T from 'three';
import type { BuildingTools } from './cultural-builders';
import data from './oba-oosterdok-footprints.json';
import { openTopPrism, upwardRoofPlane } from './house-geometry';
type Colour = Parameters<BuildingTools['add']>[1];
/** Jo Coenen's limestone sculpture with cedar slipcases, authored in native east/south metres. */
export function buildObaOosterdok(_width: number, _depth: number, b: BuildingTools) {
  const ring = (suffix: number) => data.parts.find(p => p.id === `w14876063${String(suffix).padStart(2,'0')}`)!.localMetres.slice(0,-1).map(p => new T.Vector2(p[0],p[1]));
  const shape = (points: T.Vector2[]) => new T.Shape(points);
  function volume(points: T.Vector2[], bottom: number, top: number, colour: Colour, roof: Colour = colour) {
    b.add(openTopPrism(shape(points),bottom,top),colour);
    b.add(upwardRoofPlane(shape(points),top),roof);
  }
  function bar(a: T.Vector2, q: T.Vector2, y: number, height: number, depth: number, colour: Colour) {
    const delta=q.clone().sub(a),mid=a.clone().add(q).multiplyScalar(.5);
    b.box(mid.x,y,mid.y,delta.length(),height,depth,colour,-Math.atan2(delta.y,delta.x));
  }
  function outward(points:T.Vector2[],i:number) {
    const a=points[i],q=points[(i+1)%points.length],d=q.clone().sub(a);
    const area=points.reduce((v,p,k)=>v+p.x*points[(k+1)%points.length].y-points[(k+1)%points.length].x*p.y,0);
    return new T.Vector2(d.y,-d.x).normalize().multiplyScalar(area>0?1:-1);
  }
  function bays(points:T.Vector2[],bottom:number,top:number,timber:boolean,indices?:number[]) {
    for(let i=0;i<points.length;i++) {
      if(indices&&!indices.includes(i))continue;
      const a=points[i],q=points[(i+1)%points.length],length=a.distanceTo(q);
      if(length<2.2)continue;
      const n=outward(points,i),offset=timber?.28:.14,aa=a.clone().addScaledVector(n,offset),qq=q.clone().addScaledVector(n,offset);
      const columns=Math.max(1,Math.round(length/4.8)),rows=timber?5:Math.max(1,Math.round((top-bottom)/3.5));
      // Exposed glazing sits ahead of the core. Deep horizontal and vertical cedar casings
      // own the opening perimeter, instead of painting a tiny pane on an opaque wall.
      bar(aa,qq,bottom,top-bottom,.13,'glass');
      for(let r=0;r<=rows;r++)bar(aa,qq,bottom+(top-bottom)*r/rows-.16,.32,timber?.58:.23,timber?'ochre':'frame');
      for(let c=0;c<=columns;c++) {
        const p=aa.clone().lerp(qq,c/columns);
        b.box(p.x,bottom,p.y,timber?.38:.13,top-bottom,timber?.58:.25,timber?'ochre':'frame',-Math.atan2(q.y-a.y,q.x-a.x));
      }
      if(timber)for(let c=0;c<columns;c++) {
        const p=aa.clone().lerp(qq,(c+.34)/columns);
        b.box(p.x,bottom+.17,p.y,.095,top-bottom-.34,.65,'dark',-Math.atan2(q.y-a.y,q.x-a.x));
        // One narrow steel/sunshade side panel in each deep timber bay.
        const u=aa.clone().lerp(qq,(c+.79)/columns),v=aa.clone().lerp(qq,(c+.95)/columns);
        bar(u,v,bottom+.25,top-bottom-.5,.16,'dark');
        for(let r=0;r<rows;r++)for(let k=1;k<=5;k++)bar(u,v,bottom+(r+k/6)*(top-bottom)/rows,.055,.24,'frame');
      }
    }
  }
  const main=ring(1),plinth=ring(5);
  volume(plinth,.8,8.65,'glass','white');bays(plinth,1.05,8.4,false);
  volume(main,8.65,28.5,'glass','slate');
  bays(main,9.05,28.25,true);
  // The west facade is a stone ladder along a curved surveyed return, with open glass bays.
  const west=ring(0);
  volume(west,.8,8.65,'glass','white');
  const outer=west.slice(5);
  for(let i=0;i<outer.length-1;i++) {
    const a=outer[i],q=outer[i+1];
    for(let y of [8.65,12.6,16.55,20.5,24.45,28.4])bar(a,q,y,.35,.5,'stone');
    b.box(a.x,8.65,a.y,.44,19.75,.44,'stone');
  }
  // Real monumental portal: independent offset left pier and narrower right return.
  volume(ring(3),.8,31.15,'stone');
  volume(ring(2),.8,31.15,'stone');
  const side=ring(4);
  // Five visibly open stacked terraces between the cedar facade and stone east pier.
  for(let y of [8.65,12.6,16.55,20.5,24.45,28.4]) {
    volume(side,y,y+.25,'concrete');
    const a=side[0],q=side[1];bar(a,q,y+.26,.82,.16,'frame');
  }
  // Sculpted lower roof owns its footprint and excludes the open southern terrace.
  volume(ring(6),28.5,31,'stone');
  volume(ring(7),30.85,31.4,'stone');
  // Setbacks: low restaurant/terrace then the taller northern theatre.
  volume(ring(8),31.4,34,'glass','slate');bays(ring(8),31.5,33.8,false);
  volume(ring(9),31,37,'stone','slate');
  // North service core is a distinct ten-metre wide projection, never an all-plot slab.
  volume(ring(10),.8,37,'stone','slate');
  bays(ring(10),2,29.5,false,[0,3,4,5]);
  const rear=ring(9);
  bays(rear,31.45,33.6,false,[0,5,6,7,8]);
  // Thin rooftop parapets follow actual rear perimeter, without a padded rectangular cap.
  for(let i=0;i<rear.length;i++)bar(rear[i],rear[(i+1)%rear.length],37,.23,.17,'stone');
  // Entrance doors and broad shallow stairs follow the waterfront glass elevation.
  const a=plinth[0],q=plinth[3],n=outward(plinth,0),frontA=a.clone().addScaledVector(n,.15),frontQ=q.clone().addScaledVector(n,.15);
  for(let t of [.29,.48,.67]) {
    const p=frontA.clone().lerp(frontQ,t),dx=q.clone().sub(a).normalize();
    bar(p.clone().addScaledVector(dx,-1.2),p.clone().addScaledVector(dx,1.2),1.05,2.8,.19,'dark');
    b.box(p.x,1.05,p.y,.095,2.8,.29,'frame');
  }
  const stairTangent=q.clone().sub(a).normalize();
  for(let i=0;i<6;i++) {
    const centre=a.clone().add(q).multiplyScalar(.5).addScaledVector(n,1.4-i*.25);
    b.box(centre.x,0,centre.y,a.distanceTo(q),.15+i*.13,.30,'stone',-Math.atan2(stairTangent.y,stairTangent.x));
  }
}
