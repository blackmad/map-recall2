// The named canal-belt bridges (lane bridge-fidelity 2026-10-14): the ride's most-seen
// bridges, which get per-bridge hand facts, the 1,500-triangle kit tier and a likeness sheet.
//
//   npx tsx scripts/bridge-reference/named.ts     # print the list with the streets crossing each footprint

/** The Seven Bridges stretch of the Reguliersgracht (from the Herengracht corner south to the Prinsengracht junction). */
export const SEVEN_BRIDGES = ['BRU0031', 'BRU0032', 'BRU0038', 'BRU0039', 'BRU0040', 'BRU0074', 'BRU0073', 'BRU0071', 'BRU0072'];
/** Landmarks: Torensluis, Blauwbrug, Magere Brug, the Westerkerk bridge (Nieuwe-Wercksbrug). */
export const LANDMARKS = ['BRU0009', 'BRU0236', 'BRU0242', 'BRU0063'];
/** Amstel bridges in the belt. */
export const AMSTEL = ['BRU0035', 'BRU0036', 'BRU0076', 'BRU0077', 'BRU0250'];
/**
 * The Herengracht / Keizersgracht / Prinsengracht crossings of the radial streets (Leidsestraat,
 * Vijzelstraat, Utrechtsestraat, Spiegelstraat, the Nine Streets, Raadhuisstraat, Leliegracht,
 * Rozengracht/Westermarkt, Reestraat), from the streets crossing each footprint (main below).
 */
export const RADIAL = ['BRU0042', 'BRU0051', 'BRU0106', 'BRU0022', 'BRU0024', 'BRU0025', 'BRU0026', 'BRU0027', 'BRU0029', 'BRU0034', 'BRU0037', 'BRU0041', 'BRU0043', 'BRU0044', 'BRU0046', 'BRU0047', 'BRU0048', 'BRU0049', 'BRU0054', 'BRU0060', 'BRU0061', 'BRU0064', 'BRU0065', 'BRU0066', 'BRU0067', 'BRU0069', 'BRU0070', 'BRU0075'];
/** Named bascules (user screenshots 2026-10-14): the Magere Brug, the Haarlemmerpoort pair (Willemsbrug, Bullebak), the Zoutkeetsgracht bridge; the Mariniersbrug (2026-10-30). */
export const BASCULES = ['BRU0242', 'BRU0151', 'BRU0149', 'BRU0345', 'BRU0272'];
export const NAMED: readonly string[] = [...new Set([...SEVEN_BRIDGES, ...LANDMARKS, ...AMSTEL, ...RADIAL, ...BASCULES])];

if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('node:fs');
  const reg = JSON.parse(readFileSync('scripts/data/amsterdam-bridge-register.json', 'utf8')) as { bridges: any[][] };
  const streets = [...JSON.parse(readFileSync('public/data/extracts/amsterdam/streets.json', 'utf8')), ...JSON.parse(readFileSync('public/data/extracts/amsterdam/streets-routing.json', 'utf8'))];
  const inside = (ring: number[][], x: number, y: number) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  for (const b of reg.bridges) {
    const [n, name, , material, year, , street, ring] = b;
    if (!['Herengracht', 'Keizersgracht', 'Prinsengracht', 'Amstel', 'Singel', 'Reguliersgracht'].includes(street)) continue;
    const names = new Set<string>();
    for (const s of streets) for (const p of (s.paths ?? [s.path]) as number[][][]) for (let i = 0; i + 1 < p.length; i++) for (let t = 0; t <= 1; t += 0.1) {
      const lat = p[i][0] + (p[i + 1][0] - p[i][0]) * t, lng = p[i][1] + (p[i + 1][1] - p[i][1]) * t;
      if (inside(ring, lng, lat)) names.add(s.name);
    }
    console.log(n, (name || '-').padEnd(26), street.padEnd(14), material.padEnd(10), year, NAMED.includes(n) ? 'NAMED' : '     ', [...names].join(' / '));
  }
}
