/** Print the wide wall panels of block-kit builds: node --import tsx scripts/haparandaweg/panel-list.ts 952-1002 746-786 */
import fs from 'node:fs';

for (const i of process.argv.slice(2)) {
  console.log('==', i);
  const p = JSON.parse(fs.readFileSync(`artifacts/haparandaweg/haparandaweg-${i}/panels.json`, 'utf8'));
  for (const a of p) if (a.width > 1.5) console.log(JSON.stringify(a));
}
