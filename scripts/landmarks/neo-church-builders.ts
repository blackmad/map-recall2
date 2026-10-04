import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './neo-church-footprints.json';

/** Original neo-Gothic/neo-Romanesque silhouettes on actual church plans. */
export function buildNeoChurchLandmark(id:string,_w:number,_d:number,b:BuildingTools){
  type Colour=Parameters<BuildingTools['add']>[1];
  const site=data.find(s=>s.id===id)!,lon=111320*Math.cos(site.anchor[1]*Math.PI/180);
  const point=(p:number[])=>new T.Vector2((p[0]-site.anchor[0])*lon,-(p[1]-site.anchor[1])*110540);
  const ring=(p:number[][])=>p.slice(0,-1).map(point),parent=ring(site.parent.ring);
  const inside=(q:T.Vector2,r:T.Vector2[])=>{let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){
    const a=r[i],p=r[j];if((a.y>q.y)!==(p.y>q.y)&&q.x<(p.x-a.x)*(q.y-a.y)/(p.y-a.y)+a.x)yes=!yes;
  }return yes;};
  function mesh(v:number[],c:Colour){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();b.add(g,c);}
  function solid(r:T.Vector2[],bottom:number,top:number,c:Colour='brick'){if(top<=bottom)return;const g=new T.ExtrudeGeometry(new T.Shape(r),{depth:top-bottom,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,top,0);b.add(g,c);}
  function flat(r:T.Vector2[],y:number){const g=new T.ShapeGeometry(new T.Shape(r));g.rotateX(Math.PI/2);g.translate(0,y,0);b.add(g,'slate');}
  function offset(q:T.Vector2,a:number,d:number,u=0){return new T.Vector2(q.x+Math.sin(a)*d+Math.cos(a)*u,q.y+Math.cos(a)*d-Math.sin(a)*u);}
  function panel(q:T.Vector2,y:number,w:number,h:number,a:number,c:Colour,pointed=true){
    const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);
    if(pointed){s.lineTo(w/2,h-w*.62);s.quadraticCurveTo(w*.28,h-.05,0,h);s.quadraticCurveTo(-w*.28,h-.05,-w/2,h-w*.62);}else{s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);}s.closePath();
    b.add(new T.ExtrudeGeometry(s,{depth:.12,bevelEnabled:false,curveSegments:5}),c,q.x,y,q.y,a);
  }
  function window(q:T.Vector2,y:number,w:number,h:number,a:number,pointed=true){panel(q,y,w+.22,h+.22,a,'stone',pointed);panel(offset(q,a,.13),y+.11,w,h,a,'dark',pointed);
    for(const u of [-w*.23,w*.23]){const p=offset(q,a,.29,u);b.box(p.x,y+.2,p.y,.085,h-w*.62,.1,'stone',a);}
    for(let v=1;v<h-w*.55;v+=1.3){const p=offset(q,a,.29);b.box(p.x,y+v,p.y,w,.08,.1,'stone',a);}
    if(pointed){const p=offset(q,a,.30);b.add(new T.TorusGeometry(w*.17,.06,4,10),'stone',p.x,y+h-w*.53,p.y,a);}
  }
  function pitched(r:T.Vector2[],fit:typeof site.fit,eave:number,rise:number){
    const c=point(fit.centre),a=(90-fit.headingDegrees)*Math.PI/180,side=new T.Vector2(Math.sin(a),Math.cos(a));
    const cross=(q:T.Vector2)=>q.clone().sub(c).dot(side),half=fit.widthMetres/2;
    const height=(q:T.Vector2)=>eave+rise*Math.max(0,1-Math.abs(cross(q))/half);
    function clip(poly:T.Vector2[],positive:boolean){const out:T.Vector2[]=[];for(let i=0;i<poly.length;i++){
      const u=poly[i],v=poly[(i+1)%poly.length],du=cross(u),dv=cross(v),iu=positive?du>=-1e-8:du<=1e-8,iv=positive?dv>=-1e-8:dv<=1e-8;
      if(iu)out.push(u);if(iu!==iv)out.push(u.clone().lerp(v,du/(du-dv)));
    }return out;}
    const g=new T.ShapeGeometry(new T.Shape(r)),p=g.getAttribute('position'),idx=g.getIndex()!,v:number[]=[];
    for(let k=0;k<idx.count;k+=3){const tri=Array.from({length:3},(_,i)=>new T.Vector2(p.getX(idx.getX(k+i)),p.getY(idx.getX(k+i))));for(const poly of [clip(tri,false),clip(tri,true)])for(let j=1;j<poly.length-1;j++)v.push(...[poly[0],poly[j],poly[j+1]].flatMap(q=>[q.x,height(q),q.y]));}mesh(v,'slate');
    for(let i=0;i<r.length;i++){const u=r[i],z=r[(i+1)%r.length],cuts=[u];if(cross(u)*cross(z)<0)cuts.push(u.clone().lerp(z,cross(u)/(cross(u)-cross(z))));cuts.push(z);
      for(let j=0;j<cuts.length-1;j++){const q=cuts[j],p=cuts[j+1];mesh([q.x,eave,q.y,p.x,eave,p.y,p.x,height(p),p.y,q.x,eave,q.y,p.x,height(p),p.y,q.x,height(q),q.y],'brick');}
    }
  }
  function edges(r:T.Vector2[],bottom:number,top:number,blocked:{r:T.Vector2[];top:number}[]=[],skip?:(q:T.Vector2,n:T.Vector2)=>boolean){
    if(top-bottom<3)return;
    for(let i=0;i<r.length;i++){const p=r[i],v=r[(i+1)%r.length].clone().sub(p),L=v.length();if(L<3.1)continue;v.normalize();let n=new T.Vector2(-v.y,v.x),mid=p.clone().addScaledVector(v,L/2);if(inside(mid.clone().addScaledVector(n,.2),r))n.multiplyScalar(-1);
      const a=Math.atan2(n.x,n.y),count=Math.max(1,Math.floor(L/5.2));for(let j=0;j<count;j++){const q=p.clone().addScaledVector(v,L*(j+.5)/count).addScaledVector(n,.13);
        if(skip?.(q,n))continue;
        const floor=Math.max(bottom,...blocked.filter(o=>inside(q.clone().addScaledVector(n,.45),o.r)).map(o=>o.top));
        if(top-floor<3)continue;
        window(q,floor+1.4,Math.min(2.5,L/count*.55),Math.min(9,top-floor-2.2),a,id==='dominicuskerk');
      }
    }
  }
  function line(from:T.Vector3,to:T.Vector3,r:number,c:Colour){const d=to.clone().sub(from),g=new T.CylinderGeometry(r,r,d.length(),5);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));const m=from.clone().add(to).multiplyScalar(.5);b.add(g,c,m.x,m.y,m.z);}
  function dial(q:T.Vector2,y:number,r:number,a:number){for(const [radius,c,d] of [[r+.10,'stone',.1],[r,'dark',.14]] as [number,Colour,number][]){const g=new T.CylinderGeometry(radius,radius,d,20);g.rotateX(Math.PI/2);b.add(g,c,q.x,y,q.y,a);}
    const p=offset(q,a,.16);for(let k=0;k<12;k++){const t=k*Math.PI/6,u=offset(p,a,0,Math.sin(t)*r*.82);b.box(u.x,y+Math.cos(t)*r*.82-.055,u.y,.075,.11,.055,'gold',a);}
    const u=offset(p,a,0,-r*.48);line(new T.Vector3(p.x,y,p.y),new T.Vector3(u.x,y+r*.53,u.y),.045,'gold');line(new T.Vector3(p.x,y,p.y),new T.Vector3(p.x,y+r*.74,p.y),.04,'gold');
  }
  if(id==='dominicuskerk'){
    solid(parent,0,11);flat(parent,11.03);
    const parts=site.buildings.map(p=>({raw:p,r:ring(p.ring),top:Math.min(site.heightMetres,Number(p.tags.height)),bottom:Number((p.tags as Record<string,string>).min_height||0),rise:Number((p.tags as Record<string,string>)['roof:height']||0)}));
    for(const p of parts){const eave=p.raw.id==='w749287653'?28:p.top-p.rise;solid(p.r,p.bottom,eave);
      if((p.raw.tags as Record<string,string>)['roof:shape']==='pyramidal'){
        const c=point(p.raw.fit.centre),v:number[]=[];for(let i=0;i<p.r.length;i++){const u=p.r[i],q=p.r[(i+1)%p.r.length];v.push(u.x,eave,u.y,q.x,eave,q.y,c.x,p.top,c.y);}mesh(v,'slate');
      }else if(p.rise)pitched(p.r,p.raw.fit,eave,p.rise);else flat(p.r,eave+.03);
      edges(p.r,p.bottom,eave,parts.filter(q=>q!==p).map(q=>({r:q.r,top:q.top-q.rise})));
    }
    // The older mapped church roof patch protrudes into a separate current BAG
    // neighbor. Replace its generic block with only the roof inside this parent.
    const legacy=site.legacyRoof;
    if(legacy){const clipper=ring(legacy.ring),g=new T.ShapeGeometry(new T.Shape(parent)),ps=g.getAttribute('position'),ix=g.getIndex()!;
      const area=clipper.reduce((v,p,i)=>v+p.x*clipper[(i+1)%clipper.length].y-clipper[(i+1)%clipper.length].x*p.y,0),sgn=area>=0?1:-1;
      for(let k=0;k<ix.count;k+=3){let polygon=Array.from({length:3},(_,j)=>new T.Vector2(ps.getX(ix.getX(k+j)),ps.getY(ix.getX(k+j))));
        for(let i=0;i<clipper.length;i++){const p=clipper[i],v=clipper[(i+1)%clipper.length].clone().sub(p),dist=(q:T.Vector2)=>sgn*(v.x*(q.y-p.y)-v.y*(q.x-p.x)),out:T.Vector2[]=[];
          for(let j=0;j<polygon.length;j++){const u=polygon[j],z=polygon[(j+1)%polygon.length],du=dist(u),dz=dist(z);if(du>=-1e-8)out.push(u);if((du>=-1e-8)!==(dz>=-1e-8))out.push(u.clone().lerp(z,du/(du-dz)));}polygon=out;}
        if(polygon.length>=3)pitched(polygon,legacy.fit,21,4);
      }
    }
    // Pinnacles follow the actual long aisle edges; small corner turret is
    // deliberately separate from the never-built monumental tower proposal.
    const aisle=parts.find(p=>p.raw.id==='w749287651')!;
    for(let i=0;i<aisle.r.length;i++){const u=aisle.r[i],v=aisle.r[(i+1)%aisle.r.length].clone().sub(u),L=v.length();if(L<15)continue;v.normalize();let n=new T.Vector2(-v.y,v.x);if(inside(u.clone().addScaledVector(v,L/2).addScaledVector(n,.3),aisle.r))n.multiplyScalar(-1);
      for(let t=1.8;t<L;t+=5.9){const q=u.clone().addScaledVector(v,t).addScaledVector(n,.13),a=Math.atan2(n.x,n.y);b.box(q.x,0,q.y,.5,18.4,.65,'brick',a);b.box(q.x,17.2,q.y,.7,.2,.8,'stone',a);b.box(q.x,18.4,q.y,.46,2.0,.46,'stone',a);b.add(new T.ConeGeometry(.34,1.65,4),'stone',q.x,21.225,q.y);}
    }
    const turret=point([4.8929415,52.376903]);b.add(new T.CylinderGeometry(.95,.95,18.6,8),'brick',turret.x,9.3,turret.y);b.add(new T.CylinderGeometry(1.0,1.05,2.6,8),'stone',turret.x,19.9,turret.y);
    for(let k=0;k<6;k++){const a=k*Math.PI/3,q=offset(turret,a,1.02);panel(q,19, .40,1.8,a,'dark');}
    b.add(new T.ConeGeometry(1.28,6.8,8),'slate',turret.x,24.6,turret.y);b.box(turret.x,28,turret.y,.08,.6,.08,'gold');b.box(turret.x,28.32,turret.y,.46,.065,.065,'gold');
    const entry=point([4.893526,52.377133]),a=(90-site.fit.headingDegrees)*Math.PI/180+Math.PI/2;
    panel(entry,0,3.3,6.4,a,'stone');panel(offset(entry,a,.14),.15,2.9,6.0,a,'dark');window(offset(entry,a,.27),3.0,2.5,3.0,a);
  }else{
    solid(parent,0,9.1);flat(parent,9.15);
    const angle=(90-site.fit.headingDegrees)*Math.PI/180;
    const front=point([4.889590,52.349858]),axis=new T.Vector2(Math.cos(angle),-Math.sin(angle)),c=front.clone().addScaledVector(axis,22.5);
    // Keep the actual west entrance doors clear of repeated side-aisle windows.
    edges(parent,0,9.1,[],(q,n)=>q.distanceTo(front)<9&&n.dot(axis)<-.65);
    const fitFor=(q:T.Vector2,L:number,W:number,heading:number)=>({centre:[site.anchor[0]+q.x/lon,site.anchor[1]-q.y/110540],headingDegrees:heading,lengthMetres:L,widthMetres:W});

    const clippedRectangle=(centre:T.Vector2,L:number,W:number,a:number)=>{let polygon=parent.slice();
      const axes=[new T.Vector2(Math.cos(a),-Math.sin(a)),new T.Vector2(Math.sin(a),Math.cos(a))];
      for(let axis=0;axis<2;axis++)for(const sign of [-1,1]){const n=axes[axis],limit=(axis===0?L:W)/2,out:T.Vector2[]=[];
        const distance=(p:T.Vector2)=>sign*p.clone().sub(centre).dot(n)-limit;
        for(let i=0;i<polygon.length;i++){const p=polygon[i],q=polygon[(i+1)%polygon.length],dp=distance(p),dq=distance(q);if(dp<=1e-8)out.push(p);if((dp<=1e-8)!==(dq<=1e-8))out.push(p.clone().lerp(q,dp/(dp-dq)));}
        polygon=out;}return polygon;};
    const nave=clippedRectangle(c,45,15.6,angle);solid(nave,9.1,13.8);pitched(nave,fitFor(c,45,15.6,site.fit.headingDegrees),13.8,12.2);
    const transeptCentre=point([4.89017,52.34988]),transept=clippedRectangle(transeptCentre,30.8,12.5,angle+Math.PI/2);solid(transept,9.1,14.2);pitched(transept,{centre:[4.89017,52.34988],headingDegrees:site.fit.headingDegrees-90,lengthMetres:30.8,widthMetres:12.5},14.2,9.7);
    // Bell tower's surveyed small footprint, three documented mapped roof parts.
    const tower=site.buildings[0],tr=ring(tower.ring),tc=point(tower.fit.centre),ta=(90-tower.fit.headingDegrees)*Math.PI/180,W=tower.fit.widthMetres,L=tower.fit.lengthMetres;
    solid(tr,0,37);
    const roof:number[]=[];for(let i=0;i<tr.length;i++){const p=tr[i],q=tr[(i+1)%tr.length];roof.push(p.x,37,p.y,q.x,37,q.y,tc.x,49,tc.y);}mesh(roof,'slate');
    for(let s=0;s<4;s++){const a=ta+s*Math.PI/2,depth=s%2===0?W/2:L/2,width=s%2===0?L:W,q=offset(tc,a,depth+.08);
      for(const u of [-width*.22,0,width*.22]){const p=offset(q,a,.02,u);b.box(p.x,10,p.y,.28,17.2,.16,'dark',a);for(const y of [15.3,20.4,25.5])b.box(p.x,y,p.y,.37,.18,.22,'brick',a);panel(offset(q,a,.01,u),35.3,.65,2.25,a,'dark',false);}
      dial(offset(q,a,.18),31.0,1.05,a);
      // Red/ochre triangular tile fields below the lead spire.
      const left=offset(q,a,.13,-width*.43),right=offset(q,a,.13,width*.43),tip=offset(q,a,.13);mesh([left.x,37,left.y,right.x,37,right.y,tip.x,40,tip.y],'red');
      for(let y=37.4;y<39.5;y+=.43){const span=width*.43*(1-(y-37)/3);for(let x=-span;x<span;x+=.45){if((Math.round(x/.45)+Math.round(y/.43))%2)continue;const p=offset(q,a,.18,x);b.box(p.x,y,p.y,.30,.29,.075,'gold',a);}}
    }
    b.box(tc.x,49,tc.y,.085,1,.085,'dark');b.box(tc.x,49.65,tc.y,.6,.08,.08,'dark');
    const a=angle-Math.PI/2;
    panel(front,0,5.0,7.0,a,'brick');panel(offset(front,a,.16),.12,3.4,5.5,a,'dark');
    const rose=offset(front,a,.30);for(const [r,col] of [[1.75,'stone'],[1.50,'dark']] as [number,Colour][]){const g=new T.CylinderGeometry(r,r,.14,24);g.rotateX(Math.PI/2);b.add(g,col,rose.x,17.8,rose.y,a);}
    for(let k=0;k<8;k++){const t=k*Math.PI/4,u=offset(rose,a,.15,Math.cos(t)*1.05);b.add(new T.TorusGeometry(.39,.07,4,10),'stone',u.x,17.8+Math.sin(t)*1.05,u.y,a);}
    for(const u of [-4.8,4.8])panel(offset(front,a,.10,u),0,1.7,3.3,a,'dark',false);
    const badge=offset(front,a,.2);for(let y=21.1;y<23.2;y+=.45){const span=1.65*(1-(y-21.1)/2.5);for(let x=-span;x<span;x+=.45){const q=offset(badge,a,.05,x);b.box(q.x,y,q.y,.32,.32,.075,(Math.round(x/.45)+Math.round(y/.45))%2?'gold':'red',a);}}
  }
}
