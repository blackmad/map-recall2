// One palette for the whole product.
//
// Canal Recall had grown three visual languages that never met: the route
// briefing was a warm paper map sheet, the in-game DOM chrome (settings, help,
// the recall prompt) was dark navy with a sky-blue accent, and the trivia card
// was dark with gold — while the canvas HUD cards were hand-coded cream hexes
// that happened to be a fourth near-match for the paper sheet. The root
// map-quest app is a fifth, in warm paper and moss.
//
// The paper language already had the majority, so it wins, and these are the
// root app's own tokens (`src/index.css`) rather than a new set that would have
// to be reconciled again later. Canvas drawing reads the hexes from here and
// the stylesheet reads the same values as custom properties, so the two
// surfaces cannot drift.

export const paperTheme = {
  /** Card surfaces. `raised` is for anything you read; `paper` for chrome. */
  paper: '#f8f5ee',
  paperRaised: '#fffdf8',
  paperMuted: '#eee9df',
  ink: '#24322b',
  inkMuted: '#68746e',
  line: '#d8d2c6',
  moss: '#356653',
  mossDark: '#264b3d',
  mossSoft: '#dce8e1',
  terracotta: '#c75f43',
  ochre: '#b78125',
} as const;

export type PaperTheme = typeof paperTheme;

/** Card fills carry alpha so the map stays legible underneath. A HUD card that
 *  is fully opaque hides the corridor it is supposed to be annotating. */
export const hudSurface = {
  /** Always-on readouts sitting directly on the map. */
  card: 'rgba(255,253,248,0.93)',
  /** Cards you stop and read: the trivia card, the postcard. */
  cardSolid: 'rgba(255,253,248,0.97)',
  /** Hairline border. Paper needs an edge or it dissolves into a pale map. */
  border: 'rgba(97,89,74,0.22)',
  borderStrong: 'rgba(97,89,74,0.34)',
  /** Drop shadow under a card that floats over the map. */
  shadow: 'rgba(58,50,36,0.16)',
  /** The d-pad, which sits over the map and must not hide it. */
  control: 'rgba(255,253,248,0.82)',
  controlPressed: 'rgba(53,102,83,0.90)',
  controlInk: 'rgba(36,50,43,0.72)',
} as const;

export const hudRadius = { card: 12, chip: 9, control: 18 } as const;

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
  };
}
