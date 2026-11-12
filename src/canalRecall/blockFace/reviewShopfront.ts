/**
 * Reviewer shopfront pins for auto-placement (Haarlemmerbuurt, 2026-11-10).
 *
 * Auto-place paints a trading pand's shop in the fascia colour measured on the strip (autoPlace.ts autoShopfront) and
 * puts the shop door in the centre. On a dark strip the measured fascia is underexposure, not paint: the 2022-12-15
 * Haarlemmerdijk strip drew every shop dark brown where the strip-sheet review (docs/reports/haarlemmer-strip-verdict-20261110.md)
 * reads cream joinery with white pilasters on Haarlemmerdijk 4, 6 and 18, and the door of 6 on the right.
 * A reviewer pins `colour` (and optionally `entrance`) in `scripts/block-face/buurten/<buurt>-review-shopfronts.json`
 * ({pins: [{pandId, colour, entrance?, reason}]}). Only a placed pand with a shopfront ground is changed; no pins =
 * the decisions as they came (byte-identical). Pure.
 */
import type {Decision} from './autoPlace.ts';
import {SHOP_ENTRANCES} from '../buildingRecipe/intent.ts';

export interface ShopfrontPin {
  pandId: string;
  /** The shop joinery and fascia paint, `#rrggbb`. */
  colour: string;
  /** Where the shop door is, as on the strip. Absent = as placed. */
  entrance?: typeof SHOP_ENTRANCES[number];
  /** What on the strip shows it. */
  reason: string;
}

export function shopfrontPinProblems(pins: ShopfrontPin[]): string[] {
  const p: string[] = [];
  pins.forEach((pin, k) => {
    const at = `shopfront pin ${k}`;
    if (!/^\d{16}$/.test(pin.pandId ?? '')) p.push(`${at}: pandId must be a 16-digit BAG pand id`);
    if (!/^#[0-9a-f]{6}$/i.test(pin.colour ?? '')) p.push(`${at}: colour must be #rrggbb`);
    if (pin.entrance !== undefined && !(SHOP_ENTRANCES as readonly string[]).includes(pin.entrance)) p.push(`${at}: entrance must be one of ${SHOP_ENTRANCES.join(', ')}`);
    if (!pin.reason) p.push(`${at}: reason required (what on the strip shows the shop)`);
    if (pins.findIndex(x => x.pandId === pin.pandId) !== k) p.push(`${at}: pand ${pin.pandId} pinned twice`);
  });
  return p;
}

/** Apply the pins (in place) to placed pands with a shopfront ground. Returns the pands changed. */
export function applyShopfrontPins(decisions: Decision[], pins: ShopfrontPin[]): string[] {
  const changed: string[] = [];
  for (const d of decisions) {
    if (d.kind !== 'placed') continue;
    const pin = pins.find(x => x.pandId === d.pandId), ground = d.house.type?.ground;
    if (!pin || !ground || typeof ground !== 'object' || !('shopfront' in ground) || !ground.shopfront) continue;
    const sf = ground.shopfront;
    sf.colour = pin.colour;
    if (pin.entrance) sf.entrance = pin.entrance;
    sf.evidence = `${sf.evidence ? `${sf.evidence}; ` : ''}reviewer pin: ${pin.reason}`;
    d.notes = [...d.notes, `shopfront ${pin.colour}${pin.entrance ? ` door ${pin.entrance}` : ''}: reviewer pin`];
    changed.push(d.pandId);
  }
  return changed;
}
