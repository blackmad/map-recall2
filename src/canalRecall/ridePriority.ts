/**
 * Where players ride (memory buurt-priority-by-ride, user 2026-10-26): stadsdeel Centrum (its two gebieden) plus the inner-ring gebieden.
 * Coverage reports and queues weigh a pand inside these gebieden above one outside (house line: build-house-specs.ts
 * coverage, the kit-gap queue). Moved from scripts/register-facts/build-monument-facts.ts (2026-11-10, house line H1).
 */
export const RIDE_PRIORITY_GEBIEDEN: ReadonlySet<string> = new Set(['Centrum-West', 'Centrum-Oost', 'Oud-West, De Baarsjes', 'Westerpark', 'Oud-Zuid', 'De Pijp, Rivierenbuurt', 'Oud-Oost']);

/** True for a buurt (coverage-v1/buurten.json properties) inside the ride-priority area. */
export const isRidePriority = (buurt: { gebied?: string } | null | undefined): boolean => !!buurt?.gebied && RIDE_PRIORITY_GEBIEDEN.has(buurt.gebied);
