// Field independence (lane WG step 3): a spec's stated window trait replaces only itself. Weteringschans 171198's
// describer read flat heads; the arched, white-framed preset it had before lost its white frames too, because every
// unstated trait fell to "any" and the pick moved to another preset.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bayLookFor, styleTraits, BAY_STYLES } from './bayLook.ts';

const look = (id: string, spec?: { pale?: boolean; dark?: boolean; arch?: boolean; tall?: boolean }) => bayLookFor(id, 1885, 16, 'photo', 'quiet', undefined, undefined, null, undefined, spec);

test('a stated trait the ladder preset already shows keeps that preset', () => {
  for (let i = 0; i < 60; i++) {
    const id = `ladder${i}`, base = look(id), t = styleTraits(base.variant);
    for (const k of ['pale', 'dark', 'arch', 'tall'] as const) assert.equal(look(id, { [k]: t[k] }).style, base.style, `${id} ${k}`);
  }
});

test('a stated head changes the head and keeps every unstated trait the ladder showed', () => {
  let changed = 0;
  for (let i = 0; i < 200; i++) {
    const id = `head${i}`, base = look(id), t = styleTraits(base.variant);
    const after = look(id, { arch: !t.arch }), a = styleTraits(after.variant);
    // the stated trait wins whenever the archetype has a preset that shows it with the ladder's other traits
    const reachable = BAY_STYLES[base.archetype].some(v => { const s = styleTraits(v); return s.arch === !t.arch && s.pale === t.pale && s.dark === t.dark && s.tall === t.tall; });
    if (reachable) { assert.equal(a.arch, !t.arch, id); changed++; }
    // white accents and frame tone are never traded for the head
    assert.equal(a.pale, t.pale, `${id} pale`);
    assert.equal(a.dark, t.dark, `${id} dark`);
  }
  assert.ok(changed > 0, 'some ladder presets have a head-flipped twin');
});
