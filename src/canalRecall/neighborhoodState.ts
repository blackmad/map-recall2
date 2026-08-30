export interface NeighborhoodTransitionState {
  current: string;
  candidate: string;
  candidateSeconds: number;
}

export interface NeighborhoodTransition {
  state: NeighborhoodTransitionState;
  changed: boolean;
}

/**
 * Debounce overlapping or slightly mismatched OSM area boundaries.
 *
 * The detected area must remain stable before it becomes current. Returning to
 * the current area immediately cancels a pending transition, so a one-frame
 * polygon overlap cannot emit two entry cards.
 */
export function advanceNeighborhood(
  state: NeighborhoodTransitionState,
  detected: string,
  deltaSeconds: number,
  stableSeconds = 0.7,
): NeighborhoodTransition {
  if (detected === state.current) {
    return {
      state: { current: state.current, candidate: '', candidateSeconds: 0 },
      changed: false,
    };
  }

  if (detected !== state.candidate) {
    return {
      state: { current: state.current, candidate: detected, candidateSeconds: 0 },
      changed: false,
    };
  }

  const candidateSeconds = state.candidateSeconds + Math.max(0, deltaSeconds);
  if (candidateSeconds < stableSeconds - 1e-9) {
    return {
      state: { ...state, candidateSeconds },
      changed: false,
    };
  }

  return {
    state: { current: detected, candidate: '', candidateSeconds: 0 },
    changed: detected !== state.current,
  };
}
