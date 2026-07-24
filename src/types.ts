export type DressCode =
  | 'swimwear-required'
  | 'topless-permitted'
  | 'clothing-optional'
  | 'nudity-permitted'
  | 'unknown';

export type Recognition = 'official' | 'tolerated' | 'community-reported' | 'disputed';
export type Confidence = 'low' | 'medium' | 'high';

export interface Beach {
  id: string;
  slug: string;
  name: string;
  countryCode: string;
  countryName: string;
  region?: string;
  municipality?: string;
  latitude: number;
  longitude: number;
  dressCode: DressCode;
  recognition: Recognition;
  confidence: Confidence;
  summary?: string;
  facilities: string[];
  sourceUrl?: string;
  lastVerifiedAt?: string;
}
