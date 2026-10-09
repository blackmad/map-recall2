/** Offline diagnostic: municipal panorama-textures equations versus our wall-plane mapping.
 * No production backend or photographic textures are added. Inputs/outputs stay private.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import jpeg from 'jpeg-js';
import {rectifyFacade,worldToEquirectangularPixel,AMSTERDAM_WORLD_ALIGNED} from '../../src/canalRecall/facade/rectify.ts';
import {lngLatToRd} from '../../src/canalRecall/facade/rdNew.ts';
const option=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const imagePath=option('image'),cameraPath=option('camera'),frontPath=option('front'),out=option('out');
const base=Number(option('base')),height=Number(option('height')),eye=Number(option('eye')??2.5);
if(!imagePath||!cameraPath||!frontPath||!out||!Number.isFinite(base)||!(height>0)||!Number.isFinite(eye))throw Error('Use --image --camera --front --base=<NAP> --height=<m> --out=<private-dir> [--eye=2.5]');
await fs.mkdir(out,{recursive:true});
const bytes=await fs.readFile(imagePath),image=jpeg.decode(bytes,{useTArray:true});
const camera=JSON.parse(await fs.readFile(cameraPath,'utf8')),front=JSON.parse(await fs.readFile(frontPath,'utf8')).front;
const rd=lngLatToRd(camera.geometry.coordinates);
const pose={x:rd.x,y:rd.y,z:base+eye,headingDeg:camera.heading??0,pitchDeg:camera.pitch??0,rollDeg:camera.roll??0};
const plane={start:{x:front.a[0],y:front.a[1]},end:{x:front.b[0],y:front.b[1]},baseZ:base,topZ:base+height};
const t=performance.now(),rectified=rectifyFacade(image,pose,plane,{pixelsPerMetre:60,camera:AMSTERDAM_WORLD_ALIGNED});
const elapsedMs=performance.now()-t;
// Independent spherical formulation inspected in Amsterdam/panorama-textures:
// RD north/east axis swap, azimuth atan2(east,north), polar angle acos(up/r).
// Source dimensions are adapted; output sample centres match ours to isolate equations.
let maxPixelDelta=0,maxLegacyWrapDelta=0;let count=0;
for(let y=0;y<=100;y++)for(let x=0;x<=100;x++){
 const u=x/100,v=y/100;
 const p={x:plane.start.x+(plane.end.x-plane.start.x)*u,y:plane.start.y+(plane.end.y-plane.start.y)*u,z:plane.topZ-height*v};
 const east=p.x-pose.x,north=p.y-pose.y,up=p.z-pose.z,r=Math.sqrt(east*east+north*north+up*up);
 const rawU=image.width/2+image.width/2*Math.atan2(east,north)/Math.PI;
 const wrap=(n:number,m:number)=>(n%m+m)%m;
 const municipal=[wrap(rawU,image.width),image.height*Math.acos(up/r)/Math.PI];
 const legacyU=wrap(rawU,image.width-1);
 const actual=worldToEquirectangularPixel(p,pose,image,AMSTERDAM_WORLD_ALIGNED);
 const deltaU=Math.min(Math.abs(actual[0]-municipal[0]),image.width-Math.abs(actual[0]-municipal[0]));
 maxPixelDelta=Math.max(maxPixelDelta,Math.hypot(deltaU,actual[1]-municipal[1]));
 maxLegacyWrapDelta=Math.max(maxLegacyWrapDelta,Math.abs(actual[0]-legacyU));count++;
}
const file=path.join(out,'wall-plane.jpg');await fs.writeFile(file,jpeg.encode(rectified,90).data);
const report={schemaVersion:1,status:'projection-equations-compared-not-source-fit-accepted',panoramaId:camera.pano_id,capturedAt:camera.timestamp,input:{imagePath,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),width:image.width,height:image.height},plane,pose,poseLimit:'Camera height is an explicit approximation relative to facade ground, not surveyed camera NAP.',comparison:{samples:count,maxPixelDelta,legacyWidthMinusOneWrapMaxDelta:maxLegacyWrapDelta,upstream:'https://github.com/Amsterdam/panorama-textures/blob/master/src/texture.py',adaptations:['Actual source dimensions replace fixed8000x4000','Same wall-plane sample coordinates isolate projection equations','Compare spherical equations; upstream Python dependency stack was not executed']},rectification:{width:rectified.width,height:rectified.height,elapsedMs,missingFraction:rectified.missingFraction},decision:maxPixelDelta<1e-7?'No projection-equation advantage found; keep one existing production wall-plane extractor. Investigate viewpoint, source resolution/occlusion and calibration instead.':'Projection disagreement requires investigation.',limitations:['No portal screenshot pixel comparison','No measured camera-height/boresight calibration','No claim that planar rectification handles projecting bays or stoeps','No authoring-speed or game acceptance evidence']};
await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
