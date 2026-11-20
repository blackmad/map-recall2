// Market likeness poses (lane markets-20261114): market-day panoramas (Gemeente Amsterdam, CC BY 4.0) on the
// Albert Cuypstraat and the Ten Katestraat; `at` is the capture's position, `headingDeg` where the cut looks.
// Used by tests/e2e/market-frames.spec.ts and scripts/markets/frames-sheet.ts.
/** `marketDay`: the pose is a closed / setting-up capture, framed with `?marketDay=` (placer.ts parseMarketDay). */
export type MarketPose = { key: string; pano: string; at: [number, number]; headingDeg: number; lookDownDeg?: number; note: string; marketDay?: string };

export const MARKET_POSES: readonly MarketPose[] = [
  { key: 'cuyp-west-east', pano: 'TMX7316010203-002453_pano_0000_000414', at: [4.89176486, 52.35526017], headingDeg: 69, note: 'Albert Cuypstraat west of Eerste van der Helststraat, looking east; Mon 2022-03-21 08:34, frames up before trading' },
  { key: 'cuyp-mid-east', pano: 'TMX7316010203-001532_pano_0000_000054', at: [4.89533926, 52.35596243], headingDeg: 69, note: 'mid-market looking east; Mon 2020-01-06 09:27, stalls dressed' },
  { key: 'cuyp-mid-west', pano: 'TMX7316010203-002115_pano_0000_002421', at: [4.89552443, 52.35596977], headingDeg: 249, note: 'mid-market looking west; Fri 2021-04-23 10:12' },
  { key: 'cuyp-east-west', pano: 'TMX7316010203-001532_pano_0000_000012', at: [4.89811413, 52.35677162], headingDeg: 249, note: 'east end looking west; Mon 2020-01-06 09:25' },
  { key: 'tenkate-kinker-north', pano: 'b_20241211_0838_Track43_Sphere_00042', at: [4.86755187, 52.36594242], headingDeg: 337, note: 'Ten Katestraat from the Kinkerstraat crossing, looking north; Wed 2024-12-11 12:29' },
  // Lane market-stalls-20261120.
  { key: 'dapper-plein-north', pano: 'TMX7316010203-002593_pano_0000_001027', at: [4.92742816, 52.36266285], headingDeg: 340, note: 'Dappermarkt from the Dapperplein, looking north-west; Mon 2022-06-13 13:27' },
  { key: 'dapper-mid-south', pano: 'recording_2025-09-26_09-39-19_01568', at: [4.92719896, 52.36327026], headingDeg: 160, note: 'Dapperstraat at the Commelinstraat crossing, looking south-east; Fri 2025-09-26 12:22' },
  { key: 'dapper-north-south', pano: 'TMX7316010203-002593_pano_0000_001243', at: [4.92687115, 52.36384650], headingDeg: 160, note: 'Dapperstraat at the Eerste van Swindenstraat, looking south-east; Mon 2022-06-13 13:32' },
  { key: 'dapper-setup-south', pano: 'TMX7316010203-002776_pano_0000_000292', at: [4.92686941, 52.36370740], headingDeg: 160, note: 'Dapperstraat before trading, bare frames, looking south-east; Wed 2022-08-31 08:44', marketDay: 'We@8.7' },
  { key: 'wester-south-east', pano: 'TMX7316010203-001179_pano_0000_000134', at: [4.88282600, 52.37821600], headingDeg: 73, note: 'Westerstraat south carriageway, the median rows on the left, looking east; Mon 2019-05-13 12:31' },
  { key: 'wester-north-west', pano: 'TMX7316010203-001179_pano_0000_000236', at: [4.88232100, 52.37827800], headingDeg: 253, note: 'Westerstraat north carriageway, the median rows on the left, looking west; Mon 2019-05-13 12:33' },
  { key: 'noorder-quay-north', pano: 'TMX7316010203-001178_pano_0001_005039', at: [4.88672000, 52.37900800], headingDeg: 30, note: 'Noordermarkt from the Prinsengracht quay road, the row on the left, looking north-east; Mon 2019-05-13 11:20' },
  { key: 'tenkate-bellamy-south', pano: 'recording_2025-07-31_12-19-21_00077', at: [4.86666915, 52.36726917], headingDeg: 157, note: 'Ten Katestraat from the Bellamystraat crossing, looking south; Thu 2025-07-31 14:22' },
];

/** As-played: the own engine's default chase camera, the rider on the street centreline. */
export const MARKET_RIDES: readonly { key: string; at: [number, number]; headingDeg: number; note: string }[] = [
  { key: 'ride-cuyp-east', at: [4.89435, 52.355725], headingDeg: 66, note: 'riding east down the Albert Cuypstraat, mid-market' },
  { key: 'ride-cuyp-west', at: [4.8975, 52.35655], headingDeg: 249, note: 'riding west from the Sweelinckstraat end' },
  { key: 'ride-dapper-south', at: [4.92665, 52.36420], headingDeg: 160, note: 'riding south-east down the Dapperstraat' },
  { key: 'ride-wester-east', at: [4.88240, 52.37812], headingDeg: 73, note: 'riding east on the Westerstraat south carriageway' },
  { key: 'ride-linden-east', at: [4.88380, 52.38000], headingDeg: 77, note: 'riding east on the Lindengracht south carriageway (layout inferred)' },
  { key: 'ride-tenkate-north', at: [4.86742, 52.36614], headingDeg: 337, note: 'riding north up the Ten Katestraat' },
];
