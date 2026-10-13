/** Block kit input/output types. Local metres: X east, Z south, Y up above the 3DBAG ground level. */
export type P3 = [number, number, number];
export type Ring3 = P3[];
export interface SurfaceSet {
  pandId: string;
  anchor: [number, number];
  groundNap: number;
  heightMax: number;
  constructionYear: number | null;
  walls: { rings: Ring3[]; onFootprintEdge: boolean }[];
  roofs: { rings: Ring3[]; slopeDeg: number }[];
  ground: { rings: Ring3[] }[];
  neighbours: { id: string; height: number; ring: [number, number][] }[];
}
