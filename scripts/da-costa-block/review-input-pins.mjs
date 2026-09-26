/** Immutable fingerprints of packets actually inspected on 2026-09-09.
 * Never derive a replacement pin from new runtime inputs. A changed packet needs
 * fresh visual inspection and a separate opinion artifact, not automatic rebinding.
 */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
export const REVIEW_INPUT_PINS=Object.freeze({
  streetSample:'9c5e3b99b7f27a60a3acc5e293b58bb5539ebfd90a0fd270d73018dd4c15a03e',
  roofPackets:'d548fbe49696da4613176558e22cf47dbcb6b1020d7dee7de2023d5be455e952',
  expandedAerial:'7c775e244ebd842501c20ee298d91eac2dd18a5890afc9d1b797ee4ea52d3372',
  expandedGroundStreet:'8d58e887c19bf5d504a30e8884a40f4aff8de19c7f26240d466fce85e787af2a',
});
export function assertFrozenInput(name,value,expected){
  assert.match(expected,/^[a-f0-9]{64}$/,'An explicit reviewed-input pin is required');
  const bytes=Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value);
  const actual=crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(actual,expected,`Frozen reviewed input changed: ${name}. Refuse to rebind old opinions; inspect a new packet and write a separate finding.`);
}
export async function readFrozenJson(file,pin){const bytes=await fs.readFile(file);assertFrozenInput(file,bytes,pin);return JSON.parse(bytes);}
export function expandedGroundStreetPacket(manifest){
  return ['0363100012237064_e_0tvudm4','0363100012237064_e_1hyy18v'].map(id=>{
    const r=manifest.records.find(r=>r.id===id);assert.ok(r,'Missing frozen reviewed frontage '+id);
    return {id:r.id,derivationKey:r.derivationKey,images:{full:r.images.full,ground:r.images.ground}};
  });
}
