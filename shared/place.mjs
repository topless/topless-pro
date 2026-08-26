// Place names → search keys and the folder names under data/. One implementation shared by
// the validator (Node), the Worker and the SPA, so the history link the site shows and the
// folder the editor created can never disagree.

// Common European letters with no canonical decomposition.
const NON_DECOMPOSING = {
  'ø': 'o',
  'æ': 'ae',
  'œ': 'oe',
  'ß': 'ss',
  'đ': 'd',
  'ł': 'l',
  'ð': 'd',
  'þ': 'th',
};
const NON_DECOMPOSING_RE = new RegExp(`[${Object.keys(NON_DECOMPOSING).join('')}]`, 'g');

/**
 * Fold text for comparison: lower-case, strip diacritics, map the letters above and
 * normalise typographic apostrophes, so "kallithea" matches "Kallithéa", "malmo"
 * matches "Malmø" and "d'agde" matches "Cap d’Agde".
 */
export function foldSearchText(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(NON_DECOMPOSING_RE, (ch) => NON_DECOMPOSING[ch])
    .replace(/[‘’ʼ]/g, "'");
}

/** "Chalkidiki" → "chalkidiki", "Neos Marmaras" → "neos-marmaras", "Cap d’Agde" → "cap-d-agde". */
export function placeSlug(value) {
  return foldSearchText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** The repo-relative path of the candidate file a scope belongs in. */
export function dataFilePath({ countryCode, region }) {
  return `data/${countryCode.toLowerCase()}/${placeSlug(region)}/beaches.json`;
}
