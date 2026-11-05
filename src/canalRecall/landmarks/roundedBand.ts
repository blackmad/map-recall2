/**
 * Outline of a horizontal window band or panel whose corners may be rounded independently (quarter circles), as a
 * counter-clockwise polygon in (t, y) with the band's bottom-left corner at the origin.
 *
 * Why (2026-11-02, Binnengasthuis lane #208): P.L. Marnette's 1927 university wing on the Kloveniersburgwal ("de
 * schaats", the skate) is named for its white ground-floor window band, whose left end sweeps round in one large quarter
 * circle like the toe of a skate blade, under a rounded glass-block oriel. Amsterdam School fronts round single corners of
 * bands, canopies and frames this way; the kit's slabs, arch slabs and `archBand` round both top corners of an opening or
 * none. Pure geometry, no three.js.
 */
export type RoundedCorners = {bottomLeft?: number; bottomRight?: number; topRight?: number; topLeft?: number};

export function roundedBandOutline(w: number, h: number, r: RoundedCorners = {}, steps = 8): [number, number][] {
  if (!(w > 0 && h > 0)) throw Error('roundedBandOutline: positive width and height required');
  // a single corner may round the whole band height; two corners sharing a side are scaled to fit that side together
  const rad = (v?: number) => Math.max(0, Math.min(v ?? 0, w, h));
  let bl = rad(r.bottomLeft), br = rad(r.bottomRight), tr = rad(r.topRight), tl = rad(r.topLeft);
  const fit = (a: number, b: number, side: number) => (a + b > side ? side / (a + b) : 1);
  for (let k = 0; k < 2; k++) {
    const sb = fit(bl, br, w), st = fit(tl, tr, w), sl = fit(bl, tl, h), sr = fit(br, tr, h);
    bl *= Math.min(sb, sl); br *= Math.min(sb, sr); tr *= Math.min(st, sr); tl *= Math.min(st, sl);
  }
  const out: [number, number][] = [];
  // each corner: centre, radius, start angle; walked counter-clockwise from the bottom-left
  const corner = (cx: number, cy: number, rr: number, a0: number, px: number, py: number) => {
    if (rr <= 0) { out.push([px, py]); return; }
    for (let i = 0; i <= steps; i++) { const a = a0 + (i / steps) * Math.PI / 2; out.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
  };
  corner(bl, bl, bl, Math.PI, 0, 0);
  corner(w - br, br, br, -Math.PI / 2, w, 0);
  corner(w - tr, h - tr, tr, 0, w, h);
  corner(tl, h - tl, tl, Math.PI / 2, 0, h);
  return out;
}
