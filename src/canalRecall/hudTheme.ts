// One palette for the whole product: enamel street-plaque chrome.
//
// Route setup, settings/help panels, Map Quest dialogs, and the canvas HUD
// share these values. Floating HUD cards stay translucent so the driving
// corridor remains visible underneath.
//
// Export names (`paperTheme`, `paperCssVariables`) are historical; callers
// keep working while the values moved to cobalt enamel + rivet accents.

export const paperTheme = {
  /** Card / plaque fills. `raised` is brighter enamel for emphasis. */
  paper: '#0b3a8c',
  paperRaised: '#1450b8',
  paperMuted: '#072861',
  ink: '#ffffff',
  inkMuted: 'rgba(255,255,255,0.72)',
  line: 'rgba(255,255,255,0.28)',
  /** Selection / primary fill (bright enamel). */
  moss: '#1450b8',
  mossDark: '#072861',
  mossSoft: 'rgba(20,80,184,0.28)',
  /** Copper stamp accent (Start route / primary CTA). */
  terracotta: '#b87333',
  /** Rivet / gold accent. */
  ochre: '#c4a35a',
} as const;

export type PaperTheme = typeof paperTheme;

/** Card fills carry alpha so the map stays legible underneath. A HUD card that
 *  is fully opaque hides the corridor it is supposed to be annotating.
 *
 *  The in-drive HUD is deep navy, not cobalt: the basemap is mostly water and
 *  cobalt cards over blue canals read as blue-on-blue. Cobalt stays on the
 *  surfaces you stop at (setup, prompt, panels); the readouts over the map get
 *  the dark plate, white type and one gold accent. */
export const hudSurface = {
  /** Always-on readouts sitting directly on the map. */
  card: 'rgba(7,20,48,0.84)',
  /** Cards you stop and read: the trivia card, the postcard. */
  cardSolid: 'rgba(7,20,48,0.94)',
  /** Hairline border. */
  border: 'rgba(255,255,255,0.22)',
  borderStrong: 'rgba(196,163,90,0.65)',
  /** Drop shadow under a card that floats over the map. */
  shadow: 'rgba(4,12,28,0.45)',
  /** The d-pad, which sits over the map and must not hide it. */
  control: 'rgba(7,20,48,0.72)',
  controlPressed: 'rgba(196,163,90,0.92)',
  controlInk: 'rgba(255,255,255,0.88)',
  /** Type on the navy plate. */
  ink: '#ffffff',
  inkMuted: 'rgba(255,255,255,0.68)',
  accent: '#c4a35a',
  /** Only the finish arrow is copper, so it reads as "go there". */
  arrow: '#d08a4a',
  /** Canvas fonts. The plaque face is the condensed grotesk the setup rail
   *  already loads; numbers stay monospaced so they do not jitter. */
  fontPlaque: '"Barlow Condensed", "Arial Narrow", "Helvetica Neue Condensed", sans-serif',
  fontMono: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
  fontUi: 'system-ui, -apple-system, "Segoe UI", sans-serif',
} as const;

export const hudRadius = { card: 8, chip: 6, control: 14 } as const;

/** Emitted into the page as custom properties so CSS and canvas share values. */
export function paperCssVariables(): Record<string, string> {
  return {
    '--paper': paperTheme.paper,
    '--paper-raised': paperTheme.paperRaised,
    '--paper-muted': paperTheme.paperMuted,
    '--ink': paperTheme.ink,
    '--ink-muted': paperTheme.inkMuted,
    '--line': paperTheme.line,
    '--moss': paperTheme.moss,
    '--moss-dark': paperTheme.mossDark,
    '--moss-soft': paperTheme.mossSoft,
    '--terracotta': paperTheme.terracotta,
    '--ochre': paperTheme.ochre,
    '--enamel': paperTheme.paper,
    '--enamel-bright': paperTheme.paperRaised,
    '--enamel-deep': paperTheme.paperMuted,
    '--enamel-ink': paperTheme.ink,
    '--rivet': paperTheme.ochre,
    '--enamel-copper': paperTheme.terracotta,
  };
}
