// Places where the AHN DTM measured a building site that has since been paved over (pure data, no DOM).
//
// AHN4 flew Amsterdam while Stationsplein was being rebuilt for the bike garage under the Open Havenfront
// (opened 2023): its DTM has the excavation, 2 m under today's square, and the 2 m field drew it as a sunken
// patch with pale outlines in the paving (issue #53). build-ground-height.ts blanks these rings before its hole
// fill, so the field carries today's pavement level over them from their rims. Add a ring only with the evidence
// (the orthophoto shows paving where the DTM is sunken) and say where it came from.
//
// The same blanking serves a raised structure a landmark model draws itself: the DTM keeps a broad outdoor stair as
// ground, and the 2 m field smooths it into a soft hump that swallows the modelled treads (EYE, feedback d1423818).

export interface StaleRelief {
  id: string;
  label: string;
  /** Why the DTM is wrong here, with the evidence. */
  evidence: string;
  /** Ring in RD New (EPSG:28992) metres. */
  rd: [number, number][];
  /**
   * Today's ground inside the ring, m NAP, when a hole would fill wrongly: a site beside water fills from the water
   * side (the hole's rim is half canal), so it is set to the street level measured around it instead.
   */
  levelNAP?: number;
}

export const STALE_RELIEF: readonly StaleRelief[] = [
  {
    id: 'stationsplein-west-garage-works',
    label: 'Stationsplein west, by the Open Havenfront (bike-garage works)',
    evidence: 'AHN dtm_05m 1.0 m NAP over a 45 × 60 m block reaching the quay (with the shaft on its south side), the square around it 2.8–3.3 m NAP; the PDOK 8 cm orthophoto shows level paving and tram tracks there',
    rd: [[121752, 487930], [121775, 487943], [121795, 487938], [121800, 487893], [121781, 487879], [121752, 487886]],
  },
  {
    // Feedback a524acc9 (2026-10-25, from the NDSM ferry): "bumpy ground swallowing that building". The 3DBAG/BAG
    // pands here (0363100012252793/95/96/97/98, bouwjaar 2025) are 7-10 storey blocks on a parking plinth.
    id: 'ndsm-oost-buiksloterham-kop-works',
    label: 'Buiksloterham, the NDSM-oost block west of the Johan van Hasseltkanaal (2021-2025 building site)',
    evidence: 'AHN dtm_05m 1.5-3.3 m NAP sand fill and spoil heaps over a 130 x 150 m block (relief +1.5 to +3 m over the road and quay around it); Gemeente Amsterdam panoramas 2021-01-22 / 2021-02-17 show sand heaps, cranes and an excavator there, 2025-06-30 (TMX recordings at 4.8978,52.3934) the finished blocks on level paving at street level; the PDOK orthophoto shows the blocks, courtyards and paved streets',
    // Set, not blanked: half its rim is the IJ and the canal. 1.11 m NAP is the median relief 8 m outside the ring on
    // land (scene -0.26 m; quartiles -0.39 / -0.10), the street and quay level the 2025 panoramas show the blocks on.
    levelNAP: 1.11,
    rd: [[121618, 489708], [121628, 489710], [121672, 489690], [121712, 489684], [121722, 489664], [121746, 489630], [121746, 489595], [121736, 489574], [121712, 489556], [121690, 489550], [121670, 489554], [121638, 489568], [121624, 489584], [121614, 489620], [121614, 489672]],
  },
  {
    id: 'eye-filmmuseum-stair',
    label: 'EYE Filmmuseum, the outdoor stair from the IJ promenade up to the terrace (modelled by the eye-filmmuseum landmark)',
    evidence: 'AHN dtm_05m measures the stair as ground, 0.2 m to 3.0 m over the plaza along the mapped stair (OSM w1207014127, BAG 0363100012237838 level 0); the 2 m field smoothed it into a hump 2 m beyond the treads that buried the modelled steps. The ring is the stair outline (convex hull) grown 3 m.',
    rd: [[121911.5, 488583.9], [121912.4, 488586], [121918.3, 488592.1], [121920.4, 488593], [121923.2, 488592], [121928, 488590.4], [121930.1, 488589.5], [121945.7, 488556.7], [121946.6, 488554.5], [121945.7, 488552.4], [121944.1, 488551.3], [121942, 488550.4], [121934.4, 488553.5], [121932.3, 488554.4], [121912.4, 488581.7]],
  },
];
