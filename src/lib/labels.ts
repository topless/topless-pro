import type { Beach, Confidence, DressCode, Recognition } from '../types';

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

export function formatBeachLocation(beach: Pick<Beach, 'municipality' | 'region' | 'countryName'>): string {
  return [beach.municipality ?? beach.region, beach.countryName].filter(Boolean).join(', ');
}
