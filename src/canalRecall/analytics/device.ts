/**
 * Coarse device class and performance tier for analytics. Only the resulting
 * token leaves the browser; the user-agent string and touch count are read
 * locally and dropped.
 */
import type { DEVICES, PERF_TIERS } from './schema';

export type DeviceClass = (typeof DEVICES)[number];
export type PerfTier = (typeof PERF_TIERS)[number];

export interface DeviceHints {
  userAgent: string;
  /** `navigator.userAgentData.mobile`, where the browser offers it. */
  mobile?: boolean;
  /** `navigator.maxTouchPoints`; iPadOS reports a Mac user agent. */
  maxTouchPoints?: number;
}

export function deviceClass(hints: DeviceHints): DeviceClass {
  const ua = hints.userAgent || '';
  if (/iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua)) return 'tablet';
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return 'tablet';
  if (/Macintosh/i.test(ua) && (hints.maxTouchPoints ?? 0) > 1) return 'tablet';
  if (hints.mobile === true) return 'phone';
  if (/Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua)) return 'phone';
  return 'desktop';
}

/** The shape of `RenderGovernor` this reads (vectorMap._renderGovernor). */
export interface GovernorLike {
  steps?: ReadonlyArray<{ kind: string }>;
  pixelRatio?: number;
}

/**
 * smooth: the governor never stepped; reduced: it gave up pixel ratio or
 * shadows; floor: it reached the sub-1x last resort. No governor: unknown.
 */
export function perfTier(governor: GovernorLike | null | undefined): PerfTier {
  if (!governor || !Array.isArray(governor.steps)) return 'unknown';
  if (typeof governor.pixelRatio === 'number' && governor.pixelRatio < 1) return 'floor';
  return governor.steps.length > 0 ? 'reduced' : 'smooth';
}
