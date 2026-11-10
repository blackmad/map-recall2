/**
 * One way to print a ride length (#301). The landing's daily-ride line and the
 * phone's "learning near home" pill used to disagree ("about 2.1 km" vs
 * "~2.1 km"); both come through here now.
 *
 * Rules: under 10 km one decimal ("0.9 km", "1.0 km", "9.9 km"); from 10 km
 * whole kilometres ("12 km"), because a tenth of a kilometre on a cross-town
 * ride is false precision. A measured route length prints bare; a straight-line
 * estimate gets the `about` word. Pure and import-free so the landing bundle
 * (80 kB cap) stays small; callers with a catalogue pass the localised word.
 */
export interface RideDistanceOptions {
  /** True when `km` is the route's real length: no "about". */
  routed?: boolean;
  /** The localised "about" ("ongeveer" in Dutch). */
  aboutWord?: string;
}

export function formatRideDistance(km: number, options: RideDistanceOptions = {}): string {
  const safe = Number.isFinite(km) && km > 0 ? km : 0;
  // Round once, then choose the precision from the rounded value, so 9.96 prints "10 km", not "10.0 km".
  const tenths = Math.round(safe * 10) / 10;
  const text = tenths >= 10 ? String(Math.round(safe)) : tenths.toFixed(1);
  const prefix = options.routed ? '' : `${options.aboutWord ?? 'about'} `;
  return `${prefix}${text} km`;
}
