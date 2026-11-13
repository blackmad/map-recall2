/**
 * Holds on installed ordinary GLBs (lane BA, belt audit, 2026-11-13).
 *
 * A held install keeps its catalogue entry and GLB (reversible, reviewable in the ordinary-buildings gallery) but is
 * out of ORDINARY_BUILDINGS, so the game does not draw it and, after build-covers, no longer hides its pand: the pand
 * draws through the generic mesher with its published house spec (route A). Data:
 * public/canal-drive/ordinary-buildings-data/held.json, written by scripts/building-recipes/hold-installs.ts.
 * Same idea as `status: 'held'` in the manual catalogue, kept in its own file so a re-install, which rewrites the
 * catalogue entry, cannot drop a hold.
 */
import heldFile from '../../../public/canal-drive/ordinary-buildings-data/held.json';

export interface OrdinaryHold {
  /** Why it is held, in words a reviewer can check (gate and metres, or the review that rejected it). */
  reason: string;
  /** ISO date the hold was written. */
  heldAt: string;
  /** Failing gate ids (install-audit: outside, intrusion, frontage, protrusion, crown), when the hold came from the audit. */
  gates?: string[];
  /** The publish batch the install came from. */
  batch?: string;
  by?: string;
}
export interface HeldFile { _doc?: string; held: Record<string, OrdinaryHold> }

/** Throws on a malformed hold: an id that is not `ordinary-<16-digit pand>`, an empty reason or a missing date. */
export function validateHolds(file: HeldFile): Record<string, OrdinaryHold> {
  if (!file || typeof file.held !== 'object') throw new Error('held.json: no "held" object');
  for (const [id, h] of Object.entries(file.held)) {
    if (!/^ordinary-\d{16}$/.test(id)) throw new Error(`held.json: ${id} is not an ordinary-<pand> id`);
    if (typeof h?.reason !== 'string' || !h.reason.trim()) throw new Error(`held.json: ${id} has no reason`);
    if (typeof h.heldAt !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(h.heldAt)) throw new Error(`held.json: ${id} has no heldAt date`);
  }
  return file.held;
}

export const ORDINARY_HOLDS: Readonly<Record<string, OrdinaryHold>> = validateHolds(heldFile as HeldFile);
export const isHeldOrdinary = (id: string): boolean => Object.prototype.hasOwnProperty.call(ORDINARY_HOLDS, id);
