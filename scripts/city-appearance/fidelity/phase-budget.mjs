import path from 'node:path';
import { digest, lockedJson } from '../../da-costa-block/pipeline-state.mjs';

const cost = entry => Number.isFinite(entry.actualUsd) ? entry.actualUsd : entry.reservedUsd;

export function phaseBudget({ file, limits }) {
  file = path.resolve(file);
  const transaction = change => lockedJson(file, { version: 1, entries: [] }, state => {
    if (state.version !== 1 || !Array.isArray(state.entries)) throw Error('Unsupported phase budget journal');
    if (state.entries.some(entry => !['reserved', 'settled', 'void'].includes(entry.status) || !Number.isFinite(entry.reservedUsd) || entry.reservedUsd < 0)) throw Error('Invalid phase reservation');
    return change(state);
  });
  return {
    snapshot: () => transaction(state => ({ ...structuredClone(state), totals: Object.fromEntries(Object.keys(limits).map(phase => [phase, state.entries.filter(entry => entry.phase === phase && entry.status !== 'void').reduce((sum, entry) => sum + cost(entry), 0)])) })),
    reserve: ({ phase, key, reservedUsd }) => transaction(state => {
      if (!Number.isFinite(limits[phase]) || !key || !Number.isFinite(reservedUsd) || reservedUsd <= 0) throw Error('Invalid phase budget reservation');
      const id = `phase:${digest([file, phase, key])}`;
      const existing = state.entries.find(entry => entry.id === id);
      if (existing) throw Error('Analysis already reserved in phase journal; recover it without resubmitting');
      const observed = state.entries.filter(entry => entry.phase === phase && entry.status !== 'void').reduce((sum, entry) => sum + cost(entry), 0);
      if (observed + reservedUsd > limits[phase] + 1e-12) throw Error(`Phase budget exhausted: ${phase}`);
      state.entries.push({ id, phase, key, reservedUsd, status: 'reserved', startedAt: new Date().toISOString() });
      return id;
    }),
    settle: (id, actualUsd) => transaction(state => {
      const entry = state.entries.find(value => value.id === id);
      if (!entry) throw Error('Unknown phase reservation');
      if (!Number.isFinite(actualUsd) || actualUsd < 0) throw Error('Cannot settle an unresolved charge');
      if (entry.status === 'settled' && entry.actualUsd !== actualUsd) throw Error('Phase settlement changed');
      if (entry.status === 'void') throw Error('Cannot settle a void reservation');
      entry.status = 'settled'; entry.actualUsd = actualUsd; entry.completedAt = new Date().toISOString();
      const phaseTotalUsd = state.entries.filter(value => value.phase === entry.phase && value.status !== 'void').reduce((sum, value) => sum + cost(value), 0);
      return { entry: structuredClone(entry), phaseTotalUsd, exceededCeiling: phaseTotalUsd > limits[entry.phase] + 1e-12 };
    }),
    void: id => transaction(state => {
      const entry = state.entries.find(value => value.id === id);
      if (!entry || entry.status !== 'reserved') throw Error('Only an unused reservation can be voided');
      entry.status = 'void'; entry.completedAt = new Date().toISOString();
    }),
  };
}
