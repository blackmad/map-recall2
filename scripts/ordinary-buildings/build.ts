/** Source-informed native ordinary building batch. Original atlas pixels; no photo texture imports. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import * as T from 'three';
import sharp from 'sharp';
import {Document,NodeIO} from '@gltf-transform/core';
import {openTopPrism,upwardRoofPlane} from '../landmarks/house-geometry.js';
const data='public/canal-drive/ordinary-buildings-data', output='public/canal-drive/models/ordinary-buildings';
const recipes=JSON.parse(await fs.readFile(`${data}/recipes.json`,'utf8')).recipes;
const sourceRoot=process.env.ORDINARY_SOURCE_ROOT||'/Users/blackmad/Code/map-recall2-source-data';
const rgba=(hex:string):[number,number,number,number]=>{const c=new T.Color(hex);return [c.r,c.g,c.b,1]};
const rect=(x:number,y:number,w:number,h:number,c:string)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
/** All dimensions in physical metres, source recipes own face roles and parameters. */
function facadeConfig(r:any,edge:number){return {...r.facade,...r.facade?.edges?.[String(edge)]};}
function face(r:any,len:number,edge:number,height:number){
 const f=facadeConfig(r,edge),W=512,H=256,sx=W/len,sy=H/height;
 const wall=f.wallColor||r.wall,frame=f.frameColor||r.palette.frames,glass=f.glassColor||r.palette.glass;
 let svg=rect(0,0,W,H,wall);
 const draw=(x:number,bottom:number,w:number,h:number,c:string)=>{if(w>0&&h>0)svg+=rect(x*sx,(height-bottom-h)*sy,w*sx,h*sy,c);};
 if(f.plinthHeightMetres)draw(0,0,len,f.plinthHeightMetres,f.plinthColor||'#858b86');
 const panes=f.panes??2,fw=f.frameWidthMetres??.09;
 function win(x:number,y:number,w:number,h:number,num=panes){draw(x,y,w,h,frame);for(let j=0;j<num;j++)draw(x+fw+j*(w-2*fw)/num,y+fw,(w-2*fw)/num-fw*.6,h-2*fw,glass);}
 if(f.kind==='corrugated'||f.kind==='industrial-office')for(let x=.3;x<len;x+=f.corrugationPitchMetres??.4)draw(x,f.plinthHeightMetres??0,.035,height-(f.plinthHeightMetres??0),f.corrugationColor||'#909895');
 const ground=f.groundExceptionalBandHeightMetres??3,levels=f.levels??r.levels,pitch=f.floorPitchMetres??((height-ground)/Math.max(1,levels-1));
 if(!['blank','corrugated','sparse'].includes(f.kind))for(let row=0;row<levels;row++){
 if(f.kind==='commercial-upper'&&row===0)continue;
 const base=f.firstSillMetres!==undefined?f.firstSillMetres+row*pitch:row===0?(f.groundSillMetres??.15):ground+(row-1)*pitch+(f.sillHeightMetres??.5);
 const wh=row===0?(f.groundGroupHeightMetres??Math.min(ground-.3,f.groupHeightMetres??1.8)):(f.groupHeightMetres??1.8),ww=f.groupWidthMetres??2;
 const bay=f.bayPitchMetres??3,start=f.firstBayMetres??.5;
 for(let x=start,b=0;x+ww<len-(f.endMarginMetres??.35);x+=bay,b++){
 if(f.skipEveryNthBay&&((b+1)%f.skipEveryNthBay===0))continue;
 const group=f.alternatingGroups?.[b%f.alternatingGroups.length];win(x,base,group?.widthMetres??ww,group?.heightMetres??wh,group?.panes??panes);
 }
 if(f.floorBands)draw(0,Math.max(0,base-(f.sillHeightMetres??.5)),len,f.floorBandHeightMetres??.2,f.floorBandColor||frame);
 }
 if(f.sparseWindows)for(const w of f.sparseWindows)win(w.xMetres,w.sillMetres,w.widthMetres,w.heightMetres,w.panes??1);
 for(const door of f.doors||[]){let x=door.xMetres??1,p=door.pitchMetres??len+1;for(;x+(door.widthMetres??1.2)<len;x+=p){const dw=door.widthMetres??1.2,dh=door.heightMetres??ground-.2;draw(x,door.bottomMetres??.1,dw,dh,door.color||'#394447');if(door.kind==='glazed')win(x+.08,.18,dw-.16,dh-.16,door.panes??2);if(door.kind==='loading')for(let y=.4;y<dh;y+=.35)draw(x,y,dw,.025,frame);}}
 for(const assembly of f.glazedAssemblies||[]){win(assembly.xMetres,assembly.sillMetres,assembly.widthMetres,assembly.heightMetres,assembly.panes??2);if(assembly.crossbarMetres)draw(assembly.xMetres,assembly.crossbarMetres,assembly.widthMetres,fw,frame);if(assembly.pierWidthMetres){draw(assembly.xMetres-assembly.pierWidthMetres,0,assembly.pierWidthMetres,height,frame);draw(assembly.xMetres+assembly.widthMetres,0,assembly.pierWidthMetres,height,frame);}}
 if(f.topBandHeightMetres)draw(0,height-f.topBandHeightMetres,len,f.topBandHeightMetres,f.topBandColor||frame);
 if(f.horizontalJointPitchMetres)for(let y=f.plinthHeightMetres??0;y<height;y+=f.horizontalJointPitchMetres)draw(0,y,len,.035,f.jointColor||'#b8c0bc');
 if(f.baseVents)for(let x=1;x<len;x+=f.baseVents.pitchMetres)draw(x,f.baseVents.sillMetres,f.baseVents.widthMetres,f.baseVents.heightMetres,f.baseVents.color||'#555d5e');
 if(f.panelSeamPitchMetres)for(let x=f.panelSeamPitchMetres;x<len;x+=f.panelSeamPitchMetres)draw(x,0,.10,height,f.panelSeamColor||'#434b4c');
 for(const stripe of f.stripes||[])draw(len*stripe.fraction,stripe.bottomMetres??f.plinthHeightMetres??0,stripe.widthMetres,height-(stripe.bottomMetres??f.plinthHeightMetres??0),stripe.color);
 if(f.lintelBand)draw(0,f.lintelBand.bottomMetres,len,f.lintelBand.heightMetres,f.lintelBand.color||frame);
 return svg;
}
function shape(rings:number[][][]){const s=new T.Shape(rings[0].map(v=>new T.Vector2(v[0],v[1])));for(const hole of rings.slice(1))s.holes.push(new T.Path(hole.map(v=>new T.Vector2(v[0],v[1]))));return s;}
function push(groups:T.BufferGeometry[],g:T.BufferGeometry){groups.push(g.index?g.toNonIndexed():g);}
function inside(point:number[],poly:number[][]){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function distance(point:number[],poly:number[][]){let best=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy)));best=Math.min(best,Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy));}return best;}
function regions(r:any){return (r.officialRegions||[]).map((reg:any)=>{const ring=reg.ring,poly=ring.map((v:number[])=>[v[0],v[2]]);let normal=new T.Vector3(),best=0;const a=new T.Vector3(...ring[0]);for(let i=1;i<ring.length;i++)for(let j=i+1;j<ring.length;j++){const n=new T.Vector3(...ring[i]).sub(a).cross(new T.Vector3(...ring[j]).sub(a));if(Math.abs(n.y)>best){normal=n;best=Math.abs(n.y);}}if(best<1e-7)throw Error('Degenerate surveyed roof region');const at=(p:number[])=>a.y-(normal.x*(p[0]-a.x)+normal.z*(p[1]-a.z))/normal.y;return{poly,at};});}
function intersectTriangle(poly:number[][],triangle:number[][]){let clipped=poly;const orient=(triangle[1][0]-triangle[0][0])*(triangle[2][1]-triangle[0][1])-(triangle[1][1]-triangle[0][1])*(triangle[2][0]-triangle[0][0]);for(let edge=0;edge<3;edge++){const a=triangle[edge],b=triangle[(edge+1)%3],side=(p:number[])=>Math.sign(orient)*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));let out:number[][]=[];for(let i=0;i<clipped.length;i++){let p=clipped[i],q=clipped[(i+1)%clipped.length],dp=side(p),dq=side(q);if(dp>=-1e-7)out.push(p);if((dp>0)!==(dq>0)){const t=dp/(dp-dq);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}}clipped=out;if(clipped.length<3)return[];}return clipped;}
const manifest:any={version:1,models:[]};
for(const r of recipes){const start=Date.now(),doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(),mesh=doc.createMesh();scene.addChild(doc.createNode(r.digits).setMesh(mesh));
 const polys=(r.footprint.type==='Polygon'?[r.footprint.coordinates]:r.footprint.coordinates).map((poly:any)=>poly.map((ring:any)=>ring.slice(0,-1).map(([lng,lat]:number[])=>[(lng-r.anchor[0])*111320*Math.cos(r.anchor[1]*Math.PI/180),-(lat-r.anchor[1])*111320])));
 let main=r.mainHeight??r.sourceHeight,h=main,wallBase=r.wallBaseHeight??main;const sourceRegions=regions(r);const roofAt=(p:number[])=>{const found=sourceRegions.filter((reg:any)=>inside(p,reg.poly));if(found.length)return Math.max(...found.map((reg:any)=>reg.at(p)));if(!sourceRegions.length)return main;const nearest=sourceRegions.reduce((a:any,b:any)=>distance(p,a.poly)<distance(p,b.poly)?a:b);return nearest.at(p);};const wall:T.BufferGeometry[]=[],roof:T.BufferGeometry[]=[],accent:T.BufferGeometry[]=[];const faces:any[]=[];
 for(const poly of polys){const s=shape(poly);for(let ri=0;ri<poly.length;ri++){let ring=poly[ri],area=ring.reduce((a:number,v:number[],i:number)=>a+v[0]*ring[(i+1)%ring.length][1]-v[1]*ring[(i+1)%ring.length][0],0);for(let i=0;i<ring.length;i++){let a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.3)continue;let normal=[dz/len,-dx/len];if(area<0)normal=normal.map(v=>-v);if(ri>0)normal=normal.map(v=>-v);const index=faces.length;faces.push({a,b,len,normal,edge:i});
 const g=new T.BufferGeometry(),eps=.018,col=index%4,row=Math.floor(index/4),vertices:number[]=[],uvs:number[]=[],segments=sourceRegions.length?Math.max(1,Math.ceil(len)):1;
 for(let segment=0;segment<segments;segment++){const t=segment/segments,u=(segment+1)/segments,pa=[a[0]+dx*t,a[1]+dz*t],pb=[a[0]+dx*u,a[1]+dz*u],ha=roofAt(pa),hb=roofAt(pb);const points=[[pa[0]+normal[0]*eps,0,pa[1]+normal[1]*eps],[pb[0]+normal[0]*eps,0,pb[1]+normal[1]*eps],[pb[0]+normal[0]*eps,hb,pb[1]+normal[1]*eps],[pa[0]+normal[0]*eps,ha,pa[1]+normal[1]*eps]],tex=[[col/4+t/4,row+1],[col/4+u/4,row+1],[col/4+u/4,row+1-Math.min(1,hb/main)],[col/4+t/4,row+1-Math.min(1,ha/main)]];for(const v of area>0?[0,2,1,0,3,2]:[0,1,2,0,2,3]){vertices.push(...points[v]);uvs.push(...tex[v]);}}
 g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.computeVertexNormals();push(wall,g);
 const box=(x:number,y:number,width:number,thick:number,depth:number)=>{const geo=new T.BoxGeometry(width,thick,depth);geo.rotateY(-Math.atan2(dz,dx));geo.translate(a[0]+dx/len*x+normal[0]*depth*.5,y,a[1]+dz/len*x+normal[1]*depth*.5);push(accent,geo);};
 const f=facadeConfig(r,i);
 if(f.fins){const fin=f.fins;for(let x=fin.firstMetres??.2;x<len;x+=fin.pitchMetres??f.bayPitchMetres)box(x,main/2,fin.widthMetres??.12,main,fin.depthMetres??.3);}
 if(f.canopy){const c=f.canopy;box(len/2,c.bottomMetres+c.heightMetres/2,len,c.heightMetres,c.depthMetres);}
 }}
 if(sourceRegions.length){
 // Triangulate simple native and survey polygons, intersect in plan, then apply each fitted roof plane.
 const native=upwardRoofPlane(s,0).toNonIndexed().getAttribute('position'),values:number[]=[];
 for(const region of sourceRegions){const surveyed=upwardRoofPlane(shape([region.poly]),0).toNonIndexed().getAttribute('position');for(let n=0;n<native.count;n+=3){const tri=[0,1,2].map(j=>[native.getX(n+j),native.getZ(n+j)]);for(let q=0;q<surveyed.count;q+=3){const from=[0,1,2].map(j=>[surveyed.getX(q+j),surveyed.getZ(q+j)]),hit=intersectTriangle(from,tri);for(let j=1;j<hit.length-1;j++)for(const p of [hit[0],hit[j],hit[j+1]])values.push(p[0],region.at(p),p[1]);}}}
 const roofGeo=new T.BufferGeometry();roofGeo.setAttribute('position',new T.Float32BufferAttribute(values,3));roofGeo.computeVertexNormals();push(roof,roofGeo);
 // Source region boundaries enclose real roof-height steps, including the tall box's low strip.
 for(const region of sourceRegions){const side:number[]=[];for(let i=0;i<region.poly.length;i++){const a=region.poly[i],b=region.poly[(i+1)%region.poly.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]),parts=Math.max(1,Math.ceil(length));for(let j=0;j<parts;j++){const t=j/parts,u=(j+1)/parts,pa=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])],pb=[a[0]+u*(b[0]-a[0]),a[1]+u*(b[1]-a[1])],mid=[(pa[0]+pb[0])/2,(pa[1]+pb[1])/2];if(!inside(mid,poly[0])||distance(mid,poly[0])<.4||poly.slice(1).some((hole:number[][])=>inside(mid,hole)))continue;const ha=region.at(pa),hb=region.at(pb);side.push(pa[0],wallBase,pa[1],pb[0],wallBase,pb[1],pb[0],hb,pb[1],pa[0],wallBase,pa[1],pb[0],hb,pb[1],pa[0],ha,pa[1]);}}if(side.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(side,3));g.computeVertexNormals();push(wall,g);}}

 // Thin survey/native perimeter disagreement is covered by a dark low roof layer, below all supported planes.
 push(roof,upwardRoofPlane(s,wallBase-.015));
 }else if(r.roofProfile?.type==='gable'){
 const ring=poly[0],profile=r.roofProfile;let length=0,axis=new T.Vector2();for(let j=0;j<ring.length;j++){const a=ring[j],b=ring[(j+1)%ring.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len>length){length=len;axis.set(-(b[1]-a[1])/len,(b[0]-a[0])/len);}}
 const vals=ring.map((v:number[])=>v[0]*axis.x+v[1]*axis.y),low=Math.min(...vals),high=Math.max(...vals),mid=(low+high)/2;
 const alt=(v:number[])=>main+(profile.ridgeHeightMetres-main)*(1-Math.abs((v[0]*axis.x+v[1]*axis.y-mid)/(high-low)*2));
 function clipHalf(polygon:number[][],sign:number){let out:number[][]=[];for(let j=0;j<polygon.length;j++){const a=polygon[j],b=polygon[(j+1)%polygon.length],da=sign*(a[0]*axis.x+a[1]*axis.y-mid),db=sign*(b[0]*axis.x+b[1]*axis.y-mid);if(da>=-1e-6)out.push(a);if((da>0)!==(db>0)){let t=da/(da-db);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}return out;}
 for(const sign of [-1,1]){const half=clipHalf(ring,sign),geo=upwardRoofPlane(shape([half]),0).toNonIndexed(),p=geo.getAttribute('position');for(let j=0;j<p.count;j++)p.setY(j,alt([p.getX(j),p.getZ(j)]));geo.computeVertexNormals();push(roof,geo);}
 // Native perimeter gables fill above the eaves; roof owns its top.
 for(let j=0;j<ring.length;j++){const a=ring[j],b=ring[(j+1)%ring.length],da=a[0]*axis.x+a[1]*axis.y-mid,db=b[0]*axis.x+b[1]*axis.y-mid,stops=[0,1];if(da*db<0)stops.push(da/(da-db));stops.sort((a,b)=>a-b);let values:number[]=[];for(let q=0;q<stops.length-1;q++){const at=(t:number)=>[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])],p=at(stops[q]),c=at(stops[q+1]);values.push(p[0],main,p[1],c[0],main,c[1],c[0],alt(c),c[1],p[0],main,p[1],c[0],alt(c),c[1],p[0],alt(p),p[1]);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(values,3));geo.computeVertexNormals();push(wall,geo);}
 h=profile.ridgeHeightMetres;
 }else push(roof,upwardRoofPlane(s,main));
 if(r.roofPanelGrid){const grid=r.roofPanelGrid,a=poly[0][0],b=poly[0][1],d=poly[0][3],at=(u:number,v:number)=>[a[0]+u*(b[0]-a[0])+v*(d[0]-a[0]),a[1]+u*(b[1]-a[1])+v*(d[1]-a[1])];for(let i=0;i<grid.columns;i++)for(let j=0;j<grid.rows;j++){const panelShape=shape([[at((i+.06)/grid.columns,(j+.06)/grid.rows),at((i+.94)/grid.columns,(j+.06)/grid.rows),at((i+.94)/grid.columns,(j+.94)/grid.rows),at((i+.06)/grid.columns,(j+.94)/grid.rows)]]),sides=openTopPrism(panelShape,main,main+grid.reliefMetres),sp=sides.getAttribute('position'),sn=sides.getAttribute('normal'),kept:number[]=[];for(let k=0;k<sp.count;k+=3){if(sn.getY(k)<-.9)continue;for(let t=0;t<3;t++)kept.push(sp.getX(k+t),sp.getY(k+t),sp.getZ(k+t));}const sideGeo=new T.BufferGeometry();sideGeo.setAttribute('position',new T.Float32BufferAttribute(kept,3));sideGeo.computeVertexNormals();push(roof,sideGeo);push(roof,upwardRoofPlane(panelShape,main+grid.reliefMetres));}}

 }
 const rows=Math.ceil(faces.length/4),atlasParts=faces.map((f,i)=>({input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="256">${face(r,f.len,f.edge,main)}</svg>`),left:i%4*512,top:Math.floor(i/4)*256}));const png=await sharp({create:{width:2048,height:rows*256,channels:4,background:r.wall}}).composite(atlasParts).png().toBuffer();const texture=doc.createTexture('original-source-informed-facade-atlas').setImage(png).setMimeType('image/png');
 const material=doc.createMaterial('facade').setMetallicFactor(0).setBaseColorTexture(texture).setRoughnessFactor(.9).setDoubleSided(true),roofmat=doc.createMaterial('roof').setMetallicFactor(0).setBaseColorFactor(rgba(r.roof)).setRoughnessFactor(1),accentmat=doc.createMaterial('slabs-fins').setMetallicFactor(0).setBaseColorFactor(rgba(r.palette.balcony||r.palette.frames)).setRoughnessFactor(.9);let triangles=0,bmin=[Infinity,Infinity,Infinity],bmax=[-Infinity,-Infinity,-Infinity];
 for(const [geos,mat] of [[wall,material],[roof,roofmat],[accent,accentmat]] as const){if(!geos.length)continue;let positions:number[]=[],normals:number[]=[],uv:number[]=[];for(const g of geos){let p=g.getAttribute('position'),n=g.getAttribute('normal'),tex=g.getAttribute('uv');for(let i=0;i<p.count;i++){let xyz=[p.getX(i),p.getY(i),p.getZ(i)];positions.push(...xyz);normals.push(n.getX(i),n.getY(i),n.getZ(i));for(let j=0;j<3;j++){bmin[j]=Math.min(bmin[j],xyz[j]);bmax[j]=Math.max(bmax[j],xyz[j]);} // shell invisible behind atlas: use a wall-color pixel at atlas border
 uv.push(tex?tex.getX(i):0,tex?(geos===wall?tex.getY(i)/rows:Math.max(0,Math.min(1,tex.getY(i)))):0);}}
 const primitive=doc.createPrimitive().setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer)).setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(new Float32Array(normals)).setBuffer(buffer)).setMaterial(mat);if(geos===wall)primitive.setAttribute('TEXCOORD_0',doc.createAccessor().setType('VEC2').setArray(new Float32Array(uv)).setBuffer(buffer));mesh.addPrimitive(primitive);triangles+=positions.length/9;}
 const bytes=await new NodeIO().writeBinary(doc);await fs.writeFile(`${output}/${r.digits}.glb`,bytes);const refDir=`${data}/references/${r.digits}`;await fs.mkdir(refDir,{recursive:true});const referenceImages=[];for(const name of r.references.slice(0,4)){await fs.copyFile(path.join(sourceRoot,r.sourcePack,'processed',name),`${refDir}/${name}`);referenceImages.push(`./ordinary-buildings-data/references/${r.digits}/${name}`);}
 const simplifications=r.simplifications||['Original procedural atlas replaces physical small mullions; source-specific physical group dimensions and face exceptions retained.','Tiny signs, interiors, rail bars and rooftop equipment omitted.'];
 manifest.models.push({id:`ordinary-${r.digits}`,buildingId:r.id,name:r.label,anchor:r.anchor,cameraBearing:r.cameraBearing,footprint:r.footprint,height:bmax[1],modelUrl:`./models/ordinary-buildings/${r.digits}.glb`,bounds:{min:bmin,max:bmax},triangles,bytes:bytes.length,materials:mesh.listPrimitives().length,hash:crypto.createHash('sha256').update(bytes).digest('hex'),referenceImages,sourcePack:r.sourcePack,traits:r.traits,simplifications,sourceTiming:r.timing,heightEvidence:r.heightEvidence,facadeRecipe:r.facade,official3D:r.official3D,generationMilliseconds:Date.now()-start,reviewState:'pending independent gallery/live-game visual review'});await fs.writeFile(`${data}/catalogue.json`,JSON.stringify(manifest,null,2));console.log(r.digits,bytes.length,triangles);
}
