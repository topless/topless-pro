import type { Beach, Confidence, DressCode, Recognition } from '../types';

// Site-wide copy shared by the SPA, the Worker's injected metadata and the
// static shell, so the product is described the same way everywhere.
export const SITE_TITLE = 'topless.pro — Beach dress codes: official, tolerated or disputed';
export const SITE_DESCRIPTION = 'Beach-by-beach guidance on topless and nude bathing — the official rule, the local custom and the source, kept separate. Starting in Greece.';
export const ABOUT_TITLE = 'How we classify beaches — topless.pro';
export const ABOUT_DESCRIPTION = 'How topless.pro labels beaches: official rules, local custom and unconfirmed reports kept apart, with a confidence level for each.';
export const REPO_URL = 'https://github.com/topless/topless-pro';

export const DRESS_CODES: readonly DressCode[] = [
  'swimwear-required',
  'topless-permitted',
  'clothing-optional',
  'nudity-permitted',
  'unknown',
];
export const RECOGNITIONS: readonly Recognition[] = ['official', 'tolerated', 'community-reported', 'disputed'];
export const CONFIDENCES: readonly Confidence[] = ['high', 'medium', 'low'];

// Dress code says what happens here; recognition says how firm that is. The
// dress labels deliberately avoid permission verbs so the two read sensibly
// side by side ("Swimwear expected · Local custom", never "required · tolerated").
export const dressCodeLabels: Record<DressCode, string> = {
  'swimwear-required': 'Swimwear expected',
  'topless-permitted': 'Topless accepted',
  'clothing-optional': 'Clothing optional',
  'nudity-permitted': 'Nudity accepted',
  unknown: 'Unknown',
};

export const recognitionLabels: Record<Recognition, string> = {
  official: 'Official',
  tolerated: 'Local custom',
  'community-reported': 'Unconfirmed report',
  disputed: 'Disputed',
};

export const confidenceLabels: Record<Confidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

// One-line, visitor-facing definitions. Rendered beside the labels on the
// beach page, the launch-state legend and the About page so the taxonomy is
// explained wherever it is used, from one place.
export const dressCodeDescriptions: Record<DressCode, string> = {
  'swimwear-required': 'Keep swimwear on. Topless or nude bathing isn’t the norm here.',
  'topless-permitted': 'Women sunbathing topless is normal here. Full nudity isn’t expected.',
  'clothing-optional': 'Nude and clothed bathers share the whole beach, and neither stands out.',
  'nudity-permitted': 'Nude bathing is accepted in a recognisable part of the beach — an end, a cove, beyond a marker. The rest is an ordinary beach.',
  unknown: 'Not enough evidence to say.',
};

export const recognitionDescriptions: Record<Recognition, string> = {
  official: 'A public authority, signage or the beach operator says so.',
  tolerated: 'Established and consistently accepted in local practice, but nothing official says so.',
  'community-reported': 'A visitor or a listing says so; we haven’t confirmed it’s established practice.',
  disputed: 'Reliable reports conflict.',
};

export const confidenceDescriptions: Record<Confidence, string> = {
  high: 'Recent, specific and well-supported.',
  medium: 'Credible but limited, or not recently re-checked.',
  low: 'Tentative, old, vague or based on a single weak report.',
};

export function formatBeachLocation(beach: Pick<Beach, 'municipality' | 'region' | 'countryName'>): string {
  return [...new Set([beach.municipality, beach.region, beach.countryName].filter(Boolean))].join(', ');
}

/** Search-result title: the place people search for and the answer they came for. */
export function formatBeachTitle(
  beach: Pick<Beach, 'name' | 'municipality' | 'region' | 'countryName' | 'dressCode'>,
): string {
  const place = beach.municipality ?? beach.region ?? beach.countryName;
  // Out of context, a bare 'Unknown' does not say what is unknown.
  const answer = beach.dressCode === 'unknown' ? 'Dress code unknown' : dressCodeLabels[beach.dressCode];
  return `${beach.name}, ${place}: ${answer} — topless.pro`;
}

export function sourceHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthFormatter = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });

function parseIsoDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Formats an ISO date (YYYY-MM-DD) for display; UTC so the day never rolls back. Unparseable input is shown as-is. */
export function formatDate(iso: string): string {
  const date = parseIsoDate(iso);
  return date ? dateFormatter.format(date) : iso;
}

/** Short form for list rows: "Jul 2026". */
export function formatMonthYear(iso: string): string {
  const date = parseIsoDate(iso);
  return date ? monthFormatter.format(date) : iso;
}
