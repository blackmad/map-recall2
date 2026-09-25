/**
 * Every fixture here is a real reading taken from `.cache/facade-eval/vision-ocr-*.json`,
 * not an invented one. The point of the module is to survive the reader's actual
 * failure modes, so the test has to carry them.
 */
import { consensusSigns, type SignReading } from './signConsensus.ts';

let checks = 0;
function check(condition: boolean, message: string): void {
  checks += 1;
  if (!condition) throw new Error(message);
}

function reading(text: string, confidence: number, along: number, up: number, height: number, viewId = 'v0', year?: number): SignReading {
  return { text, confidence, box: { along, up, width: Math.max(0.4, text.length * height * 0.6), height }, viewId, year };
}

// The hoarding on Bilderdijkstraat, read four times in one crop with a different
// first and last letter each time. No single reading is right; the vote is.
//
// Three of the four merge. They sit within a metre of each other on one
// hoarding, and that co-location is independent physical evidence, so a looser
// string test applies than would be safe between distant readings. `LONDO`
// stays out: two edits away and furthest along the wall.
{
  const signs = consensusSigns([
    reading('WONDR', 1.0, 5.09, 1.69, 0.15),
    reading('TONDE', 0.3, 2.71, 1.62, 0.11),
    reading('MONDR', 1.0, 3.87, 1.58, 0.15),
    reading('LONDO', 0.5, 1.53, 1.60, 0.11),
  ]);
  const voted = signs.find(sign => !sign.uncorroborated);
  check(Boolean(voted), `the co-located readings corroborate, got ${JSON.stringify(signs.map(s => s.text))}`);
  check(voted!.support === 3, `three of the four readings vote, got ${voted!.support}`);
  check(voted!.text === 'WONDR', `the agreed characters are recovered, got ${JSON.stringify(voted!.text)}`);
  check(voted!.charAgreement[1] === 1 && voted!.charAgreement[2] === 1 && voted!.charAgreement[3] === 1,
    'the unanimous characters report full agreement');
  check(voted!.charAgreement[0] < 1, 'the contested first character reports partial agreement');
}

// Lines of one observation are different text by construction, never readings
// of each other. `Lotto. / TOTO / KRASLOTEN` is one lottery sticker read once,
// and its three lines share a rectangle -- so proximity must not merge them,
// and only their shared provenance can say so. Two edits separate `Lotto.` from
// `TOTO`, exactly as many as separate `WONDR` from `TONDE` above, which is why
// no string or distance test could have got both cases right.
{
  const signs = consensusSigns([{
    text: 'Lotto. / TOTO / KRASLOTEN',
    confidence: 1.0,
    box: { along: 2.0, up: 1.4, width: 0.45, height: 0.65 },
    viewId: 'v0',
  }]);
  check(signs.length === 3, `one sticker's three lines stay three, got ${JSON.stringify(signs.map(s => s.text))}`);
  check(signs.every(sign => sign.uncorroborated), 'and none of them corroborates another');
}

// The over-merges that the rules still have to prevent between separate signs.
{
  const hotel = consensusSigns([
    reading('info@alphotel.nl', 1.0, 3.0, 2.2, 0.12),
    reading('ROTEL', 1.0, 9.0, 2.2, 0.12),
  ]);
  check(hotel.length === 2, `a shared 'OTEL' across a frontage is not one sign, got ${JSON.stringify(hotel.map(s => s.text))}`);

  const slogan = consensusSigns([reading('MOND NEEMT', 1.0, 0.24, 2.38, 0.15), reading('MONDR', 1.0, 9.87, 1.58, 0.15)]);
  check(slogan.length === 2, `a newspaper slogan does not join a distant hoarding, got ${JSON.stringify(slogan.map(s => s.text))}`);
}

// A fragment still joins the reading it is a fragment of, which is the whole
// reason the rule is a length rather than an outright ban.
{
  const signs = consensusSigns([
    reading('BESTSELLER', 1.0, 2.0, 3.0, 0.2),
    reading('SELLER', 0.6, 2.4, 3.0, 0.2),
  ]);
  check(signs.length === 1, `a fragment joins its parent, got ${signs.length}`);
  check(signs[0].text === 'BESTSELLER', `and does not truncate it, got ${JSON.stringify(signs[0].text)}`);
}

// A regression. The longest reading is the pivot, and end gaps are free so a
// reading cut short by shadow does not vote against letters it never reached.
// The first version of this module therefore kept the pivot's spurious trailing
// character and reported it unanimous, because no shorter reading contradicted
// it: three readings of the Eerlijk Eten hoarding gave `CLAIM NU OPI` at
// agreement 1.00. A character the cluster did not see is not published.
{
  const signs = consensusSigns([
    reading('CLAIM NU OPI', 0.95, 7.38, 1.8, 0.3),
    reading('CLAIM NU OP', 1.0, 6.2, 1.8, 0.3),
    reading('CLAIM NIP', 0.7, 8.55, 1.8, 0.3),
  ]);
  check(signs.length === 1, `one hoarding line, got ${signs.length}`);
  check(signs[0].text === 'CLAIM NU OP', `the invented tail is dropped, got ${JSON.stringify(signs[0].text)}`);
  check(signs[0].agreement < 1, `a contested line does not report unanimity, got ${signs[0].agreement}`);
  check(signs[0].charAgreement.every(value => value <= 1), 'agreement stays a share');
}

// Two `Hotel` signs at opposite ends of one facade are two signs. The string is
// corroborated, but both placements survive — merging them would lose one.
{
  const signs = consensusSigns([
    reading('Hotel', 1.0, 10.71, 3.61, 0.27),
    reading('Hotel', 1.0, 4.50, 3.61, 0.27),
  ]);
  check(signs.length === 1, `one string, got ${signs.length}`);
  check(signs[0].text === 'Hotel', `the agreed text is kept, got ${JSON.stringify(signs[0].text)}`);
  check(signs[0].placements.length === 2,
    `both physical signs survive as placements, got ${signs[0].placements.length}`);
}

// A sign read in two different campaign years. Cross-year agreement is the
// persistence signal, so the years have to come back distinct and sorted.
{
  const signs = consensusSigns([
    reading('Apollofirst', 1.0, 7.01, 3.55, 0.34, 'v0', 2021),
    reading('Apollofirst', 0.9, 7.10, 3.60, 0.32, 'v1', 2024),
    reading('Apollofrst', 0.8, 7.05, 3.58, 0.33, 'v2', 2017),
  ]);
  check(signs.length === 1, `one persistent business, got ${signs.length}`);
  check(signs[0].views === 3, `three distinct views, got ${signs[0].views}`);
  check(signs[0].years.join(',') === '2017,2021,2024', `years come back sorted, got ${signs[0].years}`);
  check(signs[0].text === 'Apollofirst', `the majority spelling wins, got ${JSON.stringify(signs[0].text)}`);
}

// Height is a physical gate. A shop name and a house number that happen to read
// alike are not one sign if their letters are wildly different sizes.
{
  const signs = consensusSigns([
    reading('BEET', 1.0, 9.29, 4.39, 0.11),
    reading('BEET', 1.0, 1.00, 1.20, 0.90),
  ]);
  check(signs.length === 2, `very different letter sizes stay separate, got ${signs.length}`);
}

// The reader joins an observation's lines with ' / '. Those are separate
// strings: a fragment of one line must not be matched against another.
{
  const signs = consensusSigns([
    reading('HOTEL / Apolle / Finst', 0.83, 4.37, 3.94, 0.69),
    reading('Hotel', 1.0, 4.40, 3.90, 0.24),
  ]);
  const hotel = signs.find(sign => sign.text.toUpperCase() === 'HOTEL');
  check(Boolean(hotel), `the joined line is split out and matched, got ${JSON.stringify(signs.map(s => s.text))}`);
  check(hotel!.support === 2, `the split line corroborates the separate reading, got ${hotel!.support}`);
}

// Nothing corroborated: say so rather than promoting a single reading.
{
  const signs = consensusSigns([reading('GIDEON ITALIAANDER', 1.0, 0.98, 3.43, 0.20)]);
  check(signs.length === 1 && signs[0].uncorroborated, 'a lone reading is marked uncorroborated');
  check(signs[0].support === 1 && signs[0].views === 1, 'a lone reading reports its own support honestly');
  check(signs[0].text === 'GIDEON ITALIAANDER', 'a lone reading is passed through unaltered');
}

// Noise the reader emits constantly: one or two characters, low confidence.
{
  const signs = consensusSigns([
    reading('S', 1.0, 0.10, 2.58, 0.13),
    reading('MI T', 0.2, 3.0, 2.6, 0.10),
    reading('HET', 0.9, 4.0, 2.6, 0.10),
  ]);
  check(!signs.some(sign => sign.text === 'S'), 'a single character is not a sign');
  check(!signs.some(sign => sign.text === 'MI T'), 'a reading below the confidence floor does not vote');
  check(signs.length === 1 && signs[0].text === 'HET', `only the real short word survives, got ${JSON.stringify(signs.map(s => s.text))}`);
}

// The module never writes a character no reading contained.
{
  const inputs = [
    reading('JEJU Korean Kitchen & Bar', 1.0, 2.0, 3.2, 0.18),
    reading('TEJU Korean Kitchen & Bar', 0.5, 2.0, 3.2, 0.18),
  ];
  const signs = consensusSigns(inputs);
  check(signs.length === 1, `one shopfront, got ${signs.length}`);
  check(signs[0].text === 'JEJU Korean Kitchen & Bar', `the confident reading wins, got ${JSON.stringify(signs[0].text)}`);
  for (const char of signs[0].text.replace(/[^0-9A-Za-z]/g, '')) {
    check(inputs.some(input => input.text.includes(char)), `'${char}' came from some reading`);
  }
}

// An empty input is a no-op, not a crash.
{
  check(consensusSigns([]).length === 0, 'no readings gives no signs');
  check(consensusSigns([reading('', 1.0, 0, 0, 0.2)]).length === 0, 'an empty string gives no signs');
}

process.stdout.write(`sign consensus checks passed (${checks} assertions).\n`);
