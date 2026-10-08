/** Parameterized original native geometry; dimensions are supplied by source recipe. */
export function steppedPediments(face,config){
 const faces=[],tops=[],at=(x,y,d)=>[face.a[0]+face.t[0]*x+face.n[0]*d,y,face.a[1]+face.t[1]*x+face.n[1]*d];
 for(let i=0;i<config.count;i++){
  const x=config.startMetres+i*config.pitchMetres,w=config.widthMetres;if(x<0||x+w>face.len)throw Error('pediment outside native face');
  const points=[[x,config.baseHeightMetres],[x+config.shoulderMetres,config.baseHeightMetres+config.riseMetres],[x+w-config.shoulderMetres,config.baseHeightMetres+config.riseMetres],[x+w,config.baseHeightMetres]];
  const front=points.map(([x,y])=>at(x,y,.02)),back=points.map(([x,y])=>at(x,y,-config.depthMetres));
  for(let k=1;k<3;k++){faces.push([front[0],front[k],front[k+1]],[back[0],back[k+1],back[k]]);}
  for(let k=0;k<3;k++)tops.push([front[k],back[k],back[k+1]],[front[k],back[k+1],front[k+1]]);
  faces.push([front[0],back[0],back[3]],[front[0],back[3],front[3]]);
 }
 return{faces,tops};
}

/** Photo-guided pointed warehouse gables with curved shoulder feet. Returns
 * ordered native facade contours so masonry and thin coping share one profile. */
export function pointedWarehouseContours(face,{count=2,start=0,pitch,width,base,peak,shoulderRise=.45}){
 const contours=[];
 for(let i=0;i<count;i++){
  const left=start+i*pitch,right=left+width;if(left<0||right>face.len+.001)throw Error('Gable outside native facade');
  const p=[[left,base],[left+.12,base+.04],[left+.28,base+.17],[left+.36,base+shoulderRise],[left+width*.50,peak],[right-.36,base+shoulderRise],[right-.28,base+.17],[right-.12,base+.04],[right,base]];
  contours.push(p);
 }
 return contours;
}
