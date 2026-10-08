/** Source-configured native assemblies, no identity, atlas or photo dependencies. */
import * as T from 'three';
export function roundFrontAssemblies(face,config){
 const output=[],at=(x,y,d)=>new T.Vector3(face.a[0]+face.t[0]*x+face.n[0]*d,y,face.a[1]+face.t[1]*x+face.n[1]*d),basis=new T.Matrix4().makeBasis(new T.Vector3(face.t[0],0,face.t[1]),new T.Vector3(0,1,0),new T.Vector3(face.n[0],0,face.n[1]));
 const add=(g,color)=>output.push({geometry:g,color}),box=(x,y,w,h,depth,color,d=.09)=>{const g=new T.BoxGeometry(w,h,depth).applyMatrix4(basis);g.translate(...at(x,y,d).toArray());add(g,color);};
 if(config.columnSection){const c=config.columnSection;for(let x=c.start;x<c.end;x+=c.pitch)for(const level of c.levels){const g=new T.CylinderGeometry(c.radius,c.radius,level.top-level.bottom,12);g.translate(...at(x,(level.top+level.bottom)/2,.17).toArray());add(g,'#e9e8df');}
  for(const y of[3.70,7.00,10.29])box((c.start+c.end)/2,y,c.end-c.start,.18,.32,'#e9e8df',.09);
 }
 for(const x of config.sourcePiers||[])box(x,1.90,.27,3.8,.25,'#e9e8df');
 for(const c of config.sourceJuliets||[]){box(c.xMetres+c.widthMetres/2,c.bottomMetres+.82,c.widthMetres,.035,.045,'#e9e8df',.19);for(let x=c.xMetres;x<c.xMetres+c.widthMetres+.01;x+=.16)box(x,c.bottomMetres+.40,.022,.8,.038,'#e9e8df',.19);}
 for(const c of config.portDoors||[]){box(c.x+c.width/2,1.42,c.width,2.64,.055,'#b65c3a',.060);for(let y=.6;y<2.6;y+=.45){const g=new T.CircleGeometry(.105,16).applyMatrix4(basis);g.translate(...at(c.x+c.width*.42,y,.095).toArray());add(g,'#2f3b3e');}box(c.x+c.width*.83,1.4,.035,.29,.035,'#deddd0',.1);}
 return output;
}

/** Native round-headed warehouse apertures. Caller supplies observed dimensions;
 * opaque glazing sits just outside its shell, surrounded by physical arch trim. */
export function roundHeadOpening(face,opening){
 const {x,bottom,width,height,rise=width/2,trim=.075,colour='white',depth=.08}=opening;
 const points=[[-width/2,0],[width/2,0],[width/2,height-rise]];
 for(let k=1;k<=12;k++){const a=k*Math.PI/12;points.push([width/2*Math.cos(a),height-rise+rise*Math.sin(a)]);}
 const inner=new T.Shape(points.map(([u,y])=>new T.Vector2(u,y)));
 const outerWidth=width+2*trim,outerRise=rise+trim,outerHeight=height+trim;
 const outer=new T.Shape();outer.moveTo(-outerWidth/2,-trim);outer.lineTo(outerWidth/2,-trim);outer.lineTo(outerWidth/2,outerHeight-outerRise);
 for(let k=1;k<=12;k++){const a=k*Math.PI/12;outer.lineTo(outerWidth/2*Math.cos(a),outerHeight-outerRise+outerRise*Math.sin(a));}
 outer.lineTo(-outerWidth/2,-trim);outer.holes.push(new T.Path(points.map(([u,y])=>new T.Vector2(u,y))));
 const basis=new T.Matrix4().makeBasis(new T.Vector3(face.t[0],0,face.t[1]),new T.Vector3(0,1,0),new T.Vector3(face.n[0],0,face.n[1]));
 const transform=(g,d)=>g.applyMatrix4(basis).translate(face.a[0]+face.t[0]*x+face.n[0]*d,bottom,face.a[1]+face.t[1]*x+face.n[1]*d);
 return[{geometry:transform(new T.ShapeGeometry(inner),depth),'color':opening.glassColour??'glass'},{geometry:transform(new T.ExtrudeGeometry(outer,{depth:.05,bevelEnabled:false}),depth+.015),color:colour}];
}

/** An open loading shutter retains its half-arch profile after rotation about
 * the observed hinge. Angles and dimensions belong to each source recipe. */
export function archedLoadingShutters(face,{x,bottom,width,height,rise=width/2,angle=.20,colour='red'}){
 const result=[];
 for(const side of[-1,1]){
  const hinge=x+side*width/2;
  // Open beyond the jamb: its highest point remains at the outer free corner.
  const shape=new T.Shape();shape.moveTo(0,0);shape.lineTo(side*width/2,0);shape.lineTo(side*width/2,height);
  for(let k=1;k<=8;k++){const t=k/8;shape.lineTo(side*width/2*(1-t),height-rise+rise*Math.sqrt(Math.max(0,1-t*t)));}shape.lineTo(0,0);
  const t=[face.t[0]*Math.cos(angle)+face.n[0]*side*Math.sin(angle),face.t[1]*Math.cos(angle)+face.n[1]*side*Math.sin(angle)],n=[-t[1],t[0]];
  if(n[0]*face.n[0]+n[1]*face.n[1]<0){n[0]*=-1;n[1]*=-1;}
  const basis=new T.Matrix4().makeBasis(new T.Vector3(t[0],0,t[1]),new T.Vector3(0,1,0),new T.Vector3(n[0],0,n[1]));
  const g=new T.ExtrudeGeometry(shape,{depth:.065,bevelEnabled:false}).applyMatrix4(basis);g.translate(face.a[0]+face.t[0]*hinge+face.n[0]*.19,bottom,face.a[1]+face.t[1]*hinge+face.n[1]*.19);result.push({geometry:g,color:colour});
 }
 return result;
}
