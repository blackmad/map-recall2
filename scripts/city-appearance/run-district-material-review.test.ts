import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { jobKey, schedule, transient, verifyOutput, type Dependencies, type Job } from './run-district-material-review.ts';

const job = (index: number): Job => ({ areaId: 'area', batchIndex: index, selectionHash: String(index).padStart(64, '0'),
  manifest: `manifest-${index}`, manifestSha256: String(index + 1).padStart(64, '0') });

function fixture() {
  let time = 0, scans = 0, calls = 0;
  const state: any = { version: 2, policy: 'test', jobs: {} };
  const jobs = [job(0)];
  const deps: Dependencies = {
    discover: async () => { scans++; return jobs; },
    fingerprint: async item => ({ manifest: item.manifestSha256, model: 'pinned' }),
    execute: async () => { calls++; return { outputs: { report: { path: 'report', sha256: 'a'.repeat(64) } }, proposalErrors: [] }; },
    verify: async () => true,
    readState: async () => state,
    saveState: async () => {},
    sleep: async ms => { time += ms; }, clock: () => time,
  };
  return { deps, state, jobs, get calls() { return calls; }, get scans() { return scans; } };
}
const options = { run: true, watch: false, retryFailed: false, maxBatches: 44, maxHours: 8 };

test('watch counts new work once, skips complete jobs, and stops at deadline', async () => {
  const f = fixture();
  let current = 0;
  f.deps.clock = () => current;
  f.deps.sleep = async ms => { if (f.scans === 1) f.jobs.push(job(1));
    current += ms; };
  const result = await schedule({ ...options, watch: true, maxHours: 1, pollMs: 1_800_000 }, f.deps);
  assert.equal(result.started, 2);
  assert.equal(f.calls, 2);
  assert.ok(f.scans >= 2);
});

test('completed job resumes only when its outputs verify', async () => {
  const f = fixture();
  await schedule(options, f.deps);
  assert.equal((await schedule(options, f.deps)).started, 0);
  f.deps.verify = async () => false;
  assert.equal((await schedule(options, f.deps)).started, 1);
  assert.equal(f.state.jobs[Object.keys(f.state.jobs)[0]].status, 'error');
});

test('source or model fingerprint changes require a new job and directory key', async () => {
  const f = fixture();
  await schedule(options, f.deps);
  const oldKey = Object.keys(f.state.jobs)[0];
  f.deps.fingerprint = async item => ({ manifest: item.manifestSha256, model: 'new digest' });
  await schedule(options, f.deps);
  assert.equal(Object.keys(f.state.jobs).length, 2);
  assert.notEqual(Object.keys(f.state.jobs).find(key => key !== oldKey), oldKey);
  assert.equal(jobKey({ manifest: 'x' }), jobKey({ manifest: 'x' }));
});

test('permanent errors are not retried and are skipped on later scans', async () => {
  const f = fixture(); let attempts = 0;
  f.deps.execute = async () => { attempts++; throw Object.assign(Error('bad source hash'), { code: 'EINVAL' }); };
  await schedule(options, f.deps);
  await schedule(options, f.deps);
  assert.equal(attempts, 1);
  await schedule({ ...options, retryFailed: true }, f.deps);
  assert.equal(attempts, 2);
});

test('transient retries stop after three attempts and preserve failure receipts', async () => {
  const f = fixture(); let attempts = 0, sleeps = 0;
  f.deps.execute = async () => { attempts++; throw Object.assign(Error('connection reset'), { code: 'ECONNRESET' }); };
  f.deps.sleep = async () => { sleeps++; };
  await schedule(options, f.deps);
  assert.equal(attempts, 3);
  assert.equal(sleeps, 2);
  assert.equal(Object.values(f.state.jobs)[0].previousFailures.length, 3);
  assert.equal(transient(Error('Local Ollama chat HTTP 429')), true);
  assert.equal(transient(Error('Local model missing')), false);
});

test('malformed progress state is fatal before discovery or execution', async () => {
  const f = fixture();
  f.deps.readState = async () => { throw SyntaxError('corrupt progress JSON'); };
  await assert.rejects(schedule(options, f.deps), /corrupt progress JSON/);
  assert.equal(f.scans, 0);
});

test('an altered output hash invalidates resume', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'district-material-review-'));
  try {
    const file = path.join(directory, 'report.json');
    await fs.writeFile(file, '{"ok":true}');
    const sha256 = crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
    const receipt = { path: file, sha256 };
    assert.equal(await verifyOutput(receipt), true);
    const f = fixture();
    f.deps.verify = async () => verifyOutput(receipt);
    await schedule(options, f.deps);
    const first = f.calls;
    await fs.writeFile(file, '{"ok":false}');
    assert.equal(await verifyOutput(receipt), false);
    await schedule(options, f.deps);
    assert.equal(f.calls, first + 1);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
