/** Resumable DAG runner. Handlers must be idempotent; paid handlers reserve separately. */
import fs from 'node:fs/promises';
import { digest, lockedJson, owner, ownerIsAlive } from './pipeline-state.mjs';

export async function runPipeline({ file, areaId, jobs, concurrency = 4, signal }) {
  if (!areaId || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) throw Error('Invalid pipeline area or concurrency');
  const byId = new Map(jobs.map(job => [job.id, job]));
  if (byId.size !== jobs.length || jobs.some(job => !job.id || !job.version || typeof job.run !== 'function')) throw Error('Jobs need unique IDs, versions and handlers');
  const visit = (id, ancestors = []) => {
    if (!byId.has(id)) throw Error(`Missing dependency ${id}`);
    if (ancestors.includes(id)) throw Error(`Pipeline dependency cycle: ${[...ancestors, id].join(' -> ')}`);
    for (const dependency of byId.get(id).dependsOn ?? []) visit(dependency, [...ancestors, id]);
  };
  for (const id of byId.keys()) visit(id);
  const tx = change => lockedJson(file, { version: 1, areaId, jobs: {} }, state => {
    if (state.version !== 1 || state.areaId !== areaId) throw Error('Pipeline state belongs to a different area or version');
    return change(state);
  });
  const complete = new Map(), pending = new Set(byId.keys()), running = new Map();
  let failure;
  const execute = async job => {
    const dependencies = Object.fromEntries((job.dependsOn ?? []).map(id => [id, complete.get(id).output]));
    const inputKey = digest({ areaId, id: job.id, version: job.version, input: job.input ?? null, dependencies: (job.dependsOn ?? []).map(id => [id, complete.get(id).outputKey]) });
    const claimed = await tx(async state => {
      const prior = state.jobs[job.id];
      if (prior?.status === 'running' && ownerIsAlive(prior.owner)) throw Error(`Job is already running: ${job.id}`);
      if (prior?.status === 'complete' && prior.inputKey === inputKey) {
        let intact = true;
        for (const artifact of prior.artifacts ?? []) {
          try { if (digest(await fs.readFile(artifact.path)) !== artifact.sha256) intact = false; }
          catch (error) { if (error.code !== 'ENOENT') throw error; intact = false; }
        }
        if (intact && (!job.validate || await job.validate(prior.output))) return { cached: true, record: prior };
      }
      const attempt = (prior?.attempt ?? 0) + 1;
      state.jobs[job.id] = { inputKey, status: 'running', owner: owner(), attempt, startedAt: new Date().toISOString() };
      return { cached: false };
    });
    if (claimed.cached) return { ...claimed.record, cached: true };
    try {
      signal?.throwIfAborted();
      const result = await job.run({ dependencies, signal, inputKey });
      const output = result?.output ?? null, artifacts = [];
      for (const artifactPath of result?.artifacts ?? []) artifacts.push({ path: artifactPath, sha256: digest(await fs.readFile(artifactPath)) });
      const outputKey = digest({ output, artifacts });
      return await tx(state => {
        const record = state.jobs[job.id];
        Object.assign(record, { status: 'complete', output, artifacts, outputKey, completedAt: new Date().toISOString() });
        delete record.owner;
        return record;
      });
    } catch (error) {
      await tx(state => { Object.assign(state.jobs[job.id], { status: 'failed', error: String(error), completedAt: new Date().toISOString() }); delete state.jobs[job.id].owner; });
      throw error;
    }
  };
  while (pending.size || running.size) {
    if (signal?.aborted) failure ??= signal.reason ?? Error('Pipeline aborted');
    if (!failure) for (const id of pending) {
      if (running.size >= concurrency) break;
      const job = byId.get(id);
      if (!(job.dependsOn ?? []).every(dependency => complete.has(dependency))) continue;
      pending.delete(id);
      running.set(id, execute(job).then(record => complete.set(id, record)).catch(error => { failure ??= error; }).finally(() => running.delete(id)));
    }
    if (!running.size) break;
    await Promise.race(running.values());
  }
  if (failure) throw failure;
  return Object.fromEntries([...complete].map(([id, record]) => [id, { output: record.output, cached: Boolean(record.cached), outputKey: record.outputKey }]));
}
