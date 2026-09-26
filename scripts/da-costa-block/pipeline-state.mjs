/** Small atomic JSON transactions. Locks fail closed after a crashed writer. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

export const digest = value => crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
export const owner = () => ({ pid: process.pid, hostname: os.hostname() });
export function ownerIsAlive(value) {
  if (!value || value.hostname !== os.hostname() || !Number.isInteger(value.pid)) return true;
  try { process.kill(value.pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; }
}
export async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
}
export async function atomicJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const handle = await fs.open(temporary, 'wx');
  try { await handle.writeFile(JSON.stringify(value, null, 2)); await handle.sync(); }
  finally { await handle.close(); }
  await fs.rename(temporary, file);
}
export async function lockedJson(file, initial, change, { timeoutMs = 10000 } = {}) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const lockPath = `${file}.lock`, start = Date.now();
  let lock;
  while (!lock) {
    try { lock = await fs.open(lockPath, 'wx'); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      // Never delete a lock observed earlier: another process could have replaced it.
      if (Date.now() - start >= timeoutMs) throw Error(`State lock busy or abandoned; inspect before recovery: ${lockPath}`);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }
  try {
    await lock.writeFile(JSON.stringify({ ...owner(), startedAt: new Date().toISOString() }));
    const state = await readJson(file, structuredClone(initial));
    const result = await change(state);
    await atomicJson(file, state);
    return result;
  } finally { await lock.close(); await fs.unlink(lockPath); }
}
