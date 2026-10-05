/** Stable asset dates: unchanged exports retain dates; legacy assets use git history. */
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';

export function refreshModelDates(out: string) {
  const dest = path.join(out, 'model-dates.json');
  const previous = fs.existsSync(dest) ? JSON.parse(fs.readFileSync(dest, 'utf8')).models : {};
  const history = execFileSync('git', ['log', '--format=DATE:%cI', '--name-only', '--', `${out}/*.glb`], {encoding: 'utf8'});
  const committed: Record<string, string> = {};
  let date = '';
  for (const line of history.split('\n')) {
    if (line.startsWith('DATE:')) date = line.slice(5);
    else if (line.endsWith('.glb') && !committed[line]) committed[line] = date;
  }
  const changed = new Set(execFileSync('git', ['diff', '--name-only', 'HEAD', '--', out], {encoding: 'utf8'}).trim().split('\n'));
  const models: Record<string, {updatedAt: string; version: string; dateSource: string}> = {};
  for (const filename of fs.readdirSync(out).filter(name => name.endsWith('.glb')).sort()) {
    const file = path.join(out, filename), id = filename.slice(0, -4);
    const version = createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);
    if (previous[id]?.version === version) models[id] = previous[id];
    else if (previous[id] || changed.has(file) || !committed[file]) models[id] = {updatedAt: fs.statSync(file).mtime.toISOString(), version, dateSource: 'asset-update'};
    else models[id] = {updatedAt: committed[file], version, dateSource: 'git-history'};
  }
  fs.writeFileSync(dest, JSON.stringify({description: 'Model asset update dates, not historical building construction dates.', models}, null, 2) + '\n');
}
