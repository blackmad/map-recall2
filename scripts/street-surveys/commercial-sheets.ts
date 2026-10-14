/**
 * One pand-reference contact sheet per side of a surveyed street, in street order:
 *   node --import tsx scripts/street-surveys/commercial-sheets.ts --street=Kinkerstraat
 * -> artifacts/pand-reference/contact-<street>-{odd,even}.png
 */
import fs from 'node:fs/promises';
import {buildContactSheet} from '../pand-reference/contact.ts';

const street = (process.argv.find(a => a.startsWith('--street=')) ?? '--street=Kinkerstraat').slice(9);
const doc = JSON.parse(await fs.readFile(`scripts/street-surveys/streets/${street.toLowerCase()}.json`, 'utf8'));
for (const side of ['odd', 'even']) {
  const ids = doc.pands.filter((p: any) => p.side === side && p.crop).sort((a: any, b: any) => a.numbers[0] - b.numbers[0]).map((p: any) => p.pandId);
  await buildContactSheet(`${street.toLowerCase()}-${side}`, 'staging/pand-reference', ids);
}
