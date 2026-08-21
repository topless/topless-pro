import type { Beach } from '../types';

export function makeBeach(overrides: Partial<Beach> = {}): Beach {
  return {
    slug: 'example-beach',
    name: 'Example Beach',
    countryCode: 'GR',
    countryName: 'Greece',
    latitude: 35,
    longitude: 25,
    dressCode: 'topless-permitted',
    recognition: 'community-reported',
    confidence: 'medium',
    facilities: [],
    ...overrides,
  };
}
