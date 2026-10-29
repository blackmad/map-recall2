/**
 * Paved links: open paving that joins a cycle path to the network where the
 * routing extract leaves a gap, ridden like a square (pedestrianAreas.ts).
 *
 * The extract keeps cycleways but not footways, so a cycle path whose only
 * connection is a sidewalk dead-ends a few metres from the street it visibly
 * meets, and the bike is blocked on paving the ground layer draws as open.
 * Each link is a ring traced from OSM nodes (the street edge, the quay edge,
 * the wall), so it stays explainable and reviewable; add one per reported gap
 * with its feedback id and a named regression in scripts/check-canal-car.ts.
 */
import type { PlazaFeature } from './pedestrianAreas.ts';

export const PAVED_LINKS: readonly PlazaFeature[] = [
  {
    // Feedback 3e7f0aa4 (2026-10-25): "I should probably be able to bike to
    // this red path but I'm blocked", by the Odebrug. The cycle bridge Brug 228
    // (OSM way 1168346867) over the Oosterdok inlet lands on a 1 m cycleway
    // stub (1168346869) that meets only the quay sidewalks 1156115657 and
    // 1156115659 and two steps (1156115658) at the end of a low wall
    // (1156115620). The bike stood on the paving between the busway
    // (1071670642) and the quay, 20 m from the stub. The ring follows the
    // busway's south edge, the quay edge (water 376762528), the bridge
    // landing, the lower sidewalk and the wall; it takes in the last 5 m of
    // the wall beside the steps so the passage is wider than the plaza inset.
    name: 'Brug 228 landing, Oosterdok',
    path: [
      [52.3773224, 4.9029897], [52.3773367, 4.9031317], [52.3773674, 4.9032464], [52.3774118, 4.9033404],
      [52.3774556, 4.9034031], [52.3773879, 4.9035002], [52.3773704, 4.9035113], [52.3771433, 4.9032929],
      [52.3771233, 4.9032732], [52.3770935, 4.9032446], [52.3771054, 4.9031961], [52.3771467, 4.9032344],
      [52.3771785, 4.9031998], [52.3771899, 4.9031675], [52.3772026, 4.9031284], [52.3772141, 4.9030922],
      [52.3772254, 4.9030516], [52.3772364, 4.9030109], [52.3773224, 4.9029897],
    ],
  },
];
