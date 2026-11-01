/** Game states whose canvas covers the map with paper (game.js GameState: MENU 0, MAP_SELECT 1, LOADING 2). */
export function isCoveredState(state: unknown): boolean {
  const gs = (0, eval)('typeof GameState === "object" ? GameState : null') as Record<string, number> | null;
  const covered = gs ? [gs.MENU, gs.MAP_SELECT, gs.LOADING] : [0, 1, 2];
  return typeof state === 'number' && covered.includes(state);
}

/** How often a label layer re-checks the game state when nothing repaints (a state change need not move the map). */
export const COVER_POLL_MS = 150;
