import fs from 'node:fs';import sharp from 'sharp';import f from './haparandaweg-11-footprints.json';
const out='artifacts/haparandaweg-11';const A=f.outline[0][3],B=f.outline[0][4],anchor=f.anchor;const fractions=[0.115243, 0.272172, 0.443164, 0.612146, 0.745786, 0.919396];
for(const name of ['front2021','front2025','frontwest2025','east2021','east2025','far-east2025']){
 const m=JSON.parse(fs.readFileSync(`${out}/raw/${name}-metadata.json`,'utf8')),ll=m.geometry.coordinates,cx=(ll[0]-anchor[0])*111320*Math.cos(anchor[1]*Math.PI/180),cz=(anchor[1]-ll[1])*111320,yaw=Math.atan2(-cx,cz),pitch=8*Math.PI/180,scale=Math.tan(65*Math.PI/360);
 const project=(t:number,y:number)=>{const dx=A[0]+t*(B[0]-A[0])-cx,dz=A[1]+t*(B[1]-A[1])-cz,dy=y-2.3,F=dx*Math.sin(yaw)-dz*Math.cos(yaw),R=dx*Math.cos(yaw)+dz*Math.sin(yaw),U=dy*Math.cos(pitch)-F*Math.sin(pitch),D=F*Math.cos(pitch)+dy*Math.sin(pitch);return [800+R/D/scale*800,525-U/D/scale*800]};
 let svg='<svg width="1600" height="1050">';
 for(const [i,t]of fractions.entries()){const p=project(t,5.32),a=project(t,4.52),b=project(t,6.12);svg+=`<path d="M ${a} L ${b}" stroke="yellow" stroke-width="2"/><text x="${p[0]}" y="${b[1]-10}" font-size="24" fill="red">${i+1}:${t.toFixed(3)}</text>`;}
 for(const t of []){const p=project(t,5.32);svg+=`<circle cx="${p[0]}" cy="${p[1]}" r="14" fill="none" stroke="cyan" stroke-width="3"/><text x="${p[0]}" y="${p[1]-25}" font-size="24" fill="cyan">test .750</text>`;}
 svg+='</svg>';await sharp(`${out}/processed/${name}.jpg`).composite([{input:Buffer.from(svg)}]).toFile(`${out}/processed/${name}-window-inventory.jpg`);
 console.log(name,fractions.map(t=>[t,project(t,5.32).map(v=>Math.round(v))]),'test.75',project(.75,5.32));
}
