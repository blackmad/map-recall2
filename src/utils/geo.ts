import { City, DistanceUnit } from '../types';

/**
 * Finds the nearest supported city to a given [lat, lng] coordinate
 */
export function findNearestCity(
  userCoord: [number, number],
  cities: City[]
): { city: City; distanceMeters: number } {
  let nearestCity = cities[0];
  let minDistance = calculateHaversineDistanceMeters(userCoord, cities[0].center);

  for (let i = 1; i < cities.length; i++) {
    const d = calculateHaversineDistanceMeters(userCoord, cities[i].center);
    if (d < minDistance) {
      minDistance = d;
      nearestCity = cities[i];
    }
  }

  return { city: nearestCity, distanceMeters: minDistance };
}

/**
 * Calculates distance between two [lat, lng] coordinates in meters using Haversine formula
 */
export function calculateHaversineDistanceMeters(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const [lat1, lon1] = coord1;
  const [lat2, lon2] = coord2;

  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Distance from point to a line segment in meters
 */
function distToSegmentMeters(
  p: [number, number],
  v: [number, number],
  w: [number, number]
): number {
  // Approximate using flat projection for local segments
  const latFactor = 111320; // meters per degree lat
  const lngFactor = 111320 * Math.cos(((p[0] + v[0] + w[0]) / 3 / 180) * Math.PI);

  const px = (p[1] - v[1]) * lngFactor;
  const py = (p[0] - v[0]) * latFactor;
  const wx = (w[1] - v[1]) * lngFactor;
  const wy = (w[0] - v[0]) * latFactor;

  const l2 = wx * wx + wy * wy;
  if (l2 === 0) return calculateHaversineDistanceMeters(p, v);

  let t = (px * wx + py * wy) / l2;
  t = Math.max(0, Math.min(1, t));

  const projLat = v[0] + t * (w[0] - v[0]);
  const projLng = v[1] + t * (w[1] - v[1]);

  return calculateHaversineDistanceMeters(p, [projLat, projLng]);
}

/**
 * Calculates shortest distance from point to a street/feature.
 * If path coordinates are provided, it finds minimum distance to any point along the street.
 */
export function calculateShortestDistanceToFeature(
  userCoord: [number, number],
  centerCoord: [number, number],
  path?: [number, number][],
  paths?: [number, number][][]
): number {
  const allPolylines: [number, number][][] = [];
  if (paths && paths.length > 0) {
    allPolylines.push(...paths.filter((p) => p && p.length >= 2));
  } else if (path && path.length >= 2) {
    allPolylines.push(path);
  }

  if (allPolylines.length === 0) {
    return calculateHaversineDistanceMeters(userCoord, centerCoord);
  }

  let minDistance = calculateHaversineDistanceMeters(userCoord, centerCoord);

  for (const line of allPolylines) {
    for (let i = 0; i < line.length - 1; i++) {
      const segDist = distToSegmentMeters(userCoord, line[i], line[i + 1]);
      if (segDist < minDistance) {
        minDistance = segDist;
      }
    }
  }

  return Math.round(minDistance);
}

/**
 * Calculates score (0 - 5000) based on distance error in meters
 */
export function calculatePinpointScore(distanceMeters: number): {
  score: number;
  accuracyPercentage: number;
  tier: 'bullseye' | 'excellent' | 'great' | 'good' | 'fair' | 'miss';
  tierLabel: string;
  tierColor: string;
} {
  // Score formula: exponential decay from 5000 down to 0
  // <= 30m: 5000 pts (100%)
  // 100m: ~4800 pts (96%)
  // 300m: ~4200 pts (84%)
  // 800m: ~3000 pts (60%)
  // 2000m: ~1200 pts (24%)
  // 5000m: ~150 pts (3%)
  // > 6000m: 0 pts

  let score = 0;
  if (distanceMeters <= 30) {
    score = 5000;
  } else {
    // 5000 * e^(-dist / 1400)
    score = Math.round(5000 * Math.exp(-distanceMeters / 1500));
    if (score < 0) score = 0;
  }

  const accuracyPercentage = Math.max(0, Math.min(100, Math.round((score / 5000) * 100)));

  if (distanceMeters <= 60) {
    return {
      score,
      accuracyPercentage,
      tier: 'bullseye',
      tierLabel: 'Bullseye! Pinpoint Accuracy',
      tierColor: 'text-emerald-600 dark:text-emerald-400',
    };
  } else if (distanceMeters <= 250) {
    return {
      score,
      accuracyPercentage,
      tier: 'excellent',
      tierLabel: 'Spectacular Guess!',
      tierColor: 'text-teal-600 dark:text-teal-400',
    };
  } else if (distanceMeters <= 600) {
    return {
      score,
      accuracyPercentage,
      tier: 'great',
      tierLabel: 'Great Intuition',
      tierColor: 'text-blue-600 dark:text-blue-400',
    };
  } else if (distanceMeters <= 1400) {
    return {
      score,
      accuracyPercentage,
      tier: 'good',
      tierLabel: 'Close Vicinity',
      tierColor: 'text-amber-600 dark:text-amber-400',
    };
  } else if (distanceMeters <= 3000) {
    return {
      score,
      accuracyPercentage,
      tier: 'fair',
      tierLabel: 'Right Neighborhood',
      tierColor: 'text-orange-600 dark:text-orange-400',
    };
  } else {
    return {
      score,
      accuracyPercentage,
      tier: 'miss',
      tierLabel: 'A Bit Off Course',
      tierColor: 'text-rose-600 dark:text-rose-400',
    };
  }
}

/**
 * Format distance in Metric or Imperial units
 */
export function formatDistance(distanceMeters: number, unit: DistanceUnit = 'metric'): string {
  if (unit === 'imperial') {
    const feet = distanceMeters * 3.28084;
    if (feet < 1000) {
      return `${Math.round(feet)} ft`;
    }
    const miles = feet / 5280;
    return `${miles.toFixed(miles < 10 ? 2 : 1)} mi`;
  }

  // Metric
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }
  const km = distanceMeters / 1000;
  return `${km.toFixed(km < 10 ? 2 : 1)} km`;
}
