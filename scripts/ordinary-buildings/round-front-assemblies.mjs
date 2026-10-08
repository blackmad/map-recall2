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
