/** Reproduce local whole-block extraction. Paid model trials are a separate explicit switch. */
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const run=(file:string,args:string[]=[])=>execFileSync(process.execPath,['--import','tsx',file,...args],{stdio:'inherit'});
for(const strip of ['strip1','strip2']){
 const input=`.cache/facade-assessment/banana-head-on-v1/${strip}.png`;
 const receipt=`.cache/facade-assessment/banana-head-on-v1/${strip}.json`;
 run('scripts/review/extract-facade-components.ts',[`--input=${input}`,`--receipt=${receipt}`,`--out=.cache/facade-assessment/banana-head-on-v1/auto-components-${strip}`]);
 run('scripts/review/detect-entrance-assemblies.ts',[`--input=${input}`,`--receipt=${receipt}`,`--out=.cache/facade-assessment/block-assemblies-v1/${strip}`]);
}
run('scripts/review/fit-balcony-cleanup.ts',['--image=.cache/facade-assessment/banana-head-on-v1/strip1.png','--features=.cache/facade-assessment/banana-head-on-v1/auto-components-strip1/components.json','--out=.cache/facade-assessment/block-assemblies-v1/balcony-cleanup']);
run('scripts/review/build-block-assemblies.ts');
if(existsSync('.cache/facade-assessment/block-assemblies-v1/banana-clean.png')){run('scripts/review/check-block-layer-alignment.ts');run('scripts/review/compose-block-cleanup.ts');run('scripts/review/build-block-assemblies.ts');}
if(process.argv.includes('--image-trials'))run('scripts/review/run-block-image-comparison.ts',['--run',...(process.argv.includes('--banana-only')?['--banana-only']:[])]);
console.log('Preview: http://localhost:5195/canal-drive/facade-texture-demo.html?study=block-auto');
