/**
 * Installed ordinary buildings whose walls are blank (lane R5-D, #264).
 *
 * The user's 2026-11-08 aerial shots asked "why is this building shaded flat?" of two installed large-recipe GLBs
 * (ordinary-buildings catalogue): Van Oldenbarneveldtstraat 48-56 drew 58 windows on 340 m of seven-storey wall in one
 * flat buff, and the Van der Palmkade 191 serpentine block 68 on 600 m in one dark brown. The install hides the
 * generic facade (covers.json), so the building read as a bare box from every distance while its neighbours showed
 * their window grids. `scripts/large-tier/install-glazing.ts` measures every non-instanced install's glass against its
 * wall area; an install under BLANK_INSTALL_MAX_GLASS_SHARE yields to the generic facade (a wrong model is worse than
 * the plain facade: LANE-RULES). Only installs a user shot or review confirmed are listed: textured installs carry their
 * windows in the texture and measure 0 glass (install-glazing.ts lists 62 under the threshold, most of them fine).
 * `?bareFronts=0` draws them again. Each entry carries its measured share.
 */

/** Glass under this share of the wall area (glass + wall faces) is a blank install. A punched-window housing block
 *  measures 0.15-0.30 in the catalogue, a ribbon or curtain front more; a church nave or a windowless hall is not in it. */
export const BLANK_INSTALL_MAX_GLASS_SHARE = 0.06;

/** Catalogue id -> measured glass share (install-glazing.ts, 2026-11-08). */
export const BLANK_INSTALLS: Readonly<Record<string, number>> = {
  // Van Oldenbarneveldtstraat 48-56 (2006, 7 storeys): 58 windows on 340 m of wall, one flat buff (#d2a96a). User shot 1.
  'ordinary-0363100012137990': 0.034,
  // Van der Palmkade 191 / Van Hallstraat serpentine block with two round towers (2001): 68 windows on 600 m. User shot 2.
  'ordinary-0363100012120309': 0.01,
  // Rijksakademie, Sarphatistraat 470 courtyard ranges between Mauritskade and the barracks: the user's "behind Plantage
  // Muidergracht" flat brown complex (shot 3); 296 m2 of glass on 9,259 m2 of wall.
  'ordinary-0363100012165748': 0.031,
  // Balboaplein 48, Bos en Lommer (2004 perimeter block): the audit ride (2026-11-09) shows one flat orange-red box with
  // no window grid from the air, where the generic facade draws its brick grid; 451 m2 of glass on 9,097 m2 of wall.
  'ordinary-0363100012147097': 0.047,
  // Revaleiland 437, Java-eiland (courtyard block): the audit ride shows a flat red box, generic draws the brick grid;
  // 497 m2 of glass on 8,239 m2 of wall.
  'ordinary-0363100012250186': 0.057,
};

/** `?bareFronts=0` (or window.__canalRecallBareFronts = false) restores today's draw. Off outside a browser: Node scripts
 * (coverage, content stats, recipe tiles, the gallery) keep counting and compiling the installs byte-identically. */
export function bareFrontsEnabled(search: string = typeof location !== 'undefined' ? location.search : '', w: any = typeof window !== 'undefined' ? window : null): boolean {
  if (!w) return false;
  try { const v = new URLSearchParams(search).get('bareFronts'); if (v !== null) return !(v === '0' || v === 'off' || v === 'false'); } catch { /* no URLSearchParams */ }
  return w.__canalRecallBareFronts !== false;
}

/** `?blankInstall=<id>[,<id>...]` forces further catalogue installs blank while the flag is on: the audit lane's hook
 * (#264, tests/e2e/bare-fronts-shots.spec.ts) for judging an install against the generic facade at the same pose.
 * Absent, the set is empty and the draw is unchanged. */
export function forcedBlankInstalls(search: string = typeof location !== 'undefined' ? location.search : ''): ReadonlySet<string> {
  try { const v = new URLSearchParams(search).get('blankInstall'); if (v) return new Set(v.split(',').map(s => s.trim()).filter(Boolean)); } catch { /* no URLSearchParams */ }
  return new Set();
}

/** Whether the install draws: false for a measured (or `?blankInstall=` forced) blank install while the flag is on. */
export const installDraws = (id: string, enabled: boolean = bareFrontsEnabled(), forced: ReadonlySet<string> = forcedBlankInstalls()): boolean =>
  !(enabled && (id in BLANK_INSTALLS || forced.has(id)));
