/**
 * Offline street Wikipedia resolution helpers (enrich pipeline, not runtime).
 */
import assert from 'node:assert/strict';
import { isDisambiguationExtract } from '../src/canalRecall/game/encyclopediaDisambiguation.ts';
import {
  composeNamedAfterBlurb,
  isThinStreetExtract,
  parseDutchNamedAfter,
  personNameFromStreet,
  resolveStreetWikipedia,
  streetArticleTitleCandidates,
} from '../src/canalRecall/game/streetWikipedia.ts';

assert.deepEqual(
  streetArticleTitleCandidates('Nicolaas Beetsstraat'),
  ['Nicolaas Beetsstraat (Amsterdam)', 'Nicolaas Beetsstraat'],
);
assert.equal(personNameFromStreet('Nicolaas Beetsstraat'), 'Nicolaas Beets');
assert.equal(personNameFromStreet('Kinkerstraat'), null, 'single-token stems are not person names');
assert.equal(personNameFromStreet('Prinsengracht'), null);

assert.equal(
  parseDutchNamedAfter('| genoemdnaar = [[Nicolaas Beets]]\n| naamsinds = 1889'),
  'Nicolaas Beets',
);
assert.equal(
  parseDutchNamedAfter('| genoemdnaar = [[Nicolaas Beets|Beets]]'),
  'Nicolaas Beets',
);
assert.equal(parseDutchNamedAfter('no box'), null);

assert.equal(
  isThinStreetExtract('De Nicolaas Beetsstraat is een straat in de wijk Oud West in Amsterdam-West.'),
  true,
);
assert.equal(
  isThinStreetExtract('The Magere Brug is a famous narrow bridge over the Amstel, rebuilt in 1934 and still operated by hand.'),
  false,
);

assert.equal(
  composeNamedAfterBlurb(
    'Nicolaas Beets',
    'Nicolaas Beets was a Dutch theologian, writer and poet.',
  ),
  'Named after Nicolaas Beets. Nicolaas Beets was a Dutch theologian, writer and poet.',
);

{
  assert.equal(isDisambiguationExtract('New Canal can refer to: Nieuwegracht (Utrecht)'), true);
  assert.equal(isDisambiguationExtract('The Oudegracht runs through the center of Utrecht.'), false);
}

{
  const fetchJson = async (url: string) => {
    if (url.includes('/en.wikipedia.org/api/rest_v1/page/summary/Nicolaas_Beetsstraat')) {
      return { type: 'https://mediawiki.org/api/rest_v1/errors/not_found' };
    }
    if (url.includes('/nl.wikipedia.org/api/rest_v1/page/summary/Nicolaas_Beetsstraat_(Amsterdam)')) {
      return {
        title: 'Nicolaas Beetsstraat (Amsterdam)',
        extract: 'De Nicolaas Beetsstraat is een straat in de wijk Oud West in Amsterdam-West.',
        lang: 'nl',
        wikibase_item: 'Q19354137',
        content_urls: { desktop: { page: 'https://nl.wikipedia.org/wiki/Nicolaas_Beetsstraat_(Amsterdam)' } },
      };
    }
    if (url.includes('/nl.wikipedia.org/w/api.php') && url.includes('parse')) {
      return { parse: { wikitext: { '*': '| genoemdnaar = [[Nicolaas Beets]]\n' } } };
    }
    if (url.includes('/en.wikipedia.org/api/rest_v1/page/summary/Nicolaas_Beets')) {
      return {
        title: 'Nicolaas Beets',
        extract: 'Nicolaas Beets was a Dutch theologian, writer and poet. He published also under the pseudonym Hildebrand.',
        lang: 'en',
      };
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  const resolved = await resolveStreetWikipedia('Nicolaas Beetsstraat', fetchJson);
  assert.ok(resolved);
  assert.equal(resolved!.wikipediaExtractLang, 'en');
  assert.match(resolved!.wikipediaExtract, /Named after Nicolaas Beets/);
  assert.match(resolved!.wikipediaExtract, /theologian/);
  assert.equal(resolved!.wikipediaUrl, 'https://nl.wikipedia.org/wiki/Nicolaas_Beetsstraat_(Amsterdam)');
}

console.log('Street Wikipedia OK: 11 checks.');
