/**
 * Live GPS as a route origin. Distinct from home-address geocode: that is a
 * saved place, this is where the device is now.
 */

import type { GeocodeViewbox } from './cities.ts';

export const GPS_ORIGIN_ID = 'here';

export interface GpsFix {
  lat: number;
  lng: number;
  accuracyM?: number;
}

export type GpsFailureCode =
  | 'unsupported'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'outside-city';

export class GpsOriginError extends Error {
  readonly code: GpsFailureCode;

  constructor(message: string, code: GpsFailureCode) {
    super(message);
    this.name = 'GpsOriginError';
    this.code = code;
  }
}

export type GpsReader = () => Promise<GpsFix>;

/** Nominatim viewbox order: west, north, east, south. */
export function pointInGeocodeViewbox(
  lat: number,
  lng: number,
  box: GeocodeViewbox,
): boolean {
  const [west, north, east, south] = box;
  return lng >= west && lng <= east && lat <= north && lat >= south;
}

export function geolocationFailureCode(code: number): Exclude<GpsFailureCode, 'outside-city' | 'unsupported'> {
  if (code === 1) return 'denied';
  if (code === 3) return 'timeout';
  return 'unavailable';
}

export function describeGpsFailure(code: GpsFailureCode, cityName: string): string {
  if (code === 'denied') {
    return 'Location permission was denied. Allow it for this site, or pick Surprise / Home.';
  }
  if (code === 'timeout') {
    return 'Location request timed out. Try again, or pick Surprise / Home.';
  }
  if (code === 'unsupported') {
    return 'Location needs HTTPS (or localhost) and a browser that can share it.';
  }
  if (code === 'outside-city') {
    return `You're outside ${cityName}. Switch city, or use Home / Surprise.`;
  }
  return 'Could not read your location. Try again, or pick Surprise / Home.';
}

export function gpsOriginPoi(fix: GpsFix): { id: typeof GPS_ORIGIN_ID; name: 'Here'; lat: number; lng: number } {
  return {
    id: GPS_ORIGIN_ID,
    name: 'Here',
    lat: fix.lat,
    lng: fix.lng,
  };
}

export async function resolveGpsOrigin(input: {
  cityName: string;
  viewbox: GeocodeViewbox;
  readFix: GpsReader;
}): Promise<ReturnType<typeof gpsOriginPoi>> {
  const fix = await input.readFix();
  if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lng)) {
    throw new GpsOriginError(describeGpsFailure('unavailable', input.cityName), 'unavailable');
  }
  if (!pointInGeocodeViewbox(fix.lat, fix.lng, input.viewbox)) {
    throw new GpsOriginError(describeGpsFailure('outside-city', input.cityName), 'outside-city');
  }
  return gpsOriginPoi(fix);
}

type GeoLike = {
  getCurrentPosition: (
    success: (position: { coords: { latitude: number; longitude: number; accuracy?: number } }) => void,
    error?: (error: { code: number; message?: string }) => void,
    options?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number },
  ) => void;
};

export function browserGpsReader(geo: GeoLike | undefined, secure: boolean): GpsReader {
  return () => new Promise((resolve, reject) => {
    if (!secure || !geo) {
      reject(new GpsOriginError(describeGpsFailure('unsupported', ''), 'unsupported'));
      return;
    }
    geo.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        });
      },
      (error) => {
        const code = geolocationFailureCode(error.code);
        reject(new GpsOriginError(describeGpsFailure(code, ''), code));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
    );
  });
}
