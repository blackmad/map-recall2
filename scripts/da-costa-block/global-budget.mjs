/** One cumulative journal across area roots; local spend.json remains compatible. */
import path from 'node:path';
import { digest, lockedJson, owner, ownerIsAlive, readJson } from './pipeline-state.mjs';

export const DEFAULT_BUDGET_LEDGER = '.cache/city-appearance/spend.json';
export const LEGACY_BUDGET_LEDGER = '.cache/da-costa-neighbourhood/spend.json';
const validCost = value => Number.isFinite(value) && value >= 0;
const total = state => state.entries.reduce((sum, entry) => sum + (validCost(entry.actualUsd) ? entry.actualUsd : entry.reservedUsd), 0);

export function globalBudget({ file = DEFAULT_BUDGET_LEDGER, ceiling = 5, legacyLedgers = [LEGACY_BUDGET_LEDGER] } = {}) {
  if (!Number.isFinite(ceiling) || ceiling <= 0 || ceiling > 5) throw Error('Budget ceiling must be positive and no greater than the authorized $5');
  file = path.resolve(file);
  const transaction = async change => lockedJson(file, { version: 1, entries: [] }, async state => {
    if (state.version !== 1 || !Array.isArray(state.entries)) throw Error('Unsupported global budget journal');
    for (const legacyPath of [...new Set(legacyLedgers.map(p => path.resolve(p)))]) {
      if (legacyPath === file) throw Error('Global journal must not overwrite a legacy spend ledger');
      const legacy = await readJson(legacyPath, { results: [] });
      if (!Array.isArray(legacy.results)) throw Error(`Invalid legacy spend ledger: ${legacyPath}`);
      if (legacy.results.some(result => typeof result.key !== 'string' || !result.key) || new Set(legacy.results.map(result => result.key)).size !== legacy.results.length) throw Error(`Missing or duplicate request keys in legacy spend ledger: ${legacyPath}`);
      for (const result of legacy.results) {
        if (result.globalReservationId) {
          const existing = state.entries.find(entry => entry.id === result.globalReservationId);
          if (!existing) throw Error('Missing global reservation referenced by local ledger; reconcile before spending');
          // The compatibility ledger is saved before settlement. Recover that crash
          // window from an actual provider charge, never from an assumed zero cost.
          if (existing.status !== 'settled' && validCost(result.usage?.cost)) {
            existing.actualUsd = result.usage.cost; existing.status = 'settled';
            existing.generationId = result.generationId;
          }
          continue;
        }
        const id = `legacy:${digest([legacyPath, result.key])}`;
        let entry = state.entries.find(value => value.id === id);
        const actualUsd = validCost(result.usage?.cost) ? result.usage.cost : undefined;
        if (actualUsd === undefined && !validCost(result.reservedUsd)) throw Error(`Invalid or unbounded legacy charge: ${result.key}`);
        if (entry?.status === 'settled' && entry.actualUsd !== actualUsd) throw Error(`Previously recorded legacy charge changed; explicit reconciliation required: ${result.key}`);
        const update = { id, key: result.key, sourceLedger: legacyPath, status: actualUsd === undefined ? 'unknown' : 'settled', reservedUsd: actualUsd ?? result.reservedUsd, actualUsd };
        if (entry) Object.assign(entry, update); else state.entries.push(update);
      }
    }
    for (const entry of state.entries) {
      if (!validCost(entry.reservedUsd) || (entry.actualUsd !== undefined && !validCost(entry.actualUsd))) throw Error('Invalid charge in global journal');
      if (!['pending', 'unknown', 'settled'].includes(entry.status) || (entry.status === 'settled' && !validCost(entry.actualUsd))) throw Error('Invalid reservation state in global journal');
      if (entry.status === 'pending' && !ownerIsAlive(entry.owner)) entry.status = 'unknown';
    }
    if (new Set(state.entries.map(entry => entry.id)).size !== state.entries.length) throw Error('Duplicate reservations in global journal');
    state.ceilingUsd = ceiling;
    const result = await change(state);
    state.observedOrReservedCostUsd = total(state);
    state.updatedAt = new Date().toISOString();
    return result;
  });
  const assertResolved = state => {
    if (state.entries.some(entry => entry.status === 'unknown')) throw Error('Unresolved previous charge in global budget; reconcile before more calls');
  };
  return {
    file,
    snapshot: () => transaction(state => ({ ...structuredClone(state), observedOrReservedCostUsd: total(state) })),
    assertReady: () => transaction(state => { assertResolved(state); return total(state); }),
    reserve: ({ key, sourceLedger, reservedUsd, metadata = {} }) => transaction(state => {
      assertResolved(state);
      if (!key || !sourceLedger || !Number.isFinite(reservedUsd) || reservedUsd <= 0) throw Error('Invalid reservation');
      const id = `request:${digest([path.resolve(sourceLedger), key])}`;
      if (state.entries.some(entry => entry.id === id)) throw Error('Request already reserved globally; reconcile or reuse its local result');
      if (total(state) + reservedUsd > ceiling + 1e-12) throw Error('Global spend reservation exceeds ceiling');
      state.entries.push({ ...metadata, id, key, sourceLedger: path.resolve(sourceLedger), reservedUsd, status: 'pending', owner: owner(), startedAt: new Date().toISOString() });
      return id;
    }),
    settle: (id, actualUsd, metadata = {}) => transaction(state => {
      const entry = state.entries.find(value => value.id === id);
      if (!entry) throw Error('Unknown reservation');
      if (entry.status === 'settled') {
        if (!validCost(actualUsd) || actualUsd !== entry.actualUsd) throw Error('Settlement does not match recorded charge');
        return { totalUsd: total(state), exceededCeiling: total(state) > ceiling };
      }
      entry.status = validCost(actualUsd) ? 'settled' : 'unknown';
      entry.actualUsd = validCost(actualUsd) ? actualUsd : undefined;
      entry.completedAt = new Date().toISOString();
      entry.generationId = metadata.generationId;
      // An unexpectedly expensive response is recorded in full, never rounded to its reservation.
      return { totalUsd: total(state), exceededCeiling: total(state) > ceiling };
    }),
  };
}
