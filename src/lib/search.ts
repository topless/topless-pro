/**
 * Fold text for search comparison: strip diacritics and normalise
 * typographic apostrophes so "kallithea" matches "Kallithéa" and
 * "d'agde" matches "Cap d’Agde".
 */
export function foldSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʼ]/g, "'")
    .toLowerCase();
}
