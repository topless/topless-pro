import { describe, expect, it } from 'vitest';
import { formatBeachLocation, formatBeachTitle, formatDate } from './labels';

describe('formatDate', () => {
  it('formats ISO dates without rolling the day back in western time zones', () => {
    expect(formatDate('2026-07-21')).toBe('21 July 2026');
    expect(formatDate('2026-01-01')).toBe('1 January 2026');
  });
});

describe('formatBeachLocation', () => {
  it('omits missing parts without leaving separators behind', () => {
    expect(formatBeachLocation({ countryName: 'Greece' })).toBe('Greece');
    expect(formatBeachLocation({ municipality: 'Sithonia', countryName: 'Greece' })).toBe('Sithonia, Greece');
    expect(formatBeachLocation({ municipality: 'Sithonia', region: 'Chalkidiki', countryName: 'Greece' })).toBe('Sithonia, Chalkidiki, Greece');
    expect(formatBeachLocation({ municipality: 'Geneva', region: 'Geneva', countryName: 'Switzerland' })).toBe('Geneva, Switzerland');
  });
});

describe('formatBeachTitle', () => {
  it('puts the searched-for place and the answer in the title', () => {
    expect(formatBeachTitle({ name: 'Kavourotrypes', municipality: 'Sithonia', region: 'Chalkidiki', countryName: 'Greece', dressCode: 'nudity-permitted' }))
      .toBe('Kavourotrypes, Sithonia: Nudity accepted — topless.pro');
    expect(formatBeachTitle({ name: 'Red Beach', countryName: 'Greece', dressCode: 'unknown' }))
      .toBe('Red Beach, Greece: Unknown — topless.pro');
  });
});
