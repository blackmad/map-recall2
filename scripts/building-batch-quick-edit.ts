/** Compile short UI-style photo choices into the existing recipe edit format. */
import fs from 'node:fs';import path from 'node:path';import {quickEdit} from './buildingBatchQuickEdits';
const option=(name:string)=>{const i=process.argv.indexOf(name);if(i<0||!process.argv[i+1])throw Error('Missing '+name);return process.argv[i+1];};
const root=path.resolve(option('--root')),input=option('--choices'),output=path.resolve(option('--output'));
if(!output.startsWith(path.resolve('artifacts')+path.sep))throw Error('Photo-edit output must stay isolated under artifacts');
const contexts=JSON.parse(fs.readFileSync(root+'/review/quick-contexts.json','utf8'));
const choices=JSON.parse(fs.readFileSync(input,'utf8')).choices,edits=[];
for(const choice of choices){
 const item=contexts[choice.id];if(!item)throw Error('Unknown owner '+choice.id);
 const values={...choice.values,notes:choice.notes||'Quick photo review of counts, materials and form.'};
 edits.push(quickEdit(item.context,{...item.settings,...values},new Set(Object.keys(values))));
}
fs.writeFileSync(output,JSON.stringify({edits},null,2)+'\n');console.log(JSON.stringify({compiled:edits.length,output}));
