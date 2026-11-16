// The shopfront browser's index (lane shopfront-browser-20261116): one entry per generic template and per chain with the
// number of pands that draw it and an example pand for the "See it in the game" link. Pure; the thumbnails are drawn by
// scripts/retail-ground/shopfront-gallery.ts through retailFrontTris, the game's own path.

/** shop-templates.json rows: [template index, lng, lat, word ('@<chain>' or a name), nearest flag]. */
export type ShopTemplateRow = [number, number, number, string?, number?];
export type ShopTemplateExtract = { templates: string[]; buildings: Record<string, ShopTemplateRow> };
export type ShopfrontEntry = {
  id: string; kind: 'chain' | 'template'; name: string; template: string; pands: number;
  example: { pand: string; lng: number; lat: number } | null;
  /** The chain's measured brand style draws by default (ACCEPTED_BRANDS). */
  brandAccepted: boolean;
  /** Where the logo came from (Wikimedia Commons page or the chain's own site), when the chain has one. */
  logoSource?: string;
  /** False when the game draws no template for it yet (a chain type that has not won its blind): no thumbnail. */
  drawn?: boolean;
  thumb: string | null;
};
export type ShopfrontIndexInput = {
  extract: ShopTemplateExtract;
  /** Templates that are chains in themselves (CHAIN_TEMPLATES): id = the template key. */
  chainTemplates: readonly string[];
  /** Templates that draw only under a chain (CHAIN_TYPE_TEMPLATES): no generic card. */
  chainTypeTemplates: readonly string[];
  chains: Readonly<Record<string, { name: string; template: string }>>;
  names?: Readonly<Record<string, string>>;
  brandAccepted: (key: string) => boolean;
  logoSource: (key: string, kind: 'chain' | 'template') => string | undefined;
  thumbBase: string;
  /** Examples are the pands nearest here, so the link lands somewhere a player rides. */
  centre?: { lng: number; lat: number };
};

/** 'brownBar' -> 'Brown bar'. */
export const humanise = (key: string): string => {
  const s = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const thumbFile = (kind: 'chain' | 'template', id: string): string => `${kind === 'chain' ? 'chain' : 'generic'}-${id}.webp`;

export function buildShopfrontIndex(inp: ShopfrontIndexInput): ShopfrontEntry[] {
  const { extract: x } = inp, c = inp.centre ?? { lng: 4.8952, lat: 52.3702 };
  const dist = (r: ShopTemplateRow) => ((r[1] - c.lng) * 0.61) ** 2 + (r[2] - c.lat) ** 2;
  type Acc = { n: number; pand: string; row: ShopTemplateRow | null };
  const acc = new Map<string, Acc>();
  const bump = (id: string, pand: string, row: ShopTemplateRow) => {
    const a = acc.get(id) ?? { n: 0, pand: '', row: null };
    a.n++;
    if (!a.row || dist(row) < dist(a.row) || (dist(row) === dist(a.row) && pand < a.pand)) { a.row = row; a.pand = pand; }
    acc.set(id, a);
  };
  const chainT = new Set(inp.chainTemplates), typeT = new Set(inp.chainTypeTemplates);
  for (const [pand, row] of Object.entries(x.buildings)) {
    const t = x.templates[row[0]], w = row[3] ?? '';
    if (!t) continue;
    if (w.startsWith('@')) { if (inp.chains[w.slice(1)]) bump(`chain:${w.slice(1)}`, pand, row); }
    else if (chainT.has(t)) bump(`template-chain:${t}`, pand, row);
    else if (!typeT.has(t)) bump(`generic:${t}`, pand, row);
  }
  const out: ShopfrontEntry[] = [];
  const entry = (kind: 'chain' | 'template', id: string, name: string, template: string, a: Acc | undefined, brandKey: string, logoKind: 'chain' | 'template'): ShopfrontEntry => ({
    id, kind, name, template, pands: a?.n ?? 0,
    example: a?.row ? { pand: a.pand, lng: a.row[1], lat: a.row[2] } : null,
    brandAccepted: inp.brandAccepted(brandKey), ...(inp.logoSource(id, logoKind) ? { logoSource: inp.logoSource(id, logoKind) } : {}),
    thumb: `${inp.thumbBase}${thumbFile(kind, id)}`,
  });
  for (const t of inp.chainTemplates) out.push(entry('chain', t, inp.names?.[t] ?? humanise(t), t, acc.get(`template-chain:${t}`), t, 'template'));
  for (const [k, ch] of Object.entries(inp.chains)) out.push(entry('chain', k, ch.name, ch.template, acc.get(`chain:${k}`), k, 'chain'));
  for (const t of x.templates) if (!chainT.has(t) && !typeT.has(t)) out.push(entry('template', t, inp.names?.[t] ?? humanise(t), t, acc.get(`generic:${t}`), t, 'template'));
  return out.sort((a, b) => b.pands - a.pands || a.name.localeCompare(b.name));
}
