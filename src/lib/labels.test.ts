import { describe, expect, it } from 'vitest';
import { formatBeachLocation, formatDate } from './labels';

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
  });
});
