// A local HTTPS (HTTP/2) stand-in for the deployed site (lane LS, 2026-11-14): every request goes to --origin as is,
// except /js/<file>.js found in --bundles <dir>, served from there with the deploy's /js cache header (no-cache + an
// ETag). Playwright turns the HTTP cache off for any context with a route, so a before/after of a source change
// measured through routes downloads every repeated file again; through this proxy the browser keeps its cache as a
// player's does. Chrome trusts the self-signed certificate by its SPKI hash (--ignore-certificate-errors-spki-list).
//
//   node scripts/perf/deploy-proxy.mjs --port 4870 --cert <dir with cert.pem, key.pem> [--bundles dir] [--origin https://rideamsterdam.nl]
import http2 from 'node:http2';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import https from 'node:https';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const port = Number(opt('port', '4870')), certDir = opt('cert', '.'), bundles = opt('bundles', ''), origin = opt('origin', 'https://rideamsterdam.nl');
// The upstream body is passed through as it arrives, still compressed (content-encoding kept), so the bytes and the
// timing on the wire stay close to the deploy's.
const HOP = new Set(['transfer-encoding', 'connection', 'keep-alive', 'alt-svc', 'report-to', 'nel', 'strict-transport-security']);
const agent = new https.Agent({ keepAlive: true, maxSockets: 64 });
const served = {};

const server = http2.createSecureServer({ cert: fs.readFileSync(path.join(certDir, 'cert.pem')), key: fs.readFileSync(path.join(certDir, 'key.pem')), allowHTTP1: true }, (req, res) => {
  try {
    const url = req.url;
    const m = /^\/js\/([\w.-]+\.js)(\?.*)?$/.exec(url);
    const local = m && bundles ? path.join(bundles, m[1]) : null;
    if (local && fs.existsSync(local)) {
      const body = fs.readFileSync(local), etag = `"${crypto.createHash('sha1').update(body).digest('hex')}"`;
      served[m[1]] = (served[m[1]] || 0) + 1;
      if (req.headers['if-none-match'] === etag) { res.writeHead(304, { etag, 'cache-control': 'no-cache' }); res.end(); return; }
      res.writeHead(200, { 'content-type': 'application/javascript', 'cache-control': 'no-cache', etag });
      res.end(body);
      return;
    }
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) if (!k.startsWith(':') && !['host', 'connection'].includes(k)) headers[k] = v;
    const up = https.request(origin + url, { method: req.method, headers, agent }, r => {
      const out = {};
      for (const [k, v] of Object.entries(r.headers)) if (!HOP.has(k)) out[k] = v;
      res.writeHead(r.statusCode, out);
      r.pipe(res);
    });
    up.on('error', e => { try { res.writeHead(502); res.end(String(e)); } catch (_) { /* sent */ } });
    req.pipe(up);
  } catch (e) {
    res.writeHead(502); res.end(String(e));
  }
});
server.listen(port, '127.0.0.1', () => console.log(`proxy https://127.0.0.1:${port} -> ${origin}${bundles ? ` (bundles ${bundles})` : ''}`));
process.on('SIGTERM', () => { console.log('served', JSON.stringify(served)); process.exit(0); });
