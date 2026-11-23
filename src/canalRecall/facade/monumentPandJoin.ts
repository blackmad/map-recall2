// Which BAG pand a monument register record describes (round 20261123, the rm 2389 bug).
//
// The old join took the RCE point first: a point inside a z14 footprint won, and the record's own BAG link was
// only a fallback. RCE points are coarse ("puntlocatie", often "globaal"), so a point can fall into the neighbour:
// rm 2389 (the Koetshuis, Keizersgracht 607) has its point inside the Vijzelstraat 79 office. The register itself
// names the address (and for about a quarter of the records the pand id), which is the better evidence.
//
// Order of preference, each step explainable:
//   1. the register's own BAG pand ids (pandIdentificatie on its BAG relations);
//   2. the pands of the register's addresses, resolved through BAG (nummeraanduiding -> verblijfsobject ->
//      ligtInPanden), done by the caller and passed in as `addressPands`;
//   3. the point inside a footprint (the old rule), kept as the fallback.
// When the register names several pands, the point's pand wins if it is one of them (it is then the best guess of
// which one the description is about); otherwise the pand named by the most addresses, ties to the nearest.
// Every case where the chosen pand differs from the point's pand is flagged, so the change is reviewable.

export type JoinSource = 'register-pand' | 'address' | 'point' | 'none';

export type MonumentJoinInput = {
  /** Pand ids named on the register's BAG relations (pandIdentificatie), without the NL.IMBAG.Pand. prefix. */
  registerPands: string[];
  /** Pand id for each register address that resolved to a BAG unit (one entry per address; repeats count). */
  addressPands: string[];
  /** Pand whose footprint holds the RCE point, if any. */
  pointPand: string | null;
  /** Distance in metres from the RCE point to each candidate pand's footprint, for tie-breaks. Missing = unknown. */
  distanceM?: Record<string, number>;
};

export type MonumentJoin = {
  pand: string | null;
  source: JoinSource;
  /** The point fell in another pand than the one chosen (or the register disagrees with the point). */
  disagrees: boolean;
};

const rank = (ids: string[], dist: Record<string, number> | undefined): string => {
  const count = new Map<string, number>();
  for (const id of ids) count.set(id, (count.get(id) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1] || (dist?.[a[0]] ?? Infinity) - (dist?.[b[0]] ?? Infinity) || a[0].localeCompare(b[0]))[0][0];
};

export function joinMonumentToPand(input: MonumentJoinInput): MonumentJoin {
  const { registerPands, addressPands, pointPand, distanceM } = input;
  for (const [ids, source] of [[registerPands, 'register-pand'], [addressPands, 'address']] as const) {
    if (!ids.length) continue;
    if (pointPand && ids.includes(pointPand)) return { pand: pointPand, source, disagrees: false };
    return { pand: rank(ids, distanceM), source, disagrees: pointPand !== null };
  }
  if (pointPand) return { pand: pointPand, source: 'point', disagrees: false };
  return { pand: null, source: 'none', disagrees: false };
}

// --- register address parsing -------------------------------------------------------------------------------------

export type RegisterAddress = { street: string; number: number; letter: string | null; addition: string | null; postcode: string | null; vbo: string | null; pand: string | null };

const CEO = 'https://linkeddata.cultureelerfgoed.nl/def/ceo#';

/** Group a record's metadata triples by BAG relation and read the address fields the register states. */
export function registerAddresses(metadata: Array<{ s: { value: string }; p: { value: string }; o: { value: string } }>): RegisterAddress[] {
  const rel = new Map<string, Record<string, string>>();
  for (const m of metadata) {
    if (!m.p.value.startsWith(CEO) || !m.s.value.includes('/bagrelatie/')) continue;
    const k = m.p.value.slice(CEO.length);
    (rel.get(m.s.value) ?? rel.set(m.s.value, {}).get(m.s.value)!)[k] = m.o.value;
  }
  const out: RegisterAddress[] = [];
  for (const r of rel.values()) {
    const num = /^(\d+)/.exec(r.huisnummer ?? '');
    if (!r.openbareRuimte || !num) { if (r.pandIdentificatie) out.push({ street: r.openbareRuimte ?? '', number: NaN, letter: null, addition: null, postcode: r.postcode ?? null, vbo: r.verblijfsobjectIdentificatie ?? null, pand: r.pandIdentificatie }); continue; }
    out.push({ street: r.openbareRuimte, number: Number(num[1]), letter: r.huisletter?.trim().toUpperCase() || null, addition: r.huisnummerToevoeging?.trim().toUpperCase() || null, postcode: r.postcode?.replace(/\s/g, '').toUpperCase() || null, vbo: r.verblijfsobjectIdentificatie ?? null, pand: r.pandIdentificatie ?? null });
  }
  return out;
}

/** A current BAG address and the pands its verblijfsobject lies in. */
export type BagUnit = { street: string; number: number; letter: string | null; addition: string | null; pands: string[] };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The BAG unit for a register address: exact street+number+letter+addition first, then street+number+letter,
 *  then street+number (the register often omits a toevoeging the BAG carries). Null when the number is absent. */
export function matchUnit(addr: RegisterAddress, units: BagUnit[]): BagUnit | null {
  if (!Number.isFinite(addr.number)) return null;
  const same = units.filter(u => u.number === addr.number && norm(u.street) === norm(addr.street));
  return same.find(u => u.letter === addr.letter && u.addition === addr.addition)
    ?? same.find(u => u.letter === addr.letter)
    ?? same[0] ?? null;
}
