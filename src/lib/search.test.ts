import { describe, expect, it } from 'vitest';
import { foldSearchText } from './search';

describe('foldSearchText', () => {
  it('matches unaccented queries against accented names', () => {
    expect(foldSearchText('Kallithéa')).toBe('kallithea');
    expect(foldSearchText('Ammoulianí')).toBe('ammouliani');
  });

  it('normalises typographic apostrophes', () => {
    expect(foldSearchText('Cap d’Agde')).toBe("cap d'agde");
  });

  it('leaves plain ascii untouched apart from case', () => {
    expect(foldSearchText('Sithonia')).toBe('sithonia');
  });
});
