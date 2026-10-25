// Places where the AHN DTM measured a building site that has since been paved over (pure data, no DOM).
//
// AHN4 flew Amsterdam while Stationsplein was being rebuilt for the bike garage under the Open Havenfront
// (opened 2023): its DTM has the excavation, 2 m under today's square, and the 2 m field drew it as a sunken
// patch with pale outlines in the paving (issue #53). build-ground-height.ts blanks these rings before its hole
// fill, so the field carries today's pavement level over them from their rims. Add a ring only with the evidence
// (the orthophoto shows paving where the DTM is sunken) and say where it came from.

export interface StaleRelief {
  id: string;
  label: string;
  /** Why the DTM is wrong here, with the evidence. */
  evidence: string;
  /** Ring in RD New (EPSG:28992) metres. */
  rd: [number, number][];
}

export const STALE_RELIEF: readonly StaleRelief[] = [
  {
    id: 'stationsplein-west-garage-works',
    label: 'Stationsplein west, by the Open Havenfront (bike-garage works)',
    evidence: 'AHN dtm_05m 1.0 m NAP over a 45 × 60 m block reaching the quay (with the shaft on its south side), the square around it 2.8–3.3 m NAP; the PDOK 8 cm orthophoto shows level paving and tram tracks there',
    rd: [[121752, 487930], [121775, 487943], [121795, 487938], [121800, 487893], [121781, 487879], [121752, 487886]],
  },
];
