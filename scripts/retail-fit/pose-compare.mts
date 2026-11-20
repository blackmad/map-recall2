// Lane retail-fit: photo over render crop at one pose (frames/off/<key>/photo.jpg over frames/fit2/<key>/likeness.node.png) to check which arch a fit lands in.
//   npx tsx scripts/retail-fit/pose-compare.mts <key> <out.png> [left px of 1440]
import sharp from 'sharp';
const R='/Users/blackmad/Code/map-recall2-worktrees/retail-fit-20261120/artifacts/retail-fit/frames/';
const k=process.argv[2];
const cut=async(f:string)=>sharp(await sharp(f).resize(1440,900,{fit:'fill'}).png().toBuffer()).extract({left:Number(process.argv[4]??400),top:250,width:800,height:200}).png().toBuffer();
const a=await cut(R+'off/'+k+'/photo.jpg'), b=await cut(R+'fit2/'+k+'/likeness.node.png');
await sharp({create:{width:800,height:404,channels:3,background:'#000'}}).composite([{input:a,left:0,top:0},{input:b,left:0,top:204}]).png().toFile(process.argv[3]);
