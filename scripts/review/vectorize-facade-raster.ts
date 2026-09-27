/** Local raster-to-SVG diagnostic. Traces pixels, not architectural semantics. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import sharp from 'sharp';

const run=promisify(execFile),sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const flags=new Map<string,string>();
for(const argument of process.argv.slice(2)){
  const match=/^--(input|out|python|max-side|palette-colors|timeout-sec)=(.+)$/.exec(argument);
  if(!match||flags.has(match[1]))throw Error(`Unknown or duplicate argument: ${argument}`);
  flags.set(match[1],match[2]);
}
if(!flags.has('input')||!flags.has('out'))throw Error('Use --input=<raster> --out=<fresh-directory>');
const input=path.resolve(flags.get('input')!),output=path.resolve(flags.get('out')!);
const python=flags.get('python')??'python3';
const maxSide=Number(flags.get('max-side')??1600),paletteColors=Number(flags.get('palette-colors')??32);
const timeoutSec=Number(flags.get('timeout-sec')??300);
if(!Number.isSafeInteger(maxSide)||maxSide<128||maxSide>4096||
  !Number.isSafeInteger(paletteColors)||paletteColors!==0&&(paletteColors<2||paletteColors>256)||
  !Number.isSafeInteger(timeoutSec)||timeoutSec<10||timeoutSec>1800)throw Error('Invalid vectorization limits');
try{await fs.access(output);throw Error(`Output already exists: ${output}`);}catch(error:any){if(error.code!=='ENOENT')throw error;}
const source=await fs.readFile(input),sourceInfo=await sharp(source).metadata();
if(!sourceInfo.width||!sourceInfo.height||sourceInfo.width*sourceInfo.height>20_000_000||
  !['png','jpeg','webp'].includes(sourceInfo.format??''))throw Error('Expected bounded PNG, JPEG or WebP raster');
const processed=await sharp(source).rotate().resize({width:maxSide,height:maxSide,fit:'inside',withoutEnlargement:true})
  .png(paletteColors?{palette:true,colours:paletteColors,dither:0}:{palette:false}).toBuffer();
const processedInfo=await sharp(processed).metadata();
if(!processedInfo.width||!processedInfo.height||Math.max(processedInfo.width,processedInfo.height)>maxSide)
  throw Error('Invalid preprocessed raster dimensions');
await fs.mkdir(path.dirname(output),{recursive:true});
const stage=await fs.mkdtemp(path.join(path.dirname(output),`.${path.basename(output)}-stage-`));
const settings={colormode:'color',hierarchical:'cutout',mode:'spline',filter_speckle:8,
  color_precision:6,layer_difference:16,corner_threshold:60,length_threshold:4,
  max_iterations:10,splice_threshold:45,path_precision:2};
try{
  const processedPath=path.join(stage,'trace-input.png'),svgPath=path.join(stage,'facade.svg');
  await fs.writeFile(processedPath,processed);
  const script=`import importlib.metadata,json,sys,vtracer\nsettings=json.loads(sys.argv[3])\nvtracer.convert_image_to_svg_py(sys.argv[1],sys.argv[2],**settings)\nprint(json.dumps({'version':importlib.metadata.version('vtracer')}))`;
  const started=performance.now();let stdout:string;
  try{({stdout}=await run(python,['-c',script,processedPath,svgPath,JSON.stringify(settings)],{timeout:timeoutSec*1000,maxBuffer:1024*1024}));}
  catch(error:any){throw Error(`VTracer failed; install vtracer==0.6.15 in an isolated venv. ${error.message}`);}
  const elapsedSeconds=(performance.now()-started)/1000,tool=JSON.parse(stdout.trim());
  if(tool.version!=='0.6.15')throw Error(`Expected vtracer 0.6.15, got ${tool.version}`);
  const svg=await fs.readFile(svgPath),markup=svg.toString();
  if(!/^\s*<\?xml[\s\S]*?<svg\b|^\s*<svg\b/.test(markup)||
    /<(?:script|image|foreignObject)\b|\b(?:href|onload)\s*=/.test(markup))throw Error('Unexpected SVG content');
  const svgInfo=await sharp(svg).metadata();
  if(svgInfo.width!==processedInfo.width||svgInfo.height!==processedInfo.height)
    throw Error('SVG did not preserve preprocessed raster dimensions');
  const render=await sharp(svg).png().toBuffer(),renderInfo=await sharp(render).metadata();
  if(renderInfo.width!==processedInfo.width||renderInfo.height!==processedInfo.height)
    throw Error('Rendered SVG dimensions differ from input');
  await fs.writeFile(path.join(stage,'render.png'),render);
  const receipt={version:1,policy:'Pixel tracing only; source identity, architectural geometry and material are not verified or accepted.',
    source:{path:input,sha256:sha(source),width:sourceInfo.width,height:sourceInfo.height,bytes:source.length},
    preprocessing:{maxSide,paletteColors,dither:0,resizeFit:'inside',withoutEnlargement:true,rotateExif:true},
    traceInput:{path:'trace-input.png',sha256:sha(processed),width:processedInfo.width,height:processedInfo.height,bytes:processed.length},
    tool:{name:'vtracer-python',version:tool.version,settings,elapsedSeconds},
    svg:{path:'facade.svg',sha256:sha(svg),width:svgInfo.width,height:svgInfo.height,
      pathCount:(markup.match(/<path\b/g)??[]).length,bytes:svg.length},
    rendered:{path:'render.png',sha256:sha(render),width:renderInfo.width,height:renderInfo.height,bytes:render.length}};
  await fs.writeFile(path.join(stage,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  try{await fs.access(output);throw Error(`Output appeared during build: ${output}`);}catch(error:any){if(error.code!=='ENOENT')throw error;}
  await fs.rename(stage,output);
  console.log(JSON.stringify({output,sourceSha256:receipt.source.sha256,svgBytes:svg.length,pathCount:receipt.svg.pathCount,elapsedSeconds}));
}catch(error){await fs.rm(stage,{recursive:true,force:true});throw error;}
