/**
 * Belt review render service (R2): the same design renders the same PNG bytes, an edited field changes the pixels, a
 * repeat request is a cache hit, and the warm render time is printed (target < 1 s). Needs the Amsterdam building tiles
 * (public/data/extracts/amsterdam/building-tiles) and the house-preview atlas (painted on first use, then cached).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import sharp from 'sharp';
import { RenderService } from './render-service.ts';
import { fieldsToDesign } from '../../../src/canalRecall/beltReview/design.ts';

const PAND = '0363100012174416'; // Prinsengracht 148 (the fixture face)
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'belt-review-render-'));
const service = new RenderService(tmp, process.cwd());
after(async () => { service.stop(); await fs.rm(tmp, { recursive: true, force: true }); });

const base = fieldsToDesign({ storeys: { value: 4, source: 'own-read' }, bays: { value: 3, source: 'own-read' }, crown: { value: 'bell', source: 'own-read' }, wallColour: { value: 'red-brown', source: 'own-read' } });
const edited = fieldsToDesign({ storeys: { value: 4, source: 'own-read' }, bays: { value: 3, source: 'own-read' }, crown: { value: 'step', source: 'edit' }, wallColour: { value: 'red-brown', source: 'own-read' } });
const pixels = async (file: string) => (await sharp(file).raw().toBuffer({ resolveWithObject: true }));

describe('render service', () => {
  it('same design gives identical PNG bytes; an edited field changes the pixels; repeat is a cache hit', { timeout: 240_000 }, async () => {
    const a = await service.front(PAND, base, 50, { force: true });
    const b = await service.front(PAND, base, 50, { force: true });
    assert.notEqual(a.file, b.file);
    assert.ok((await fs.readFile(a.file)).equals(await fs.readFile(b.file)), 'same design, different bytes');
    const c = await service.front(PAND, edited, 50, { force: true });
    const [pa, pc] = [await pixels(a.file), await pixels(c.file)];
    let diff = 0;
    if (pa.info.width === pc.info.width && pa.info.height === pc.info.height) for (let i = 0; i < pa.data.length; i++) if (pa.data[i] !== pc.data[i]) diff++;
    else diff = Infinity;
    assert.ok(diff > 500, `bell -> step changed only ${diff} channel values`);
    const first = await service.front(PAND, base, 50);
    const again = await service.front(PAND, base, 50);
    assert.equal(again.cached, true); assert.equal(again.hash, first.hash);
    // Warm latency over a few edits (storeys 3..5), printed for the hand-back.
    for (const storeys of [3, 5, 6]) await service.front(PAND, fieldsToDesign({ storeys: { value: storeys, source: 'edit' }, bays: { value: 3, source: 'x' }, crown: { value: 'neck', source: 'x' } }), 50);
    const s = service.summary();
    console.log(`render latency: cold ${s.coldMs} ms, warm median ${s.warmMedianMs} ms, p90 ${s.warmP90Ms} ms over ${s.warmCount} warm renders; ${s.cacheHits} cache hits`);
    assert.ok(s.warmMedianMs !== null && s.warmMedianMs < 3000, `warm render ${s.warmMedianMs} ms`);
  });
});
