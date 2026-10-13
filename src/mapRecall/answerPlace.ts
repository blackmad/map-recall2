/**
 * Where the answer is, said once it is revealed: the "Where it is" line on the answer card and
 * the district on its postcard, both from the locate hints (src/mapRecall/locateHints.ts) that
 * otherwise only show when the player asks for a hint (review 2026-10-13).
 */
import type { LocateHint } from './locateHints';
import { revealsAnswer } from './locateHints';

const flat = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const sentenceBody = (text: string) => text.replace(/\.$/, '');

/**
 * One line after the answer from the locate hints: district · quarter · the nearest landmark
 * relation (or the water when there is no landmark). Parts naming the answer are dropped.
 */
export function whereItIs(hints: readonly LocateHint[], featureName: string): string | undefined {
  const usable = hints.filter((hint) => hint.reference.split(' + ').every((reference) => !revealsAnswer(reference, featureName)));
  const parts: string[] = [];
  const district = usable.find((hint) => hint.kind === 'district');
  if (district) parts.push(`${district.reference} district`);
  const quarter = usable.find((hint) => hint.kind === 'part-of');
  if (quarter) parts.push(`part of ${quarter.reference}`);
  const place = usable.find((hint) => hint.kind === 'inside') ?? usable.find((hint) => hint.kind === 'near')
    ?? usable.find((hint) => hint.kind === 'water') ?? usable.find((hint) => hint.kind === 'borders');
  if (place) {
    const body = sentenceBody(place.text);
    const inside = /^(.*) (?:is|are) inside it$/.exec(body);
    const runsThrough = /^(.*) runs through it$/.exec(body);
    parts.push(inside ? `home to ${lowerFirst(inside[1])}`
      : runsThrough ? `${lowerFirst(runsThrough[1])} runs through it`
      : lowerFirst(body.replace(/^It's\s+/, '').replace(/^It\s+/, '')));
  }
  if (!parts.length) return undefined;
  const line = parts.join(' · ');
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/** The caption under the postcard's name: "Zuid · Amsterdam", or the city alone. */
export function postcardCaption(cityName: string | undefined, district: string | undefined, featureName: string): string | undefined {
  if (!cityName || !district || revealsAnswer(district, featureName) || flat(district) === flat(cityName)) return cityName;
  return `${district} · ${cityName}`;
}

/** The district a postcard caption names: the stadsdeel, else the quarter. */
export function captionDistrict(hints: readonly LocateHint[]): string | undefined {
  return hints.find((hint) => hint.kind === 'district')?.reference ?? hints.find((hint) => hint.kind === 'part-of')?.reference;
}

