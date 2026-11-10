import { loadRoutingFeatures } from '../lib/routingFeatures.ts';
const ids = process.argv.slice(2);
const fs = await loadRoutingFeatures<any>();
console.log('count', fs.length);
for (const id of ids) { const i = fs.findIndex((f: any) => f.id === id); console.log(id, 'index', i, JSON.stringify(fs[i])); }
