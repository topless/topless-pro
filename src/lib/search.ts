/**
 * Fold text for search comparison: strip diacritics, map the common
 * European letters that have no canonical decomposition, and normalise
 * typographic apostrophes so "kallithea" matches "Kallithéa", "malmo"
 * matches "Malmø" and "d'agde" matches "Cap d’Agde".
 */
const NON_DECOMPOSING: Record<string, string> = {
  "\u00f8": 'o',
  "\u00e6": 'ae',
  "\u0153": 'oe',
  "\u00df": 'ss',
  "\u0111": 'd',
  "\u0142": 'l',
  "\u00f0": 'd',
  "\u00fe": 'th',
};

const NON_DECOMPOSING_RE = new RegExp(`[${Object.keys(NON_DECOMPOSING).join('')}]`, 'g');

export function foldSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(NON_DECOMPOSING_RE, (ch) => NON_DECOMPOSING[ch])
    .replace(/[\u2018\u2019\u02bc]/g, "'");
}
