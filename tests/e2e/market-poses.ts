// Market likeness poses (lane markets-20261114): market-day panoramas (Gemeente Amsterdam, CC BY 4.0) on the
// Albert Cuypstraat and the Ten Katestraat; `at` is the capture's position, `headingDeg` where the cut looks.
// Used by tests/e2e/market-frames.spec.ts and scripts/markets/frames-sheet.ts.
export type MarketPose = { key: string; pano: string; at: [number, number]; headingDeg: number; lookDownDeg?: number; note: string };

export const MARKET_POSES: readonly MarketPose[] = [
  { key: 'cuyp-west-east', pano: 'TMX7316010203-002453_pano_0000_000414', at: [4.89176486, 52.35526017], headingDeg: 69, note: 'Albert Cuypstraat west of Eerste van der Helststraat, looking east; Mon 2022-03-21 08:34, frames up before trading' },
  { key: 'cuyp-mid-east', pano: 'TMX7316010203-001532_pano_0000_000054', at: [4.89533926, 52.35596243], headingDeg: 69, note: 'mid-market looking east; Mon 2020-01-06 09:27, stalls dressed' },
  { key: 'cuyp-mid-west', pano: 'TMX7316010203-002115_pano_0000_002421', at: [4.89552443, 52.35596977], headingDeg: 249, note: 'mid-market looking west; Fri 2021-04-23 10:12' },
  { key: 'cuyp-east-west', pano: 'TMX7316010203-001532_pano_0000_000012', at: [4.89811413, 52.35677162], headingDeg: 249, note: 'east end looking west; Mon 2020-01-06 09:25' },
  { key: 'tenkate-kinker-north', pano: 'b_20241211_0838_Track43_Sphere_00042', at: [4.86755187, 52.36594242], headingDeg: 337, note: 'Ten Katestraat from the Kinkerstraat crossing, looking north; Wed 2024-12-11 12:29' },
  { key: 'tenkate-bellamy-south', pano: 'recording_2025-07-31_12-19-21_00077', at: [4.86666915, 52.36726917], headingDeg: 157, note: 'Ten Katestraat from the Bellamystraat crossing, looking south; Thu 2025-07-31 14:22' },
];

/** As-played: the own engine's default chase camera, the rider on the street centreline. */
export const MARKET_RIDES: readonly { key: string; at: [number, number]; headingDeg: number; note: string }[] = [
  { key: 'ride-cuyp-east', at: [4.89435, 52.355725], headingDeg: 66, note: 'riding east down the Albert Cuypstraat, mid-market' },
  { key: 'ride-cuyp-west', at: [4.8975, 52.35655], headingDeg: 249, note: 'riding west from the Sweelinckstraat end' },
  { key: 'ride-tenkate-north', at: [4.86742, 52.36614], headingDeg: 337, note: 'riding north up the Ten Katestraat' },
];
