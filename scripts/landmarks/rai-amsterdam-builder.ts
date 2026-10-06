import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import footprints from './rai-amsterdam-footprints.json';
import {openTopPrism,upwardRoofPlane} from './house-geometry';

/** Survey coordinates projected into the original architect-section frame. */
export function raiSectionRing(coordinates:number[][]):T.Vector2[] {
  const [lon,lat]=footprints.anchor,a=.0837;
  return coordinates.slice(0,-1).map(([x,z])=>{
    const east=(x-lon)*111320*Math.cos(lat*Math.PI/180),south=(lat-z)*111320;
    return new T.Vector2(east*Math.cos(a)+south*Math.sin(a),-east*Math.sin(a)+south*Math.cos(a));
  });
}
/** Phase one: independently surveyed Elicium. Other RAI halls remain ordinary buildings. */
export function buildRaiAmsterdam(_w:number,_d:number,b:BuildingTools):void {
  const angle=-.0837;
  // Source-aligned office width; section shoulder curvature is photo-guided.
  const officeWest=-22.87,officeEast=-7.90;
  const nativeRing=raiSectionRing(footprints.geometry.coordinates[0]);
  const left=Math.min(...nativeRing.map(p=>p.x)),right=Math.max(...nativeRing.map(p=>p.x));
  const nativeShape=new T.Shape(nativeRing);
  const planTriangles=T.ShapeUtils.triangulateShape(nativeRing,[]).map(t=>t.map(i=>nativeRing[i]));
  function add(g:T.BufferGeometry,c:Parameters<BuildingTools['add']>[1],assembly?:string) {
    if(assembly)g.userData.raiAssembly=assembly;
    g.rotateY(angle); b.add(g,c);
  }
  function box(x:number,y:number,z:number,w:number,h:number,d:number,c:Parameters<BuildingTools['add']>[1]) {
    const g=new T.BoxGeometry(w,h,d);g.translate(x,y+h/2,z);add(g,c);
  }
  // Architect's published section: rounded continuous ribbon around separate raised halls
  // and tower. Controls are original approximations; height is AHN5 above local ground.
  function profile(inset=0):T.Shape {
    const s=new T.Shape(),l=left+inset,r=right-inset,bottom=8.0+inset,top=46.69-inset;
    s.moveTo(l+3,bottom);s.lineTo(r-3,bottom);s.quadraticCurveTo(r,bottom,r,bottom+3);
    s.lineTo(r,14.7-inset);s.quadraticCurveTo(r,17.7-inset,r-3,17.7-inset);
    s.lineTo(officeEast+3+inset,17.7-inset);s.quadraticCurveTo(officeEast-inset,17.7-inset,officeEast-inset,20.7-inset);
    s.lineTo(officeEast-inset,top);s.lineTo(officeWest+3+inset,top);
    s.quadraticCurveTo(officeWest+inset,top,officeWest+inset,top-3);
    s.lineTo(officeWest+inset,21.5-inset);s.quadraticCurveTo(officeWest+inset,18.5-inset,officeWest-3+inset,18.5-inset);
    s.lineTo(l+3,18.5-inset);s.quadraticCurveTo(l,18.5-inset,l,15.5-inset);
    s.lineTo(l,bottom+3);s.quadraticCurveTo(l,bottom,l+3,bottom);s.closePath();return s;
  }
  const outer=profile(),section=outer.getPoints(6);
  // Clip each section surface to triangulated native plan geometry. This preserves
  // surveyed skew/vertices rather than scaling a 70 x 52.8 m box to new bounds.
  function clipX(points:T.Vector2[],bound:number,keepGreater:boolean):T.Vector2[] {
    const out:T.Vector2[]=[];
    for(let i=0;i<points.length;i++) {
      const p=points[i],q=points[(i+1)%points.length];
      const pin=keepGreater?p.x>=bound:p.x<=bound,qin=keepGreater?q.x>=bound:q.x<=bound;
      if(pin)out.push(p);
      if(pin!==qin)out.push(p.clone().lerp(q,(bound-p.x)/(q.x-p.x)));
    }
    return out;
  }
  function meshTriangles(vertices:number[],colour:Parameters<BuildingTools['add']>[1],assembly:string) {
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();add(g,colour,assembly);
  }
  function triangle(out:number[],a:T.Vector3,b:T.Vector3,c:T.Vector3,up:boolean) {
    const n=b.clone().sub(a).cross(c.clone().sub(a));
    if((n.y>0)!==up)[b,c]=[c,b];
    if(n.lengthSq()>1e-14)out.push(...a.toArray(),...b.toArray(),...c.toArray());
  }
  function verticalQuad(out:number[],a:T.Vector2,b:T.Vector2,loA:number,hiA:number,loB:number,hiB:number) {
    // Native ring is clockwise in XZ; outward triangles follow its perimeter.
    out.push(a.x,loA,a.y,b.x,hiB,b.y,a.x,hiA,a.y,a.x,loA,a.y,b.x,loB,b.y,b.x,hiB,b.y);
  }
  const surface:number[]=[];
  for(let i=0;i<section.length-1;i++) {
    const a=section[i],q=section[i+1],dx=q.x-a.x;
    if(Math.abs(dx)<1e-8) {
      // East office wall belongs to the exposed glass assembly, not opaque skin.
      if(Math.abs(a.x-officeEast)<.001&&Math.min(a.y,q.y)>=20.69)continue;
      const zs:number[]=[];
      for(let k=0;k<nativeRing.length;k++) {
        const p=nativeRing[k],r=nativeRing[(k+1)%nativeRing.length];
        if((p.x<=a.x&&r.x>a.x)||(r.x<=a.x&&p.x>a.x))zs.push(p.y+(r.y-p.y)*(a.x-p.x)/(r.x-p.x));
      }
      zs.sort((p,q)=>p-q);
      if(zs.length>=2) {
        const z0=zs[0],z1=zs[zs.length-1];
        const quad=[new T.Vector3(a.x,a.y,z0),new T.Vector3(a.x,q.y,z0),new T.Vector3(a.x,q.y,z1),new T.Vector3(a.x,a.y,z1)];
        // Section edge direction determines the outward normal.
        if(q.y>a.y)quad.reverse();
        surface.push(...quad[0].toArray(),...quad[1].toArray(),...quad[2].toArray(),...quad[0].toArray(),...quad[2].toArray(),...quad[3].toArray());
      }
      continue;
    }
    for(const plan of planTriangles) {
      const polygon=clipX(clipX(plan,Math.min(a.x,q.x),true),Math.max(a.x,q.x),false);
      const vertices=polygon.map(p=>new T.Vector3(p.x,a.y+(q.y-a.y)*(p.x-a.x)/dx,p.y));
      for(let k=1;k<vertices.length-1;k++)triangle(surface,vertices[0],vertices[k],vertices[k+1],dx<0);
    }
  }
  meshTriangles(surface,'concrete','native-section-shell');
  function heights(x:number,intervalX=x):[number,number] {
    const ys:number[]=[];
    for(let i=0;i<section.length-1;i++) {
      const a=section[i],q=section[i+1];
      if(Math.abs(q.x-a.x)>1e-8&&intervalX>=Math.min(a.x,q.x)-1e-7&&intervalX<=Math.max(a.x,q.x)+1e-7)ys.push(a.y+(q.y-a.y)*(x-a.x)/(q.x-a.x));
    }
    return [Math.min(...ys),Math.max(...ys)];
  }
  const glass:number[]=[],rim:number[]=[],sideWalls:number[]=[];
  for(let i=0;i<nativeRing.length;i++) {
    const a=nativeRing[i],q=nativeRing[(i+1)%nativeRing.length],dx=q.x-a.x;
    const ends=Math.abs(dx)>Math.abs(q.y-a.y);
    const cuts=[0,1,...section.map(p=>(p.x-a.x)/dx).filter(f=>Number.isFinite(f)&&f>0&&f<1)].sort((a,b)=>a-b);
    for(let k=0;k<cuts.length-1;k++) {
      const p=a.clone().lerp(q,cuts[k]),r=a.clone().lerp(q,cuts[k+1]);
      if(p.distanceToSquared(r)<1e-12)continue;
      // Evaluate within this section interval: at the vertical office edge the
      // low hall and tower have distinct one-sided heights.
      const mid=(p.x+r.x)/2,[lo,hi]=heights(p.x,mid),[loR,hiR]=heights(r.x,mid);
      verticalQuad(ends?glass:sideWalls,p,r,lo,hi,loR,hiR);
      if(ends){verticalQuad(rim,p,r,lo,lo+.65,loR,loR+.65);verticalQuad(rim,p,r,hi-.65,hi,hiR-.65,hiR)}
    }
  }
  meshTriangles(glass,'glass','native-end-glass');meshTriangles(sideWalls,'concrete','native-side-wall');
  // Rim owns a thin exposed plane, leaving the surveyed assembly itself at the source boundary.
  const rimGeometry=new T.BufferGeometry();rimGeometry.setAttribute('position',new T.Float32BufferAttribute(rim,3));rimGeometry.computeVertexNormals();
  const rp=rimGeometry.getAttribute('position');for(let i=0;i<rp.count;i++)rp.setZ(i,rp.getZ(i)+(rp.getZ(i)>0?.035:-.035));add(rimGeometry,'concrete');
  function endZ(x:number,side:number):number {
    const zs:number[]=[];
    for(let i=0;i<nativeRing.length;i++){const a=nativeRing[i],q=nativeRing[(i+1)%nativeRing.length];if(x>=Math.min(a.x,q.x)&&x<=Math.max(a.x,q.x)&&Math.abs(q.x-a.x)>1e-8)zs.push(a.y+(q.y-a.y)*(x-a.x)/(q.x-a.x))}
    return side<0?Math.min(...zs):Math.max(...zs);
  }
  for(const side of[-1,1]) {
    for(let x=left+3;x<right-1;x+=3.1){const [lo,hi]=heights(x);box(x,lo+.7,endZ(x,side)+side*.07,.12,Math.max(.1,hi-lo-1.4),.14,'frame')}
    // Segment bars follow surveyed end walls, instead of spanning a flat plane.
    for(const y of[11,13.8,21,24.2,27.4,30.6,33.8,37,40.2,43.4]) {
      for(let i=0;i<nativeRing.length;i++) {
        const a=nativeRing[i],q=nativeRing[(i+1)%nativeRing.length];
        if(Math.abs(q.x-a.x)<Math.abs(q.y-a.y)||Math.sign((a.y+q.y)/2)!==side)continue;
        const xs=[a.x,q.x,...section.map(p=>p.x).filter(x=>x>Math.min(a.x,q.x)&&x<Math.max(a.x,q.x))].sort((a,b)=>a-b);
        for(let k=0;k<xs.length-1;k++) {
          const x0=xs[k],x1=xs[k+1],mid=(x0+x1)/2,[lo,hi]=heights(mid);
          if(y<=lo+.65||y>=hi-.65)continue;
          const g=new T.BoxGeometry(x1-x0,.11,.14);g.rotateY(-Math.atan2(q.y-a.y,q.x-a.x));g.translate(mid,y+.055,endZ(mid,side)+side*.07);add(g,'frame');
        }
      }
    }
  }
  // Broad east-facing curtain wall, exposed after removing its opaque parent wall.
  // The opposite west face retains its curved silver shoulder and original supported roof.
  box(officeEast+.02,20.7,0,.08,25.99,52.8,'glass');
  for(let z=-25;z<26;z+=2.65)box(officeEast+.09,20.7,z,.12,25.99,.09,'dark');
  for(let y=22;y<46.6;y+=1.6)box(officeEast+.09,y,0,.12,.09,52.8,'dark');
  // Opposite west face is metal with genuine glass slots, not painted opaque bars.
  // Slots are slightly proud of the uninterrupted low-poly backing, with exposed panes
  // and individual joints; the source leaves rounded returns and edge strips metal.
  for(let y=22;y<43;y+=3.2) {
    box(officeWest-.07,y,0,.13,.75,46,'glass');
    for(let z=-22.8;z<23;z+=3.2)box(officeWest-.16,y,z,.07,.75,.09,'dark');
    for(const edge of[0,.75])box(officeWest-.16,y+edge,0,.07,.06,46,'frame');
  }
  // Recessed ground glazed strip leaves continuous open circulation around it.
  const groundPart=footprints.parts.find(p=>p.id==='w806950194')!;
  const groundRing=raiSectionRing(groundPart.geometry.coordinates[0][0]),groundShape=new T.Shape(groundRing);
  // Mapped ground part is 4 m tall. The old 7.8 m rectangle filled an unsurveyed
  // volume beneath the ribbon; preserve the open vertical gap above its native roof.
  add(openTopPrism(groundShape,0,groundPart.properties.height),'glass','native-ground-shell');
  add(upwardRoofPlane(groundShape,groundPart.properties.height),'concrete','native-ground-roof');
  for(let i=0;i<groundRing.length;i++) {
    const a=groundRing[i],q=groundRing[(i+1)%groundRing.length],length=a.distanceTo(q),count=Math.floor(length/3.2);
    for(let k=1;k<=count;k++) {
      const p=a.clone().lerp(q,k/(count+1));box(p.x,0,p.y,.12,4,.12,'frame');
    }
  }
  // Rai-landsc shows a distinct elevated glazed concourse above the open base.
  // Part196's min_height4 supports its datum, not a ground-to-roof fill. The
  // original section's raised floor owns the7.7m top; height15 is not used as
  // this concourse's ceiling. Keep its real mapped plan instead of the parent.
  const concoursePart=footprints.parts.find(p=>p.id==='w806950196')!;
  const concourseRing=raiSectionRing(concoursePart.geometry.coordinates[0][0]);
  const concourseShape=new T.Shape(concourseRing);
  add(openTopPrism(concourseShape,concoursePart.properties.minHeight,7.7),'glass','native-concourse-shell');
  add(upwardRoofPlane(concourseShape,concoursePart.properties.minHeight),'concrete','native-concourse-floor');
  for(let i=0;i<concourseRing.length;i++) {
    const a=concourseRing[i],q=concourseRing[(i+1)%concourseRing.length],length=a.distanceTo(q),count=Math.floor(length/3.2);
    for(let k=1;k<=count;k++) {
      const p=a.clone().lerp(q,k/(count+1));box(p.x,4,p.y,.12,3.7,.12,'frame');
    }
  }

  add(openTopPrism(nativeShape,7.7,8.05),'concrete','native-slab-shell');
  add(upwardRoofPlane(nativeShape,8.05),'concrete','native-slab-roof');
  function beam(a:T.Vector3,q:T.Vector3) {const d=q.clone().sub(a),g=new T.BoxGeometry(.6,d.length(),.6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));const m=a.clone().add(q).multiplyScalar(.5);g.translate(m.x,m.y,m.z);add(g,'frame')}
  for(const z of[-22,22])for(const x of[-31,6,25])beam(new T.Vector3(x-2.5,0,z),new T.Vector3(x+1,7.7,z));
  // Small connecting walkways stay elevated, retaining the public ground passage.
  // Connector beyond the surveyed parent is deliberately left to native context.
}
