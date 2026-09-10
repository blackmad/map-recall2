/** Local review service. Labels are saved to disk immediately; models remain candidates. */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
if (process.argv.includes('--neighbourhood')) {
  await import('../da-costa-block/serve-neighbourhood.mjs');
} else {
const root = path.resolve(process.env.ROUTER_REVIEW_ROOT || '.cache/facade-rebuild/router-review');
const port = Number(process.env.ROUTER_REVIEW_PORT || 5194);
const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json')));
const labelPath = path.join(root, 'labels.json');
let labels = { schemaVersion: 1, datasetId: manifest.datasetId, labels: [] };
try { labels = JSON.parse(await fs.readFile(labelPath)); if (labels.datasetId !== manifest.datasetId) throw Error('Dataset changed: preserve the old labels and migrate by source hash before serving'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const csrf = crypto.randomBytes(24).toString('hex');
let training = { status: 'idle' }, writeQueue = Promise.resolve();
const save = async () => { await fs.writeFile(`${labelPath}.tmp`, JSON.stringify(labels, null, 2) + '\n'); await fs.rename(`${labelPath}.tmp`, labelPath); };
const json = (res, code, value) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); };
async function body(req) { let text = ''; for await (const chunk of req) { text += chunk; if (text.length > 200000) throw Error('Request too large'); } return JSON.parse(text); }
function validate(row) {
  const item = manifest.items.find(i => i.id === row.itemId);
  if (!item || item.sourceSha256 !== row.sourceSha256 || !manifest.tasks[row.task]?.choices.some(c => c[0] === row.value) || typeof row.reviewer !== 'string' || !row.reviewer.trim()) throw Error('Invalid label, reviewer or source');
  return { itemId: item.id, sourceSha256: item.sourceSha256, task: row.task, value: row.value, reviewer: row.reviewer.trim().slice(0, 80), reviewedAt: new Date().toISOString(), origin: 'human-review' };
}
http.createServer(async (req, res) => {
  try {
    if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`) return json(res, 403, { error: 'Local host required' });
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (req.method === 'GET' && url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(await fs.readFile('public/canal-drive/router-review.html')); }
    if (req.method === 'GET' && url.pathname === '/api/session') return json(res, 200, { manifest, labels, csrf, training });
    if (req.method === 'GET' && url.pathname === '/api/export') return json(res, 200, labels);
    if (req.method === 'GET' && url.pathname === '/api/training') return json(res, 200, training);
    if (req.method === 'GET' && url.pathname.startsWith('/images/')) {
      const name = url.pathname.slice('/images/'.length);
      if (!manifest.items.some(i => i.image === name || i.groundImage === name)) return json(res, 404, { error: 'Unknown image' });
      res.writeHead(200, { 'content-type': 'image/jpeg' }); return res.end(await fs.readFile(path.join(root, 'images', name)));
    }
    if (req.method !== 'POST' || req.headers['x-review-token'] !== csrf) return json(res, 403, { error: 'Open the local review page first' });
    const data = await body(req);
    if (url.pathname === '/api/unlabel') {
      const item = manifest.items.find(i => i.id === data.itemId);
      if (!item || item.sourceSha256 !== data.sourceSha256 || !manifest.tasks[data.task]) throw Error('Invalid undo target');
      const operation = writeQueue.then(async () => {
        labels.labels = labels.labels.filter(l => l.itemId !== item.id || l.task !== data.task);
        await save();
      });
      writeQueue = operation.catch(() => {}); await operation;
      return json(res, 200, { labels });
    }
    if (url.pathname === '/api/label' || url.pathname === '/api/import') {
      if (url.pathname === '/api/import' && data.datasetId !== manifest.datasetId) throw Error('This export belongs to another dataset');
      const importing = url.pathname === '/api/import';
      const incoming = (importing ? data.labels : [data]).map(row => {
        if (importing && (row.origin !== 'human-review' || !Number.isFinite(Date.parse(row.reviewedAt)))) throw Error('Import needs dated human reviews; model proposals cannot become human labels');
        const result = validate(row);
        return importing ? { ...result, reviewedAt: row.reviewedAt } : result;
      });
      const operation = writeQueue.then(async () => {
        for (const row of incoming) {
          const previous = labels.labels.find(l => l.itemId === row.itemId && l.task === row.task);
          if (importing && previous && Date.parse(previous.reviewedAt) > Date.parse(row.reviewedAt)) continue;
          labels.labels = labels.labels.filter(l => l.itemId !== row.itemId || l.task !== row.task);
          labels.labels.push(row);
        }
        await save();
      });
      writeQueue = operation.catch(() => {}); await operation;
      return json(res, 200, { labels });
    }
    if (url.pathname === '/api/train') {
      if (training.status === 'running') return json(res, 409, { error: 'Training is already running' });
      await writeQueue; await save();
      const run = `run-${Date.now()}`;
      const snapshot = path.join(root, `${run}-labels.json`);
      await fs.writeFile(snapshot, JSON.stringify(labels, null, 2));
      training = { status: 'running', run, startedAt: new Date().toISOString() };
      const child = spawn(path.resolve('.cache/facade-rebuild/router-venv/bin/python'), ['scripts/facade-rebuild/train-router-classifiers.py', '--root', root, '--labels', snapshot, '--out', path.join(root, 'models', run)], { stdio: ['ignore', 'pipe', 'pipe'] });
      let log = ''; const append = chunk => { log = (log + chunk).slice(-5000); };
      child.stdout.on('data', append); child.stderr.on('data', append);
      child.on('error', e => { training = { ...training, status: 'error', message: e.message }; });
      child.on('close', async code => {
        let report; try { report = JSON.parse(await fs.readFile(path.join(root, 'models', run, 'report.json'))); } catch {}
        training = { ...training, status: code === 0 ? 'complete' : 'error', report, message: code === 0 ? undefined : log };
      });
      return json(res, 202, training);
    }
    return json(res, 404, { error: 'Unknown route' });
  } catch (e) { return json(res, 400, { error: e.message }); }
}).listen(port, '127.0.0.1', () => console.log(`Review ${manifest.items.length} facades at http://127.0.0.1:${port}/`));
}
