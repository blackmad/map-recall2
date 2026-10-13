#!/usr/bin/env node
// Prune stored Firebase Hosting versions so deploys stop failing on the
// 10 GB Spark storage quota.
//
// Why: `maxVersions` (3 on both sites) only expires *released* versions, and
// expired versions are not collected promptly; with ~40 deploys a day at
// 190 MB (canalrecall) + 100 MB (edumap) the project held 100+ versions per
// site (25 GB listed on 2026-10-13) and every deploy since 14:27 returned
// HTTP 429 "exceeded the Hosting storage quota". Same failure as 2026-10-01.
//
// Usage (dry run by default; nothing is deleted without --apply):
//   node scripts/hosting/prune-versions.mjs                 # list what would go
//   node scripts/hosting/prune-versions.mjs --apply         # delete
//   node scripts/hosting/prune-versions.mjs --keep=5 --apply
//
// Auth: a `gcloud auth print-access-token` token (local, the signed-in user)
// or GOOGLE_APPLICATION_CREDENTIALS pointing at the CI service account JSON
// (the manual workflow). Keeps the live release and the newest `--keep`
// FINALIZED versions per site; deletes every other FINALIZED or EXPIRED one.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const PROJECT = 'map-recall2-blackmad';
const SITES = ['edumap-blackmad', 'canalrecall-blackmad'];
const API = 'https://firebasehosting.googleapis.com/v1beta1/';
const args = new Map(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true']; }));
const apply = args.get('apply') === 'true';
const keepN = Number(args.get('keep') ?? 3);

async function token() {
  const sa = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (sa) {
    const key = JSON.parse(readFileSync(sa, 'utf8'));
    const now = Math.floor(Date.now() / 1000);
    const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: key.token_uri, iat: now, exp: now + 3600 })}`;
    const sig = createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');
    const res = await fetch(key.token_uri, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${sig}` });
    const json = await res.json();
    if (!json.access_token) throw new Error(`service-account token: ${JSON.stringify(json).slice(0, 200)}`);
    return json.access_token;
  }
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}

const T = await token();
const headers = { Authorization: `Bearer ${T}`, 'x-goog-user-project': PROJECT };
async function api(path, method = 'GET') {
  const res = await fetch(path.startsWith('http') ? path : API + path, { method, headers });
  const text = await res.text();
  if (!res.ok) return { error: { code: res.status, message: text.slice(0, 160) } };
  return text ? JSON.parse(text) : {};
}
async function allVersions(site) {
  const out = []; let pageToken = '';
  do {
    const d = await api(`sites/${site}/versions?pageSize=100${pageToken ? `&pageToken=${pageToken}` : ''}`);
    if (d.error) throw new Error(`${site} versions: ${JSON.stringify(d.error)}`);
    out.push(...(d.versions ?? [])); pageToken = d.nextPageToken ?? '';
  } while (pageToken);
  return out.sort((a, b) => (a.createTime ?? '').localeCompare(b.createTime ?? ''));
}
const gb = vs => (vs.reduce((s, v) => s + Number(v.versionBytes ?? 0), 0) / 1e9).toFixed(2);

let totalDeleted = 0;
for (const site of SITES) {
  const rel = await api(`sites/${site}/releases?pageSize=1`);
  const live = rel.releases?.[0]?.version?.name ?? '';
  const versions = await allVersions(site);
  const finalized = versions.filter(v => v.status === 'FINALIZED');
  const keep = new Set([live, ...finalized.slice(-keepN).map(v => v.name)]);
  const doomed = versions.filter(v => !keep.has(v.name) && (v.status === 'FINALIZED' || v.status === 'EXPIRED'));
  console.log(`${site}: ${versions.length} versions (${gb(versions)} GB), live ${live.split('/').pop()}, keep ${keep.size}, ${apply ? 'deleting' : 'would delete'} ${doomed.length} (${gb(doomed)} GB)`);
  if (!apply) continue;
  let ok = 0, failed = 0;
  for (const v of doomed) {
    const r = await api(v.name, 'DELETE');
    if (r.error) { failed++; if (failed <= 3) console.log(`  failed ${v.name.split('/').pop()} ${v.status}: ${JSON.stringify(r.error)}`); } else ok++;
  }
  totalDeleted += ok;
  const left = await allVersions(site);
  console.log(`  deleted ${ok}, failed ${failed}; remaining ${left.length} (${gb(left)} GB)`);
}
if (!apply) console.log('dry run; add --apply to delete');
else console.log(`done: ${totalDeleted} versions deleted`);
