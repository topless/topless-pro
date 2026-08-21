import type { Beach, Confidence, DressCode, Recognition } from '../types';

export const DRESS_CODES: readonly DressCode[] = [
  'swimwear-required',
  'topless-permitted',
  'clothing-optional',
  'nudity-permitted',
  'unknown',
];
export const RECOGNITIONS: readonly Recognition[] = ['official', 'tolerated', 'community-reported', 'disputed'];
export const CONFIDENCES: readonly Confidence[] = ['high', 'medium', 'low'];

export const dressCodeLabels: Record<DressCode, string> = {
  'swimwear-required': 'Swimwear required',
  'topless-permitted': 'Topless permitted',
  'clothing-optional': 'Clothing optional',
  'nudity-permitted': 'Nudity permitted',
  unknown: 'Unknown',
};

export const recognitionLabels: Record<Recognition, string> = {
  official: 'Official designation',
  tolerated: 'Commonly tolerated',
  'community-reported': 'Community reported',
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
  'nudity-permitted': 'Nude bathing is accepted, usually in one part of the beach. The rest is an ordinary beach.',
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
  low: 'Tentative, old, vague, or based on a single weak report.',
};

export function formatBeachLocation(beach: Pick<Beach, 'municipality' | 'region' | 'countryName'>): string {
  return [...new Set([beach.municipality, beach.region, beach.countryName].filter(Boolean))].join(', ');
}

export function formatBeachTitle(beach: Pick<Beach, 'name' | 'countryName'>): string {
  return `${beach.name}, ${beach.countryName} — topless.pro`;
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

/** Formats an ISO date (YYYY-MM-DD) for display; UTC so the day never rolls back. */
export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(`${iso}T00:00:00Z`));
}

/** Short form for list rows: "Jul 2026". */
export function formatMonthYear(iso: string): string {
  return monthFormatter.format(new Date(`${iso}T00:00:00Z`));
}
