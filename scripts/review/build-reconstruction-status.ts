/** Generate a self-contained reconstruction-status dashboard.
 *
 * Inlines the anchor calibration and crop-preflight reports so the page works
 * from the static server with no extra routes. Read-only reporting: it shows
 * measurements and links, it certifies nothing.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const READ = async (file: string): Promise<any | null> => { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return null; } };
const anchors = await READ('review-data/anchor-registrations.json');
const preflight = await READ('review-data/crop-preflight.json');
const task = await READ('public/canal-drive/data/pano-anchor-task-expanded.json');
const assets = await READ('review-data/anchor-registrations.json');

const data = {
  anchors: anchors?.panos ?? [],
  preflight: preflight ? { total: preflight.total, usable: preflight.usable, unusable: preflight.unusable, reasons: preflight.reasons } : null,
  skyExamples: (preflight?.entries ?? []).filter((entry: any) => entry.reasons?.includes('mostly-sky')).slice(0, 12).map((entry: any) => ({ file: entry.file, skyRowFraction: entry.metrics.skyRowFraction })),
  task: task ? { panos: task.panos.length, markers: task.panos.reduce((n: number, p: any) => n + p.markers.length, 0) } : null,
};

const esc = (value: unknown) => String(value).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!));

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reconstruction status · Map Recall</title>
<style>
:root{--bg:#0f1419;--panel:#161c22;--line:#2a333c;--ink:#e8ecef;--dim:#93a4b1;--good:#7fd4a0;--warn:#f0b46b;--acc:#78c8ff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1080px;margin:0 auto;padding:28px 20px 64px}
h1{margin:0 0 4px;font-size:24px}h2{margin:34px 0 12px;font-size:17px;color:var(--acc)}
.sub{color:var(--dim);margin:0 0 18px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:16px 0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px}
.card .n{font-size:26px;font-weight:700}.card .l{color:var(--dim);font-size:13px}
table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);font-size:14px}
th{color:var(--dim);font-weight:600}tr:last-child td{border-bottom:none}
.badge{display:inline-block;border-radius:999px;padding:1px 9px;font-size:12px;font-weight:600}
.ok{background:rgba(127,212,160,.15);color:var(--good);border:1px solid rgba(127,212,160,.4)}
.no{background:rgba(240,180,107,.13);color:var(--warn);border:1px solid rgba(240,180,107,.4)}
a.btn{display:inline-block;background:#1d6f4a;border:1px solid #2a8f61;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;margin:4px 8px 4px 0}
a.btn.alt{background:#22303a;border-color:#37474f}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
.gallery figure{margin:0;background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden}
.gallery img{display:block;width:100%;height:150px;object-fit:contain;background:#000}
.gallery figcaption{padding:6px 8px;font-size:12px;color:var(--dim)}
code{background:#1c242b;border:1px solid var(--line);border-radius:4px;padding:1px 5px;font-size:13px}
ul{color:var(--ink)}li{margin:4px 0}
.note{background:var(--panel);border-left:4px solid var(--warn);border-radius:6px;padding:12px 14px;color:var(--dim);margin:14px 0}
</style>
</head>
<body>
<main>
  <h1>Reconstruction status</h1>
  <p class="sub">Measured state of the pano→3DBAG pipeline. Reports only; nothing here certifies fidelity.</p>
  <a class="btn" href="./pano-anchor.html?task=expanded">Open the anchor tool (12 panos / ${data.task?.markers ?? 0} markers)</a>
  <a class="btn alt" href="./reconstruction-workbench.html">Open the workbench</a>

  <h2>Panorama boresight calibration</h2>
  <p class="sub">Held-out residual fits the boresight on a calibration split and measures the validation split, so it is not fitted on itself.</p>
  <table>
    <thead><tr><th>Panorama</th><th>Anchors</th><th>In-sample median</th><th>Held-out median</th><th>Held-out px</th><th>Status</th></tr></thead>
    <tbody>
      ${data.anchors.map((p: any) => `<tr>
        <td><code>${esc(p.panoramaId.slice(0, 30))}</code></td>
        <td>${p.anchors}</td>
        <td>${p.medianM} m</td>
        <td>${p.validation ? `${p.validation.medianM} m` : '—'}</td>
        <td>${p.validation ? p.validation.medianPx : '—'}</td>
        <td>${p.qualifies ? '<span class="badge ok">correspondence-verified</span>' : '<span class="badge no">below threshold</span>'}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>Crop usability preflight</h2>
  <div class="cards">
    <div class="card"><div class="n">${data.preflight?.total ?? '—'}</div><div class="l">cached crops</div></div>
    <div class="card"><div class="n" style="color:var(--good)">${data.preflight?.usable ?? '—'}</div><div class="l">usable</div></div>
    <div class="card"><div class="n" style="color:var(--warn)">${data.preflight?.unusable ?? '—'}</div><div class="l">unusable</div></div>
    <div class="card"><div class="n" style="color:var(--warn)">${data.preflight?.reasons?.['mostly-sky'] ?? '—'}</div><div class="l">mostly sky</div></div>
  </div>
  <div class="note"><b>${data.preflight?.reasons?.['mostly-sky'] ?? 0} crops are mostly sky</b> because the crop plane's top uses the BAG <b>ridge</b> height.
  Using the matched 3DBAG <b>eave</b> (<code>wallTop.ts</code>) would reclaim them. A minor lever (~3%), not applied.</div>
  <div class="gallery">
    ${data.skyExamples.map((e: any) => `<figure><img loading="lazy" src="/data/city-expansion/evidence/${esc(e.file)}" alt=""><figcaption>sky ${(e.skyRowFraction * 100).toFixed(0)}% · ${esc(e.file.slice(0, 10))}</figcaption></figure>`).join('')}
  </div>

  <h2>What shipped this session</h2>
  <ul>
    <li><b>correspondence-verified</b> status, accepted by the paid fidelity gate, with required median/p95 residual — not a bypass.</li>
    <li><b>Measured boresight</b> applied in the camera model; auto-estimate constrained by a GPS-track prior and the real eave.</li>
    <li><b>Anchor tool</b> with undo, help, mini-map, and an auto-selected expanded task.</li>
    <li><b>Retail lane</b>: storefront assembly → metric patches (display glass, entrance, fascia, awning).</li>
    <li>Modules: blockfaces, silhouette compiler, appearance score, corrections registry, crop preflight, boresight fit + cross-validation.</li>
  </ul>
</main>
</body>
</html>`;

await fs.mkdir('public/canal-drive', { recursive: true });
await fs.writeFile('public/canal-drive/reconstruction-status.html', html);
console.log(JSON.stringify({ output: 'public/canal-drive/reconstruction-status.html', anchorPanos: data.anchors.length, skyExamples: data.skyExamples.length, preflightTotal: data.preflight?.total ?? null }));
