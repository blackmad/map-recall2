/**
 * Which photographs a neighbourhood's "Greetings from" postcard is cut from
 * (composed by src/mapRecall/livePostcard.ts).
 */
import type { StreetFeature } from '../types';
import { CITIES } from '../data/cities';

export const POSTCARD_MAX_PHOTOS = 8;

/** The area's own image first, then photographs taken in it, up to eight. */
export function postcardPhotosFor(feature: Pick<StreetFeature, 'type' | 'wikipediaImageUrl' | 'areaPhotos'>): string[] {
  if (feature.type !== 'neighborhood') return [];
  const photos = [feature.wikipediaImageUrl, ...(feature.areaPhotos ?? []).map((place) => place.photo.imageUrl)]
    .filter((url): url is string => !!url)
    .slice(0, POSTCARD_MAX_PHOTOS);
  return photos;
}

/** The caption under the name ("AMSTERDAM"), as the card has always printed it. */
export const postcardCityName = (cityId: string | undefined): string | undefined =>
  CITIES.find((city) => city.id === cityId)?.name;
