// Which Commons licences the sculpture pipeline may train on and ship.
// Open data only (project rule): public domain / CC0, CC BY, CC BY-SA, any
// version or port. NC and ND variants, fair use and "all rights reserved"
// are refused, as is anything unrecognised.

export type LicenceVerdict = { admitted: boolean; reason?: string };

export function admitLicence(raw: string | null | undefined): LicenceVerdict {
  const s = String(raw ?? '').trim();
  if (!s) return { admitted: false, reason: 'no licence recorded' };
  const l = s.toLowerCase();
  if (/\bnc\b|non-?commercial/.test(l)) return { admitted: false, reason: `non-commercial (${s})` };
  if (/\bnd\b|no-?deriv/.test(l)) return { admitted: false, reason: `no-derivatives (${s})` };
  if (/fair use|all rights reserved|copyrighted/.test(l)) return { admitted: false, reason: `not open (${s})` };
  if (/^(cc0|public domain|pd\b|pd-)/.test(l) || l === 'pd') return { admitted: true };
  if (/^cc[ -]by(-sa)?([ -]\d(\.\d)?)?/.test(l)) return { admitted: true };
  return { admitted: false, reason: `unrecognised licence (${s})` };
}
