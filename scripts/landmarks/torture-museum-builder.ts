import * as T from 'three';import signPaths from './torture-museum-sign-paths.json';import type {BuildingTools} from './cultural-builders';import {openTopPrism,upwardRoofPlane} from './house-geometry';import data from './torture-museum-footprints.json';
type C=Parameters<BuildingTools['add']>[1];
/** Original native BAG house, source-guided 2024 facade, independent surveyed roof domains. */
export function buildTortureMuseum(_w:number,_d:number,b:BuildingTools){
 const {add,box}=b,outline=data.outline[0];const shape=(ring:number[][])=>new T.Shape(ring.map(p=>new T.Vector2(p[0],p[1])));
 const base=openTopPrism(shape(outline),0,13.25);base.userData={role:'native-parent-shell'};add(base,'brick');
 for(const [i,r]of data.roofs.entries()){const pts=r.rings[0],cx=pts.reduce((s,p)=>s+p[0],0)/pts.length,cy=pts.reduce((s,p)=>s+p[1],0)/pts.length,cz=pts.reduce((s,p)=>s+p[2],0)/pts.length;let xx=0,xz=0,zz=0,xy=0,zy=0;for(const p of pts){const x=p[0]-cx,z=p[2]-cz,y=p[1]-cy;xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y;}const det=xx*zz-xz*xz,a=(xy*zz-zy*xz)/det,c=(zy*xx-xy*xz)/det,height=(x:number,z:number)=>cy+a*(x-cx)+c*(z-cz),s=shape(pts.map(p=>[p[0],p[2]])),wall=openTopPrism(s,13.25,cy),wp=wall.getAttribute('position');for(let k=0;k<wp.count;k++)if(wp.getY(k)>cy-.001)wp.setY(k,height(wp.getX(k),wp.getZ(k)));wall.computeVertexNormals();wall.userData={role:'roof-domain-support',domain:i};add(wall,'greyBrick');const roof=upwardRoofPlane(s),rp=roof.getAttribute('position');for(let k=0;k<rp.count;k++)rp.setY(k,height(rp.getX(k),rp.getZ(k)));roof.computeVertexNormals();roof.userData={role:'roof',domain:i};add(roof,i===1?'slate':'concrete');}
 // Current aerial + 2021 opposite-bank photo show a wide raised canopy
 // across BOTH front terrace domains0/3, about88% of the5.402m frontage.
 // Single-domain3 canopy was too narrow: preserve its failed mesh/source view.
 // Survey terrace planes and upper17mvolume remain unchanged. Canopy plan,
 // front15.35/back15.60m heights are bounded PHOTO approximations, not AHN.
 const frontA=outline[3],frontB=outline[4],frontLength=Math.hypot(frontB[0]-frontA[0],frontB[1]-frontA[1]),ftx=(frontB[0]-frontA[0])/frontLength,ftz=(frontB[1]-frontA[1])/frontLength;
 const canopyPoint=(u:number,back:number,y:number)=>[frontA[0]+ftx*u+ftz*back,y,frontA[1]+ftz*u-ftx*back];
 const canopyPoints=[canopyPoint(.30,.20,15.35),canopyPoint(5.05,.20,15.35),canopyPoint(5.05,1.70,15.60),canopyPoint(.30,1.70,15.60)];
 function roofBeam(a:number[],c:number[],w:number,colour:C){const A=new T.Vector3(a[0],a[1],a[2]),B=new T.Vector3(c[0],c[1],c[2]),v=B.clone().sub(A),g=new T.BoxGeometry(w,w,v.length());g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),v.normalize()));const m=A.clone().add(B).multiplyScalar(.5);add(g,colour,m.x,m.y,m.z);}
 const canopyShape=shape(canopyPoints.map(p=>[p[0],p[2]])),canopy=upwardRoofPlane(canopyShape),cp=canopy.getAttribute('position');
 // Canopy is planar: interpolate its approximate plane through noncollinear
 // vertices. Retain a thin underside as real sheet geometry, not a two-sided
 // material hiding bad roof winding.
 const ca=canopyPoints[0],cb=canopyPoints[1],cc=canopyPoints[2],n=new T.Vector3(cb[0],cb[1],cb[2]).sub(new T.Vector3(ca[0],ca[1],ca[2])).cross(new T.Vector3(cc[0],cc[1],cc[2]).sub(new T.Vector3(ca[0],ca[1],ca[2]))),canopyY=(x:number,z:number)=>ca[1]-(n.x*(x-ca[0])+n.z*(z-ca[2]))/n.y;
 for(let k=0;k<cp.count;k++)cp.setY(k,canopyY(cp.getX(k),cp.getZ(k)));canopy.computeVertexNormals();canopy.userData={role:'source-glass-pergola',heightAuthority:"photo-derived15.35–15.60m; surveyfloorunchanged"};add(canopy,'blue');
 const underside=canopy.clone(),up=underside.getAttribute('position'),ui=underside.index!;for(let k=0;k<up.count;k++)up.setY(k,up.getY(k)-.018);for(let k=0;k<ui.count;k+=3){const swap=ui.getX(k+1);ui.setX(k+1,ui.getX(k+2));ui.setX(k+2,swap);}underside.computeVertexNormals();underside.userData={role:'source-glass-pergola-underside'};add(underside,'blue');
 for(let i=0;i<canopyPoints.length;i++)roofBeam(canopyPoints[i],canopyPoints[(i+1)%canopyPoints.length],.055,'white');
 // Five source-visible dark transverse members cross the18mm glass sheet
 // so their lower profiles remain visible from the actual street underside. Their endpoints are
 // spans the photo-supported canopy over the union of native terrace domains.
 const backA=canopyPoints[3],backB=canopyPoints[2],canopyFrontA=canopyPoints[0],canopyFrontB=canopyPoints[1];
 for(let k=1;k<=5;k++){const f=k/6,A=backA.map((v,i)=>v+(backB[i]-v)*f),B=canopyFrontA.map((v,i)=>v+(canopyFrontB[i]-v)*f);A[1]=canopyY(A[0],A[2])-.005;B[1]=canopyY(B[0],B[2])-.005;roofBeam(A,B,.060,'dark');}
 // Two clearly source-visible front side uprights; no speculative enclosure.
 for(const i of [0,1])roofBeam([canopyPoints[i][0],14.20,canopyPoints[i][2]],canopyPoints[i],.065,'greyBrick');
 const A=outline[3],B=outline[4],dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz),tx=dx/L,tz=dz/L,nx=-tz,nz=tx,angle=Math.atan2(nx,nz);
 const point=(u:number,o:number)=>[A[0]+tx*u+nx*o,A[1]+tz*u+nz*o];
 function panel(u:number,y:number,w:number,h:number,d:number,c:C,o=.12){const p=point(u,o);box(p[0],y,p[1],w,h,d,c,angle);}
 function pane(u:number,y:number,w:number,h:number,c:C='glass',o=.21){const p=point(u,o),g=new T.PlaneGeometry(w,h);g.userData={role:'pane',normal:[nx,0,nz],tangent:[tx,0,tz],width:w,height:h};add(g,c,p[0],y+h/2,p[1],angle);}
 function window(u:number,y:number,w:number,h:number){pane(u,y,w,h);for(const s of [-1,1]){panel(u+s*(w/2+.035),y-.055,.07,h+.11,.06,'stone',.25);panel(u,y+(s<0?-.065:h),w+.14,.065,.06,'stone',.25);}panel(u,y+h*.73,w,.065,.045,'dark',.26);panel(u,y,.045,h*.73,.045,'dark',.26);panel(u,y-.11,w+.23,.10,.26,'stone',.18);
 // Source shallow relieving arches retain cream key and spring blocks; no invented arched glass.
 for(const [off,yy]of [[-.44,h+.1],[0,h+.15],[.44,h+.1]])panel(u+off,y+yy,.13,.25,.06,'white',.24);
 }
 // Existing shopfront: narrow residential entrance at left, wide museum doorway and right display.
 panel(L/2,0,L-.22,3.95,.05,'dark',.18);pane(.68,0.05,.98,2.25,'dark',.23);pane(.68,2.40,.98,1.20);pane(3.05,2.40,3.45,1.20);pane(4.15,.42,1.14,1.86);pane(2.6,.02,1.73,2.27,'dark');
 for(const u of [.15,1.29,L-.18])panel(u,0,.09,3.95,.09,'frame',.30);for(const y of [2.31,3.67,3.88])panel(L/2,y,L-.20,.09,.10,'frame',.3);panel(3.6,0,.055,2.40,.09,'frame',.30);panel(4.18,.31,1.16,.09,.09,'frame',.30);for(const u of [1.42,2.06,2.7,3.34,3.98,4.62])panel(u,2.45,.035,1.16,.035,'frame',.29);
 // Three tall/medium/short tiers and continuous straight cream cornice.
 for(const [y,h]of [[4.4,2.98],[8.12,2.39],[11.27,1.66]])for(let k=0;k<3;k++)window(.98+1.7*k,y,1.22,h);
 for(const [y,w,h,d]of [[13.52,L,.24,.24],[13.76,L+.12,.22,.40],[13.98,L+.16,.16,.46],[14.14,L+.17,.09,.47]])panel(L/2,y,w,h,d,'white',.16);
 for(const y of [7.85,10.86])for(const u of [.27,1.85,3.55,L-.16]){const p=point(u,.24);const g=new T.CircleGeometry(.07,8);add(g,'dark',p[0],y,p[1],angle);}
 // Real blade sign remains in 2024 captures, mounted at the right boundary.
 // Blade projects an extra approximate12cm beyond the jamb to clear both
 // real letter faces; dense decoded review caught the prior overlap.
 // Exact typefaces unknown: Anton approximates condensed uppercase sans,
 // Georgia Bold Italic approximates the yellow serif lower word. No pixel glyphs.
 const signAngle=Math.atan2(tx,tz),sp=point(L-.04,.77);
 box(sp[0],2.25,sp[1],.92,1.13,.065,'dark',signAngle);
 for(const o of [.32,1.20]){const p=point(L-.04,o);box(p[0],2.25,p[1],.035,1.13,.035,'white',signAngle);}
 for(const side of [-1,1])for(const[text,y,w,h,c,font]of [['TORTURE',3.00,.77,.21,'white',signPaths[0]],['museum',2.77,.78,.23,'ochre',signPaths[1]]] as const){const path=new T.ShapePath();for(const command of font.commands){const p=command as {type:string;x:number;y:number;x1:number;y1:number;x2:number;y2:number};if(p.type==='M')path.moveTo(p.x,-p.y);else if(p.type==='L')path.lineTo(p.x,-p.y);else if(p.type==='Q')path.quadraticCurveTo(p.x1,-p.y1,p.x,-p.y);else if(p.type==='C')path.bezierCurveTo(p.x1,-p.y1,p.x2,-p.y2,p.x,-p.y);else if(p.type==='Z')path.currentPath?.closePath();}const g=new T.ShapeGeometry(path.toShapes(),3);g.computeBoundingBox();const bb=g.boundingBox!,size=bb.getSize(new T.Vector3());g.translate(-(bb.min.x+bb.max.x)/2,-bb.min.y,0);g.scale(w/size.x,h/size.y,1);g.userData={role:'source-supported-real-sign-lettering',fontApproximation:font.approximation};add(g,c,sp[0]+side*tx*.038,y,sp[1]+side*tz*.038,signAngle+(side<0?Math.PI:0));}
 // Hooded carved wood figure beside the real museum entrance: bounded lowpoly
 // interpretation of source sculpture; carved text/illustration intentionally absent.
 const statue=point(L-.12,.33);box(statue[0],0,statue[1],.48,.13,.46,'stone',angle);const robe=new T.CylinderGeometry(.20,.24,1.25,7);add(robe,'stone',statue[0],.75,statue[1]);const hood=new T.SphereGeometry(.25,8,6);hood.scale(1,1.35,1);add(hood,'stone',statue[0],1.56,statue[1]);const face=point(L-.12,.59);add(new T.CircleGeometry(.125,7),'dark',face[0],1.55,face[1],angle);panel(L-.12,.90,.27,.34,.08,'white',.59);
 // Roof/party walls follow survey. No invented side windows on neighbor-abutting walls.
}
