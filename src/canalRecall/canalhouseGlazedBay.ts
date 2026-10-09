import * as T from 'three';

export interface CanalhouseGlazedBayWindow {
 /** Fractions of face width and clear height between masonry panels. */
 windowRect?:[number,number,number,number];
 verticalBars?:number[];horizontalBars?:number[];
}
export interface CanalhouseGlazedBay extends CanalhouseGlazedBayWindow {
 id:string;leftM?:number;bottomM?:number;outwardM?:number;
 widthM:number;depthM:number;heightM:number;frontWidthM:number;
 lowerPanelM:number;upperPanelM:number;
 frameWidthM:number;frameDepthM:number;glassDepthM:number;
 /** Optional independent joinery for each visible face. */
 faces?:Partial<Record<'left'|'front'|'right',CanalhouseGlazedBayWindow>>;
 /** Horizontal closure thickness; omitted means no closure. */
 capM?:number;
}
export interface CanalhouseGlazedBayMaterials {wall:T.Material;frame:T.Material;glass:T.Material}

/** One hollow module, x right / y up / z outward. No parent masonry core.
 * Adapts the earlier building_lib/grouped_bay_shell.py face layout strategy:
 * independent pierced front/returns, one common vertical datum and plan caps.
 * Python geometry code is not imported or copied into this Three backend.
 */
export function canalhouseGlazedBay(input:CanalhouseGlazedBay,materials:CanalhouseGlazedBayMaterials):T.Group {
 const positive=(v:number,label:string)=>{if(!Number.isFinite(v)||v<=0)throw Error('Invalid glazed bay '+label);};
 for(const key of ['widthM','depthM','heightM','frontWidthM','frameWidthM','frameDepthM','glassDepthM'] as const)positive(input[key],key);
 for(const key of ['lowerPanelM','upperPanelM'] as const){if(!Number.isFinite(input[key])||input[key]<0)throw Error('Invalid glazed bay '+key);}
 for(const key of ['leftM','bottomM','outwardM','capM'] as const){const v=input[key]??0;if(!Number.isFinite(v)||(key==='capM'&&v<0))throw Error('Invalid glazed bay '+key);}
 if(!input.id||input.frontWidthM>input.widthM||input.lowerPanelM+input.upperPanelM>=input.heightM)throw Error('Invalid glazed bay bounds');
 const {widthM:w,depthM:d,heightM:h,frameWidthM:f,frameDepthM:fd,glassDepthM:gd}=input;
 const clear=h-input.lowerPanelM-input.upperPanelM,inset=(w-input.frontWidthM)/2,cap=input.capM??0;
 if(cap>Math.min(h/2,d/2)||(cap>0&&(input.lowerPanelM<cap||input.upperPanelM<cap)))throw Error('Glazed bay cap must fit masonry panels');
 const group=new T.Group();group.name=input.id;group.position.set(input.leftM??0,input.bottomM??0,input.outwardM??0);
 const points:[number,number][]=[[0,0],[inset,d],[w-inset,d],[w,0]];
 for(let i=0;i<3;i++){
  const name=(['left','front','right'] as const)[i],a=points[i],b=points[i+1],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const face=new T.Group();face.name=input.id+'/'+name;face.position.set(a[0],0,a[1]);face.rotation.y=Math.atan2(a[1]-b[1],b[0]-a[0]);group.add(face);
  const spec={...input,...input.faces?.[name]},rect=spec.windowRect??[0,0,1,1];
  const [u,v,uw,vh]=rect;
  if(rect.length!==4||rect.some(n=>!Number.isFinite(n))||u<0||v<0||uw<=0||vh<=0||u+uw>1||v+vh>1)throw Error('Invalid glazed bay window fractions');
  const l=u*length,r=(u+uw)*length,bottom=input.lowerPanelM+v*clear,top=bottom+vh*clear;
  if(r-l<=2*f||top-bottom<=2*f)throw Error('Glazed bay face too narrow for frame');
  const box=(role:'wall'|'frame'|'glass',label:string,x:number,y:number,bw:number,bh:number,depth:number,z=0)=>{
   if(bw<=0||bh<=0)return;
   const mesh=new T.Mesh(new T.BoxGeometry(bw,bh,depth),materials[role]);mesh.name=input.id+'/'+name+'/'+role+'/'+label;
   mesh.userData.role=role;mesh.userData.surface=role==='frame'?'trim':role;mesh.position.set(x+bw/2,y+bh/2,z);face.add(mesh);
  };
  // Masonry strips bound the opening; there is deliberately no box behind it.
  box('wall','lower',0,0,length,bottom,fd,-fd/2);
  box('wall','upper',0,top,length,h-top,fd,-fd/2);
  box('wall','left',0,bottom,l,top-bottom,fd,-fd/2);
  box('wall','right',r,bottom,length-r,top-bottom,fd,-fd/2);
  box('glass','pane',l+f,bottom+f,r-l-2*f,top-bottom-2*f,gd,-gd/2);
  box('frame','sill',l,bottom,r-l,f,fd);
  box('frame','head',l,top-f,r-l,f,fd);
  box('frame','left',l,bottom+f,f,top-bottom-2*f,fd);
  box('frame','right',r-f,bottom+f,f,top-bottom-2*f,fd);
  const bars=(values:number[]|undefined,vertical:boolean)=>{for(const n of values??[]){if(!Number.isFinite(n)||n<=0||n>=1)throw Error('Invalid glazed bay bar fraction');
   const span=vertical?r-l-2*f:top-bottom-2*f,centre=(vertical?l:bottom)+f+n*span;
   if(n*span<f/2||(1-n)*span<f/2)throw Error('Glazed bay bar does not fit opening');
   box('frame',vertical?'mullion':'transom',vertical?centre-f/2:l+f,vertical?bottom+f:centre-f/2,vertical?f:r-l-2*f,vertical?top-bottom-2*f:f,fd);
  }};bars(spec.verticalBars,true);bars(spec.horizontalBars,false);
 }
 if(cap>0){
  const shape=new T.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();
  for(const [label,y] of [['base',cap],['cap',h]] as const){const mesh=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:cap,bevelEnabled:false}),materials.wall);mesh.rotation.x=Math.PI/2;mesh.position.y=y;mesh.name=input.id+'/wall/'+label;mesh.userData.role='wall';mesh.userData.surface='wall';group.add(mesh);}
 }
 return group;
}
