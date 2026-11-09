// Register facts -> recipe reads: bounded, explainable, byte-identical without facts (lane register-recipes, 2026-11-10).
import test from 'node:test';
import assert from 'node:assert/strict';
import { decorateFacade } from '../genericFacades.ts';
import { decorateRoof } from '../roofMesh.ts';
import { registerFactsEnabled, registerForce, registerPatch, registerYear, withRegisterFacts, eraOfYear, type PublishedFacts } from './registerRecipe.ts';

const ring = [[4.9, 52.37], [4.90007, 52.37], [4.90007, 52.37008], [4.9, 52.37008], [4.9, 52.37]];
const house = (props: Record<string, unknown> = {}) => ({ type: 'Feature' as const, properties: <Record<string, unknown>>{ id: 'NL.IMBAG.Pand.1', height: 14, minHeight: 0, constructionYear: 1905, appearanceStyleSource: 'citywide-identity-palette-v3-not-measured', ...props }, geometry: { type: 'Polygon', coordinates: [ring] } });
const facts = (f: PublishedFacts) => new Map([['NL.IMBAG.Pand.1', f]]);
const date = (from: number, to = from) => ({ from, to, confidence: 'exact' as const, term: String(from) });

test('a pand without facts, or with facts that change nothing, comes back as the same object', () => {
  const f = house();
  assert.equal(withRegisterFacts(f, new Map()), f);
  assert.equal(withRegisterFacts(f, facts({ elements: [] })), f);
  assert.equal(withRegisterFacts(f, new Map([['other', { gable: 'bell' as const }]])), f);
});

test('era: the register date replaces the BAG year only when it is in another era', () => {
  assert.equal(eraOfYear(1859), 'canal'); assert.equal(eraOfYear(1860), 'c19');
  const r = withRegisterFacts(house({ constructionYear: 1905 }), facts({ facadeDate: date(1662), elements: [] }));
  assert.equal(r.properties.constructionYear, 1662); assert.equal(r.properties.bagConstructionYear, 1905);
  // Same era: the BAG year stays (no drift in roof odds).
  const same = withRegisterFacts(house({ constructionYear: 1650 }), facts({ facadeDate: date(1662), elements: [] }));
  assert.equal(same.properties.constructionYear, 1650);
  // A missing BAG year takes the register's.
  assert.equal(withRegisterFacts(house({ constructionYear: null }), facts({ facadeDate: date(1700, 1724) })).properties.constructionYear, 1712);
  // The facade then draws the canal style, not the BAG year's c19 style.
  assert.equal(decorateFacade(house()).properties.facadeStyle, 'c19');
  assert.equal(decorateFacade(withRegisterFacts(house(), facts({ facadeDate: date(1662) }))).properties.facadeStyle, 'canal');
});

test('core date counts only when nothing was altered', () => {
  assert.equal(registerYear({ coreDate: date(1600, 1699) }), 1650);
  assert.equal(registerYear({ coreDate: date(1600, 1699), altered: { what: ['gevel'] } }), null);
  assert.equal(registerYear({ facadeDate: date(1800, 1824), coreDate: date(1600, 1699), altered: { what: [] } }), 1812);
});

test('finish: plaster/paint draws a light wall, brick a brick one', () => {
  const light = decorateFacade(withRegisterFacts(house({ constructionYear: 1700, id: 'NL.IMBAG.Pand.1' }), facts({ finish: 'painted' })));
  assert.equal(light.properties.facade, 'canal-priorPlaster');
  const ids = Array.from({ length: 12 }, (_, i) => `NL.IMBAG.Pand.${100 + i}`);
  for (const id of ids) {
    const m = new Map([[id, { finish: 'plaster' as const }]]);
    assert.match(String(decorateFacade(withRegisterFacts(house({ id, constructionYear: 1700 }), m)).properties.facade), /priorPlaster$/);
    const b = new Map([[id, { finish: 'brick' as const }]]);
    assert.match(String(decorateFacade(withRegisterFacts(house({ id, constructionYear: 1700 }), b)).properties.facade), /priorBrick/);
  }
});

test('gable: the register crown is set where nothing else set one, and never over a measured appearance', () => {
  assert.equal(withRegisterFacts(house(), facts({ gable: 'bell' })).properties.monumentGable, 'bell');
  assert.equal(withRegisterFacts(house({ monumentGable: 'step' }), facts({ gable: 'bell' })).properties.monumentGable, 'step');
  const measured = house({ appearanceStyleSource: 'panorama-measured' });
  assert.equal(withRegisterFacts(measured, facts({ gable: 'bell', facadeDate: date(1662), finish: 'brick', elements: [{ key: 'stoop', term: 'stoep' }] })), measured);
  const kit = house({ kitWall: 'plain' });
  assert.equal(withRegisterFacts(kit, facts({ gable: 'bell' })), kit);
});

test('elements: the register forces wall extras on, in a stable order', () => {
  assert.deepEqual(registerForce({ elements: [{ key: 'stoop', term: 'stoep' }, { key: 'hoistBeam', term: 'hijsbalk' }, { key: 'sculpture', term: 'beeld' }], stoneBands: true }), ['hoist-beam', 'stoop', 'string-courses']);
  assert.deepEqual(registerPatch({ elements: [] }, house().properties), {});
});

test('a register gable plans the crown through the roof decorator', () => {
  const f = decorateRoof(withRegisterFacts(decorateFacade(house({ constructionYear: 1662 })), facts({ gable: 'neck' })));
  assert.equal(f.properties.monumentGable, 'neck'); assert.equal(f.properties.roofPlanned, true);
});

test('flag: on by default in the lane, ?registerFacts=0 or REGISTER_FACTS=0 turns it off', () => {
  assert.equal(registerFactsEnabled(''), true);
  assert.equal(registerFactsEnabled('?registerFacts=0'), false);
  assert.equal(registerFactsEnabled('?x=1&registerFacts=1'), true);
  assert.equal(registerFactsEnabled(null, '0'), false);
  assert.equal(registerFactsEnabled('?registerFacts=1', '0'), true);
});

import { ExtraSink, wallExtras, type ExtraContext } from '../facadeExtras.ts';
const wall = (id: string, extra: Partial<ExtraContext> = {}): ExtraContext => ({ id, style: 'canal', period: 'canal', wallKey: 'street', f: { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1, len: 6.4 }, base: 0, top: 13,
  layout: { bays: 2, bayWidthM: 3.2, groundM: 3.4, storeys: 4, storeyM: 3.0, doorBays: [0] }, wallHex: '#a46c56', accentHex: '#e8e2d2', groundLevel: true, streetSide: true, ...extra });

test('forced extras: the register sets hoist beam, stoop and kroonlijst to certain; absent, the dice stay as they were', () => {
  const ids = Array.from({ length: 40 }, (_, i) => `NL.IMBAG.Pand.9${i}`);
  let diceHoist = 0, forcedHoist = 0, forcedStoop = 0, forcedCornice = 0;
  for (const id of ids) {
    const base = wallExtras(wall(id), new ExtraSink(230));
    const same = wallExtras(wall(id, {}), new ExtraSink(230));
    assert.deepEqual(base, same, 'same context, same dice');
    diceHoist += base.includes('hoist-beam') ? 1 : 0;
    const forced = wallExtras(wall(id, { registerForce: ['hoist-beam', 'kroonlijst', 'stoop'] }), new ExtraSink(230));
    forcedHoist += forced.includes('hoist-beam') ? 1 : 0; forcedStoop += forced.includes('stoop') || forced.includes('double-stoop') ? 1 : 0; forcedCornice += forced.includes('kroonlijst') ? 1 : 0;
  }
  assert.ok(forcedHoist > diceHoist && forcedHoist >= 30, `hoist beam ${diceHoist} -> ${forcedHoist} of 40`);
  assert.ok(forcedCornice >= 30 && forcedStoop >= 25, `kroonlijst ${forcedCornice}, stoop ${forcedStoop}`);
});
