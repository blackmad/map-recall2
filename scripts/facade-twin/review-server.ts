/**
 * Serve the review tools and keep their answers in a real database.
 *
 * The first version of the review page kept answers in `localStorage` and
 * offered a JSON download. That is a worse idea than it looks: the answers are
 * the scarcest thing in this project — nobody has ever checked any of these
 * measurements — and putting them in a browser store means they vanish with a
 * cleared cache, cannot be read by any script without a manual export, and
 * cannot be added to from a second device. A verdict that has to be exported to
 * be used will not be used.
 *
 * So: SQLite, written on every click, read directly by the scoring scripts.
 * `node:sqlite` ships with Node, so this adds no dependency.
 *
 * The table records the question, the answer and *when*, one row per answer
 * rather than one per building, so changing your mind is a new row and the
 * history stays. Reviews are cheap to collect and impossible to reconstruct.
 *
 * Usage: npx tsx scripts/facade-twin/review-server.ts [--port=8792]
 */
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const PORT = Number(arg('port') ?? 8792);
const ROOT = path.resolve('public');
const DB_PATH = path.resolve('.cache/facade-twin/review.sqlite');

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS answers (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    pand_id   TEXT    NOT NULL,
    question  TEXT    NOT NULL,
    answer    TEXT    NOT NULL,
    reviewer  TEXT    NOT NULL DEFAULT 'human',
    note      TEXT,
    answered_at TEXT  NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS answers_pand ON answers (pand_id);
  -- The latest answer per building and question wins; earlier rows are history.
  CREATE VIEW IF NOT EXISTS latest AS
    SELECT pand_id, question, answer, reviewer, answered_at FROM answers a
    WHERE id = (SELECT MAX(id) FROM answers b
                WHERE b.pand_id = a.pand_id AND b.question = a.question);
`);

const insert = db.prepare(
  'INSERT INTO answers (pand_id, question, answer, reviewer, note) VALUES (?, ?, ?, ?, ?)');
const allLatest = db.prepare('SELECT pand_id, question, answer FROM latest');
const counts = db.prepare(
  'SELECT question, answer, COUNT(*) n FROM latest GROUP BY question, answer ORDER BY question, n DESC');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (req.method === 'POST' && url.pathname === '/api/answer') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { pandId, answers, reviewer, note } = JSON.parse(body);
      if (!pandId || !answers) throw new Error('pandId and answers required');
      for (const [question, answer] of Object.entries(answers as Record<string, string>)) {
        if (answer == null || question === 'done' || question === 'at') continue;
        insert.run(String(pandId), String(question), String(answer), String(reviewer ?? 'human'), note ?? null);
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, saved: Object.keys(answers).length }));
    } catch (error) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: String(error) }));
    }
    return;
  }

  if (url.pathname === '/api/answers') {
    const rows = allLatest.all() as Array<{ pand_id: string; question: string; answer: string }>;
    const byPand: Record<string, Record<string, string>> = {};
    for (const r of rows) (byPand[r.pand_id] ??= {})[r.question] = r.answer;
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ answers: byPand, tally: counts.all() }));
    return;
  }

  // Review imagery lives in the cache, not under public/, because it is derived
  // from third-party imagery and must never be committed or accidentally
  // staged for publication. Served from explicit prefixes rather than by moving
  // it, so the rule stays visible at the one place it could be broken.
  for (const [prefix, dir] of [['/registration-review/', '.cache/facade-twin/registration-review']] as const) {
    if (!url.pathname.startsWith(prefix)) continue;
    const rel = url.pathname.slice(prefix.length);
    const root = path.resolve(dir);
    const file = path.resolve(dir, decodeURIComponent(rel));
    if (!file.startsWith(root)) { res.writeHead(403).end('no'); return; }
    try {
      res.writeHead(200, {
        'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(await readFile(file));
    } catch { res.writeHead(404).end('no'); }
    return;
  }

  // Multi-view strips live in the cache, not under public/, because they are
  // derived from third-party imagery and must never be committed. Served from
  // an explicit prefix rather than by moving them.
  if (url.pathname.startsWith('/cache-strips/')) {
    const rel = url.pathname.slice('/cache-strips/'.length);
    const file = path.resolve('.cache/facade-twin/strips-multi', decodeURIComponent(rel));
    if (!file.startsWith(path.resolve('.cache/facade-twin/strips-multi'))) { res.writeHead(403).end('no'); return; }
    try {
      res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'no-store' });
      res.end(await readFile(file));
    } catch { res.writeHead(404).end('no'); }
    return;
  }

  // Everything else is a file under public/, so the review page, the strips and
  // the staged JSON all come from one origin and no CORS is involved.
  let file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (url.pathname === '/' ) file = path.join(ROOT, 'canal-drive/review.html');
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('no'); return; }
  try {
    const info = await stat(file);
    if (info.isDirectory()) { res.writeHead(404).end('no'); return; }
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); }
});

server.listen(PORT, '127.0.0.1', () => {
  const n = (db.prepare('SELECT COUNT(*) n FROM answers').get() as { n: number }).n;
  console.log(`review server on http://127.0.0.1:${PORT}/`);
  console.log(`  database ${path.relative(process.cwd(), DB_PATH)} — ${n} answers so far`);
  console.log(`  review deck  http://127.0.0.1:${PORT}/canal-drive/review.html`);
  console.log(`  projections  http://127.0.0.1:${PORT}/canal-drive/match.html`);
  console.log(`  registration http://127.0.0.1:${PORT}/canal-drive/registration.html`);
});
