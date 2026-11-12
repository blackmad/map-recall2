// Named ground-defect locations (lane G0 of the Ground v2 plan, 2026-11-10): the places the user's shots of build 93440cb
// showed torn, shard-ridden or wrongly walled ground. Positions are WGS84 on OSM ways the lane read from the published
// own-ground-osm-v1 cells (the way named is the one the position lies on). The audit (scripts/own-ground/audit-ground.ts)
// must rank every one of them in the top 50 of the city; G1 and G2 pin each in check-ground-cells.ts / check:tunnels.

export interface GroundSpot {
  id: string;
  /** What the user saw (plan table). */
  what: string;
  lng: number; lat: number;
  /** The own-ground cell (elevation-v1 key) of the position. */
  cell: string;
  /** The OSM way the position lies on, and the user's shot of it. */
  way: string;
}

export const GROUND_SPOTS: readonly GroundSpot[] = [
  { id: 'piet-kranenbergpad', what: 'ground torn into shards under the ring and Schiphol rail decks; the red cycle path smeared into wedges', lng: 4.85089, lat: 52.34442, cell: '-4_-3', way: 'Piet Kranenbergpad (cycleway)' },
  { id: 'amstelveenseweg-viaduct', what: 'shards remain under the viaduct', lng: 4.85748, lat: 52.3421, cell: '-3_-4', way: 'Amstelveenseweg (secondary, bridge)' },
  { id: 'schinkel-jachthavenweg', what: 'shards on the Schinkel bank; a sand field with a cycle path dead-ending in it', lng: 4.85369, lat: 52.33664, cell: '-4_-4', way: 'Jachthavenweg (residential)' },
  { id: 'overschiestraat', what: 'a black tunnel-portal box standing on grass; three overlapping slots (road, cycleway, footway)', lng: 4.841, lat: 52.34335, cell: '-4_-3', way: 'Overschiestraat (tertiary, tunnel)' },
  { id: 'sportparklaan', what: 'curved wall stubs and crumpled cutting slopes', lng: 4.83954, lat: 52.34395, cell: '-5_-3', way: 'Sportparklaan (unclassified)' },
  { id: 'anthony-fokkerweg', what: 'portal box and crumpled slopes beside the motorway cut', lng: 4.84208, lat: 52.3451, cell: '-4_-3', way: 'Anthony Fokkerweg (tertiary)' },
  { id: 'vlaardingenlaan-naaldwijkstraat', what: 'flat ground: scraps of asphalt, pavement and grass poking through each other', lng: 4.84598, lat: 52.34685, cell: '-4_-3', way: 'Vlaardingenlaan (tertiary) / Naaldwijkstraat (residential)' },
  { id: 'lelylaan-delflandlaan', what: 'the near ground is the far-distance texture and blurs when zoomed in (coverage, not shards)', lng: 4.84085, lat: 52.35716, cell: '-5_-2', way: 'Delflandlaan (pedestrian) by Cornelis Lelylaan (secondary)' },
  { id: 'radarweg-south-abutment', what: 'the road bridge over the Sloterdijk rail yard: the south abutment end of the Radarweg bridge way (a1 rails lane feedback #16; the deck saddle)', lng: 4.83455, lat: 52.38484, cell: '-5_1', way: 'Radarweg (tertiary, bridge, way 37833012, south end)' },
];

/** Radius around a spot over which the A/B sums its defects, metres. */
export const GROUND_SPOT_RADIUS_M = 150;
