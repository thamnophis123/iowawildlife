export type SpeciesNameRow = {
  id: string;
  commonName: string;
  scientificName: string | null;
  inatTaxonId: number | null;
};

export function titleCaseCommonName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/(^|[\s-/])([a-z])/g, (_match, sep: string, char: string) => {
      return `${sep}${char.toUpperCase()}`;
    });
}

export function looksLikeSpeciesCommonName(
  commonName: string,
  scientificName: string | null,
) {
  const name = commonName.trim();
  if (!name) {
    return false;
  }

  if (scientificName && name.toLowerCase() === scientificName.toLowerCase()) {
    return false;
  }

  if (/[()]/.test(name)) {
    return false;
  }

  if (/\b(ssp\.?|subsp\.?|subspecies|var\.?|variety|forma?)\b/i.test(name)) {
    return false;
  }

  return true;
}

function preferSpeciesRow<T extends SpeciesNameRow>(a: T, b: T): T {
  const aLooks = looksLikeSpeciesCommonName(a.commonName, a.scientificName);
  const bLooks = looksLikeSpeciesCommonName(b.commonName, b.scientificName);

  if (aLooks !== bLooks) {
    return aLooks ? a : b;
  }

  const aTaxon = a.inatTaxonId;
  const bTaxon = b.inatTaxonId;

  if (aTaxon != null && bTaxon != null && aTaxon !== bTaxon) {
    return aTaxon < bTaxon ? a : b;
  }

  if (aTaxon != null && bTaxon == null) {
    return a;
  }

  if (bTaxon != null && aTaxon == null) {
    return b;
  }

  return a.id < b.id ? a : b;
}

export function dedupeSpeciesByScientificName<T extends SpeciesNameRow>(
  rows: T[],
): T[] {
  const byScientificName = new Map<string, T>();
  const withoutScientificName: T[] = [];

  for (const row of rows) {
    const key = row.scientificName?.trim().toLowerCase() ?? "";
    if (!key) {
      withoutScientificName.push(row);
      continue;
    }

    const existing = byScientificName.get(key);
    if (!existing) {
      byScientificName.set(key, row);
      continue;
    }

    byScientificName.set(key, preferSpeciesRow(existing, row));
  }

  return [...byScientificName.values(), ...withoutScientificName];
}
