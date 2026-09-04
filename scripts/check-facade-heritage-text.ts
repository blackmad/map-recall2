/**
 * Pin the heritage-description gable reader.
 *
 * Every description quoted here is verbatim from the Rijksmonumenten register
 * inside the pilot boundary. That matters: the failure mode for a text
 * extractor is a rule that works on invented examples and quietly mis-reads the
 * house on the corner, so the cases are the real sentences, including all six
 * buildings whose description names more than one gable.
 */
import assert from 'node:assert/strict';
import {
  GABLE_CONFIDENCE, frontElevationText, readGable, readHoistBeam,
} from '../src/canalRecall/facade/heritageText.ts';

// ---------------------------------------------------------------------------
// Plainly stated gables — the common case

{
  const plain = readGable('Huis met halsgevel met houten pui uit de bouwtijd (1741).');
  assert.equal(plain.gable, 'hals');
  assert.equal(plain.kind, 'stated');
  assert.equal(plain.confidence, GABLE_CONFIDENCE.stated);
  assert.equal(plain.refusal, null);
  assert.match(plain.evidenceText ?? '', /halsgevel/);

  assert.equal(readGable('Pand met hoge klokgevel (plm 1750).').gable, 'klok');
  assert.equal(readGable('Pand met trapgevel (XVII) met houten pui.').gable, 'trap');
  assert.equal(readGable('Pakhuis met tuitgevel.').gable, 'tuit');
  assert.equal(readGable('Pand met puntgevel.').gable, 'punt');
  assert.equal(readGable('Woonhuis met lijstgevel.').gable, 'lijst');
}

// ---------------------------------------------------------------------------
// The register's straight-cornice formula: 502 descriptions against 12 that
// write "lijstgevel". Discarding it would throw away the largest single block
// of gable evidence in the boundary.

{
  const canonical = readGable('Pand met gevel (XVIII) onder rechte lijst (XIXa), met empire deurpartij.');
  assert.equal(canonical.gable, 'lijst');
  assert.equal(canonical.kind, 'straight-cornice');
  assert.equal(canonical.confidence, GABLE_CONFIDENCE['straight-cornice']);

  assert.equal(readGable('Pand met zandstenen gevel onder rechte lijst met triglyfen en consoles (kort na 1770).').gable, 'lijst');
  assert.equal(readGable('Pakhuis met 17e eeuwse gevel onder rechte lijst (XIX A).').gable, 'lijst');
  assert.equal(readGable('Pand met gevel onder rechte lijst met houten opzetstuk (XIX).').gable, 'lijst');

  // A gable top replaced by a straight cornice is a lijstgevel now.
  const replaced = readGable('Voorgevel met lisenen, waarvan de top (eerste kwart negentiende eeuw) door een rechte lijst is vervangen.');
  assert.equal(replaced.gable, 'lijst');
  assert.equal(replaced.kind, 'straight-cornice');

  // A straight cornice that is not tied to the gevel is not a gable statement:
  // it may be describing a doorcase, a shopfront or a side wall.
  assert.equal(readGable('Pand met eenvoudige deurpartij onder rechte lijst boven de ingang.').gable, null);

  // Other cornices of the façade read the same way — a triglyph or modillion
  // cornice terminates the façade exactly as a plain one does.
  assert.equal(readGable('Pand met voorgevel onder triglyfenlijst (XVIIId).').gable, 'lijst');
  assert.equal(readGable('Pand met gevel onder trigliefenlijst.').gable, 'lijst');
  assert.equal(readGable('Pand met gevel onder klossenlijst (XIX).').gable, 'lijst');

  // But the *omlijst* family and a puilijst are surrounds and shopfront trim,
  // not the top of the façade. A `\w+lijst` wildcard would turn all twelve of
  // these in the boundary into confident lijstgevels, which is why the cornice
  // terms are an allowlist.
  for (const surround of [
    'Pand met gevel met deuromlijst van zandsteen.',
    'Pand met gevel met vensteromlijsting in de verdieping.',
    'Pand met gevel met puilijst boven de winkelpui.',
    'Pand met gevel met omlijst venster.',
  ]) {
    assert.equal(readGable(surround).gable, null, `a surround is not a gable: ${surround}`);
  }
}

// ---------------------------------------------------------------------------
// Another elevation is not the front. Both of these describe two real gables
// on one building, and neither is ambiguous.

{
  const twoElevations = readGable('Huis met halsgevel met houten pui uit de bouwtijd (1741); achtergevel aan de Tuinstraat: eenvoudige klokgevel (XVIII).');
  assert.equal(twoElevations.gable, 'hals', 'the front gable is the one the record holds');
  assert.equal(twoElevations.kind, 'front-clause');
  assert.deepEqual(twoElevations.mentioned.slice().sort(), ['hals', 'klok'], 'and both are still reported for review');

  const rearPunt = readGable('Pand met hoge klokgevel (plm 1750); achtergevel: puntgevel (XVII ?).');
  assert.equal(rearPunt.gable, 'klok');

  // Reversing the order must not change the answer. First-match would pass the
  // two cases above by luck and fail this one.
  assert.equal(readGable('Pand met achtergevel: puntgevel (XVII ?); voorgevel met hoge klokgevel (plm 1750).').gable, 'klok');

  const sideWall = readGable('Hoekhuis (achttiende eeuw) met klokgevel en zijgevel onder rechte lijst (tweede helft negentiende eeuw).');
  assert.equal(sideWall.gable, 'klok', 'a side wall under a straight cornice does not make the front a lijstgevel');

  assert.equal(frontElevationText('Huis met halsgevel; achtergevel: klokgevel.'), 'Huis met halsgevel;');
  assert.equal(frontElevationText('Pand met klokgevel.'), 'Pand met klokgevel.');
}

// ---------------------------------------------------------------------------
// An alteration names the gable the building has now, not the one it had.

{
  const altered = readGable('Pand met tot puntgevel gewijzigde trapgevel (XVII) met houten pui.');
  assert.equal(altered.gable, 'punt', 'a trapgevel changed into a puntgevel is a puntgevel');
  assert.equal(altered.kind, 'altered-into');
  assert.equal(altered.confidence, GABLE_CONFIDENCE['altered-into']);
  assert.deepEqual(altered.mentioned.slice().sort(), ['punt', 'trap']);

  const rebuilt = readGable('In de kern waarschijnlijk 17e eeuws huis waarvan de latere halsgevel in de 19e eeuw tot een klokgevel onder rollagen en met houten fronton is gewijzigd.');
  assert.equal(rebuilt.gable, 'klok');
  assert.equal(rebuilt.kind, 'altered-into');

  // Front gable stated plainly, alteration described on the rear: the rear
  // clause goes first, so the front answer survives untouched.
  const frontAndRear = readGable('Pand met klokgevel met gesneden deur (XVIIIc); empire snijraam. Inwendig gewelfde gang (XVIIIa). Aan de achterzijde (Spuistraat) achterhuis met van trap tot puntgevel gewijzigde gevel, versierd in de trant met grote boogblokken (1634).');
  assert.equal(frontAndRear.gable, 'klok');
}

// ---------------------------------------------------------------------------
// Genuine ambiguity gets no value. One building in the pilot lands here.

{
  const office = readGable('Inleiding Op de hoek van de Keizersgracht en de Berenstraat gelegen en in 1935-1936 tot stand gekomen HANDELSKANTOOR. De voorgevel toont een trapgevel naast een halsgevel in baksteen.');
  assert.equal(office.gable, null, 'two gables on the front, no way to choose');
  assert.equal(office.refusal, 'ambiguous');
  assert.equal(office.confidence, 0);
  assert.deepEqual(office.mentioned.slice().sort(), ['hals', 'trap'], 'both are reported so a reviewer can settle it');

  // A gable on the rear and none on the front is a *gap*, not a conflict. This
  // is verbatim from the register, and calling it ambiguous would file a clean
  // gap as a disagreement and send a reviewer hunting for one that is not there.
  const rearOnly = readGable('Pand met voorgevel onder triglyfenlijst (XVIIId), achtergevel aan de Stroomarkt trapgevel, versierd met sterren en blokken in de vensterbogen (XVIIA).');
  assert.equal(rearOnly.gable, 'lijst', 'the front is a triglyph-cornice façade');
  assert.deepEqual(rearOnly.mentioned, ['trap'], 'and the rear trapgevel is still reported');

  const rearOnlyNoFront = readGable('Pand met gepleisterde voorgevel, achtergevel trapgevel (XVII).');
  assert.equal(rearOnlyNoFront.gable, null);
  assert.equal(rearOnlyNoFront.refusal, 'not-stated', 'unstated for the front, not disputed');
  assert.deepEqual(rearOnlyNoFront.mentioned, ['trap']);

  const silent = readGable('Woonhuis met gepleisterde gevel en houten pui.');
  assert.equal(silent.gable, null);
  assert.equal(silent.refusal, 'not-stated');
  assert.deepEqual(silent.mentioned, []);

  assert.equal(readGable(null).refusal, 'not-stated');
  assert.equal(readGable('').refusal, 'not-stated');
  assert.equal(readGable('   ').refusal, 'not-stated');
}

// ---------------------------------------------------------------------------
// The vocabulary claims nothing the register never writes

{
  // "verhoogde halsgevel" does not occur in any description in the boundary,
  // in any spelling, so the reader must never produce it.
  assert.equal(readGable('Huis met verhoogde halsgevel.').gable, 'hals',
    'a raised neck gable still reads as hals; verhoogde-hals has no textual support');
}

// ---------------------------------------------------------------------------
// Hoisting beams: presence only, never absence.

{
  assert.equal(readHoistBeam('Pand met klokgevel en hijsbalk.'), true);
  assert.equal(readHoistBeam('Pakhuis met hijsluik en luiken.'), true);
  // The register records what is notable, not what is ordinary: 24 of 1,568
  // descriptions mention a hoist beam, and nearly every canal house has one.
  // Silence is not evidence of absence, so this must never return false.
  assert.equal(readHoistBeam('Pand met klokgevel.'), null);
  assert.equal(readHoistBeam(null), null);
}

console.log('All façade heritage-text checks passed.');
