/** Street art the game could take a phone LiDAR scan of (/scan.html). Pure; see scripts/scan-finder. */
export interface ArtPoint { id: string; name: string; lng: number; lat: number; k: string; a?: string; y?: string; u?: string; i?: string; t?: string }
export interface ModelPoint { id: string; name: string; lng: number; lat: number }
export interface ScanTarget {
  id: string; name: string; k: string; lng: number; lat: number;
  a?: string; y?: string; u?: string; i?: string;
  /** Already modelled: the model's id. */
  m?: string;
}

/** Murals are flat: a photo, not a scan. */
export const SCANNABLE_KINDS = new Set(['statue', 'sculpture', 'monument', 'memorial', 'fountain', 'installation', 'artwork', 'relief']);
export const MODELLED_METRES = 25;

export function metres(aLng: number, aLat: number, bLng: number, bLat: number): number {
  const kx = 111_320 * Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  return Math.hypot((aLng - bLng) * kx, (aLat - bLat) * 110_540);
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function scanTargets(points: ArtPoint[], models: ModelPoint[]): ScanTarget[] {
  return points
    .filter((p) => SCANNABLE_KINDS.has(p.k) && Number.isFinite(p.lng) && Number.isFinite(p.lat))
    .map((p) => {
      const n = norm(p.name);
      const hit = models.find((m) => metres(p.lng, p.lat, m.lng, m.lat) <= MODELLED_METRES || (n.length > 5 && norm(m.name) === n));
      const t: ScanTarget = { id: p.id, name: p.name, k: p.k, lng: +p.lng.toFixed(6), lat: +p.lat.toFixed(6) };
      if (p.a) t.a = p.a;
      if (p.y) t.y = p.y;
      if (p.u) t.u = p.u;
      if (p.i) t.i = p.i;
      if (hit) t.m = hit.id;
      return t;
    });
}
