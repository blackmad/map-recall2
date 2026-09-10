/** Roof-volume evidence from the existing LoD2.2 mesh; independent of image classification. */
export function roofGeometry(building) {
  const planes=[];
  for(const s of building.surfaces.filter(s=>s.type==='roof')){
    const r=s.rings[0];let nx=0,ny=0,nz=0;
    for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length];nx+=(p[1]-q[1])*(p[2]+q[2]);ny+=(p[2]-q[2])*(p[0]+q[0]);nz+=(p[0]-q[0])*(p[1]+q[1]);}
    const norm=Math.hypot(nx,ny,nz),area=norm/2;if(area<.5)continue;
    if(ny<0){nx=-nx;ny=-ny;nz=-nz;}
    const tilt=Math.acos(Math.min(1,ny/norm))*180/Math.PI;
    planes.push({area,tilt,azimuth:(Math.atan2(nx,nz)*180/Math.PI+360)%360});
  }
  const area=planes.reduce((s,p)=>s+p.area,0);
  if(!area)return {shape:'unknown',source:'no-roof-mesh',planes:[]};
  const flatFraction=planes.filter(p=>p.tilt<12).reduce((s,p)=>s+p.area,0)/area;
  const slopes=planes.filter(p=>p.tilt>=12&&p.area/area>.035);
  const clusters=[];
  for(const p of slopes){const c=clusters.find(c=>Math.abs(((p.azimuth-c.azimuth+540)%360)-180)<22);if(c)c.area+=p.area;else clusters.push({...p});}
  const major=clusters.filter(c=>c.area/area>.12);
  let shape=flatFraction>.8?'flat':'complex';
  if(flatFraction>.3&&flatFraction<.8&&major.length===1)shape='flat-with-pitched-section';
  if(flatFraction<.3&&major.length===2&&Math.abs(Math.abs(major[0].azimuth-major[1].azimuth)-180)<25)shape='pitched-gable';
  if(flatFraction<.3&&major.length>=3&&major.length<=4)shape='hipped-or-complex';
  return {shape,source:'3DBAG-LoD2.2-plane-heuristic/v2',flatFraction:Number(flatFraction.toFixed(3)),area:Number(area.toFixed(1)),planes,
    note:'Geometry hypothesis; dormers and segmentation can change counts. Mansard and decorative gables require review.'};
}
