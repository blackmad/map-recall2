import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './secondary-church-footprints.json';
type Colour='brick'|'stone'|'slate'|'white'|'gold'|'glass'|'dark'|'frame'|'red'|'blue';

/** Original small church silhouettes, with the real rear halls and narrow portals. */
export function buildSecondaryChurchLandmark(id:string,_w:number,_d:number,b:BuildingTools){
 const site=data.sites.find(s=>s.id===id)!;
 const {add,box}=b,lon=111320*Math.cos(site.anchor[1]*Math.PI/180);
 const point=(p:number[])=>new T.Vector2((p[0]-site.anchor[0])*lon,-(p[1]-site.anchor[1])*110540);
 const ring=site.parent.geometry.coordinates[0][0].slice(0,-1).map(point);
 const angle=(90-site.fit.headingDegrees)*Math.PI/180;
 const local=(x:number,z:number)=>new T.Vector2(x*Math.cos(angle)+z*Math.sin(angle),-x*Math.sin(angle)+z*Math.cos(angle));
 function solid(r:T.Vector2[],h:number,c:Colour){const g=new T.ExtrudeGeometry(new T.Shape(r),{depth:h,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,h,0);add(g,c);}
 function surface(vertices:number[],c:Colour){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();add(g,c);}
 function panel(q:T.Vector2,y:number,w:number,h:number,a:number,c:Colour,pointed=true,depth=.16){
  const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);
  if(pointed){s.lineTo(w/2,h-w*.65);s.quadraticCurveTo(w*.3,h-.08,0,h);s.quadraticCurveTo(-w*.3,h-.08,-w/2,h-w*.65);}
  else{s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);}
  s.closePath();add(new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:5}),c,q.x,y,q.y,a);
 }
 function offset(q:T.Vector2,a:number,forward:number,side=0){return new T.Vector2(q.x+Math.sin(a)*forward+Math.cos(a)*side,q.y+Math.cos(a)*forward-Math.sin(a)*side);}
 function window(q:T.Vector2,y:number,w:number,h:number,a:number,pointed=true){
  panel(q,y,w+.3,h+.25,a,'stone',pointed);panel(offset(q,a,.17),y+.13,w,h,a,'dark',pointed);
  for(const u of [-w*.25,0,w*.25]){const p=offset(q,a,.37,u);box(p.x,y+.2,p.y,.09,h-w*.65,.1,'white',a);}
  for(let v=.8;v<h-w*.5;v+=1.1){const p=offset(q,a,.36);box(p.x,y+v,p.y,w,.08,.1,'white',a);}
 }
 function circle(q:T.Vector2,y:number,r:number,a:number){for(const [radius,c,d] of [[r+.14,'stone',.15],[r,'dark',.2]] as [number,Colour,number][]){const g=new T.CylinderGeometry(radius,radius,d,16);g.rotateX(Math.PI/2);add(g,c,q.x,y,q.y,a);}const p=offset(q,a,.17);box(p.x,y-r,p.y,.1,r*2,.13,'white',a);box(p.x,y-.05,p.y,r*2,.1,.13,'white',a);}
 function pitched(center:T.Vector2,L:number,W:number,eave:number,rise:number,a:number,hipEnd=false,c:Colour='brick'){
  const xyz=(x:number,y:number,z:number)=>[center.x+x*Math.cos(a)+z*Math.sin(a),y,center.y-x*Math.sin(a)+z*Math.cos(a)];
  const ridge=hipEnd?L/2-W/2:L/2,roof:number[]=[],walls:number[]=[];
  for(const s of [-1,1])roof.push(...xyz(-L/2,eave,s*W/2),...xyz(L/2-(hipEnd?W/4:0),eave,s*W/2),...xyz(ridge,eave+rise,0),...xyz(-L/2,eave,s*W/2),...xyz(ridge,eave+rise,0),...xyz(-L/2,eave+rise,0));
  walls.push(...xyz(-L/2,eave,-W/2),...xyz(-L/2,eave,W/2),...xyz(-L/2,eave+rise,0));
  if(hipEnd){const edge=[[L/2-W/4,-W/2],[L/2,-W/4],[L/2,W/4],[L/2-W/4,W/2]];for(let i=0;i<edge.length-1;i++)roof.push(...xyz(...[edge[i][0],eave,edge[i][1]]),...xyz(...[edge[i+1][0],eave,edge[i+1][1]]),...xyz(ridge,eave+rise,0));}
  else walls.push(...xyz(L/2,eave,-W/2),...xyz(L/2,eave,W/2),...xyz(L/2,eave+rise,0));
  surface(roof,'slate');surface(walls,c);
 }
 function exterior(eave:number,pointed=true){
  for(let i=0;i<ring.length;i++){
   const p=ring[i],v=ring[(i+1)%ring.length].clone().sub(p),L=v.length();if(L<(id==='buiksloterkerk'?2.2:4))continue;v.normalize();
   let n=new T.Vector2(-v.y,v.x),mid=p.clone().addScaledVector(v,L/2);
   // Polygon orientation determines the outside; test a small offset.
   let inside=false,test=mid.clone().addScaledVector(n,.3);for(let k=0,j=ring.length-1;k<ring.length;j=k++){const a=ring[k],z=ring[j];if((a.y>test.y)!==(z.y>test.y)&&test.x<(z.x-a.x)*(test.y-a.y)/(z.y-a.y)+a.x)inside=!inside;}if(inside)n.multiplyScalar(-1);
   const a=Math.atan2(n.x,n.y),count=Math.max(1,Math.floor(L/5));
   for(let k=0;k<count;k++){const q=p.clone().addScaledVector(v,L*(k+.5)/count).addScaledVector(n,.12);window(q,1.7,Math.min(2.4,L/count*.55),eave-2.4,a,pointed);
    if(id==='buiksloterkerk')for(const side of [-1,1]){const x=q.clone().addScaledVector(v,side*1.7);box(x.x,0,x.y,.65,eave-.3,1.1,'brick',a);box(x.x,eave-.3,x.y,.8,.22,1.2,'stone',a);}
   }
  }
 }
 function spire(q:T.Vector2,y:number,r:number,h:number){add(new T.ConeGeometry(r,h,8),'slate',q.x,y+h/2,q.y);for(const u of [-1,1])box(q.x+u*.05,y+h,q.y,.08,.45,.08,'gold');box(q.x,y+h+.15,q.y,.6,.06,.06,'gold');}
 if(id==='buiksloterkerk'){
  solid(ring,9.1,'brick');exterior(9.1,false);
  pitched(local(.4,0),30,12.3,9.1,7.0,angle,true);
  // Lower crosswise side niches keep the actual village-church plan legible.
  for(const s of [-1,1]){const q=local(0,s*7.1);pitched(q,3.4,8.2,9.1,2.5,angle+Math.PI/2,false);}
  const q=local(-11.5,0);box(q.x,15.7,q.y,3.2,3.6,3.2,'white',angle);
  for(let side=0;side<4;side++){const a=angle+side*Math.PI/2,p=offset(q,a,1.63);panel(p,16.35,1.1,2.05,a,'dark',false);box(p.x,15.65,p.y,3.4,.18,.18,'stone',a);}
  spire(q,19.3,2.0,site.measuredHeight-19.3-.45);
  const front=local(-15.1,0),a=angle-Math.PI/2;panel(front,0,2.0,3.9,a,'stone',false);panel(offset(front,a,.16),.1,1.65,3.5,a,'dark',false);
 }else if(id==='english-reformed-church'){
  solid(ring,7.4,'white');exterior(7.4,true);
  const lowRoof=new T.ShapeGeometry(new T.Shape(ring));lowRoof.rotateX(Math.PI/2);lowRoof.translate(0,7.43,0);add(lowRoof,'slate');
  // Main nave remains far smaller than the monumental central-city churches.
  pitched(local(-1.1,0),31.0,11.7,7.4,5.2,angle,false,'white');
  const towerRing=site.buildings[0].geometry.coordinates[0][0].slice(0,-1).map(point),q=towerRing.reduce((a,p)=>a.add(p),new T.Vector2()).multiplyScalar(1/towerRing.length);
  const edge=towerRing[1].clone().sub(towerRing[0]),towerAngle=Math.atan2(-edge.y,edge.x);
  solid(towerRing,14.4,'brick');
  for(let side=0;side<4;side++){const a=towerAngle+side*Math.PI/2,p=offset(q,a,1.85);box(p.x,4.6,p.y,3.7,.12,.17,'stone',a);box(p.x,9.6,p.y,3.7,.12,.17,'stone',a);window(p,5.4,1.05,2.7,a);circle(p,9.0,.4,a);for(const u of [-.48,.48])panel(offset(p,a,.03,u),11.2,.7,1.75,a,'dark',false);}
  box(q.x,14.4,q.y,4.0,.22,4.0,'stone',towerAngle);spire(q,14.62,1.8,site.measuredHeight-14.62-.45);
  const front=offset(q,towerAngle,1.9);panel(front,0,1.4,3.0,towerAngle,'stone',false);panel(offset(front,towerAngle,.17),.15,1.15,2.6,towerAngle,'dark',false);
 }else if(id==='de-papegaai'){
  solid(ring,11.8,'brick');
  // A narrow entrance passage leads to the broad hidden three-aisled hall.
  const rear=point([4.89132,52.37116]);pitched(rear,18.0,11.4,11.8,4.7,angle,false);
  const mid=point([4.89163,52.371215]);pitched(mid,22,5.0,11.8,3.0,angle,false);
  const a=point([4.8918628,52.3712134]),z=point([4.891874,52.3712504]),q=a.clone().add(z).multiplyScalar(.5),v=z.clone().sub(a),width=v.length(),n=new T.Vector2(-v.y,v.x).normalize(),face=Math.atan2(n.x,n.y);
  const p=offset(q,face,-.22);box(p.x,0,p.y,width,site.measuredHeight-3.0,.48,'brick',face);
  for(const side of [-1,1]){const edge=offset(q,face,.17,side*(width/2-.12));box(edge.x,0,edge.y,.26,site.measuredHeight-3,.3,'stone',face);}
  // The entrance gable sits below the upper traceried windows, as photographed.
  panel(q,0,width-.38,4.3,face,'dark',false);const lintel=offset(q,face,.22);box(lintel.x,4.25,lintel.y,width,.32,.55,'stone',face);
  for(let y of [5.0,9.0])for(const side of [-1,0,1])window(offset(q,face,.24,side*width*.24),y,.78,3.45,face,true);
  const tri=(y:number,h:number,w:number,colour:Colour)=>{const l=offset(q,face,.50,-w/2),r=offset(q,face,.50,w/2);surface([l.x,y,l.y,r.x,y,r.y,q.x+Math.sin(face)*.5,y+h,q.y+Math.cos(face)*.5],colour);};
  tri(4.6,3.3,width*.84,'stone');tri(4.9,2.55,width*.67,'brick');tri(site.measuredHeight-3,3,width,'stone');tri(site.measuredHeight-2.75,2.6,width-.45,'brick');
  circle(offset(q,face,.54),6.25,.35,face);circle(offset(q,face,.24),14.2,.63,face);
  for(const side of [-1,1]){const x=offset(q,face,.48,side*(width/2-.35));box(x.x,4.0,x.y,.55,.22,.65,'stone',face);panel(x,4.22,.48,1.75,face,'dark',true);if(side<0){
   // The carved parrot occupies the left niche; Saint Joseph is on the right.
   add(new T.SphereGeometry(1,6,4).scale(.18,.33,.14),'stone',x.x,4.8,x.y);
   add(new T.SphereGeometry(.13,6,4),'stone',x.x,5.1,x.y);
   const beak=offset(x,face,.18);add(new T.ConeGeometry(.07,.16,4).rotateX(Math.PI/2),'stone',beak.x,5.08,beak.y,face);
   box(x.x,4.23,x.y,.1,.45,.1,'stone');
  }else{add(new T.ConeGeometry(.19,.85,6),'stone',x.x,4.8,x.y);add(new T.SphereGeometry(.17,6,4),'stone',x.x,5.32,x.y);box(x.x,5.9,x.y,.15,1.1,.15,'stone');}}
  const cross=offset(q,face,.3);box(cross.x,site.measuredHeight-.8,cross.y,.09,.65,.09,'stone',face);box(cross.x,site.measuredHeight-.45,cross.y,.45,.09,.09,'stone',face);
 }
}
