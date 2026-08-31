export const CATEGORIES = [
  "bird",
  "mammal",
  "reptile",
  "amphibian",
  "fish",
  "insect",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  bird: "Bird",
  mammal: "Mammal",
  reptile: "Reptile",
  amphibian: "Amphibian",
  fish: "Fish",
  insect: "Insect / spider",
  other: "Other (crustacean, mollusk, etc.)",
};

export function categoryLabel(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  if (value in CATEGORY_LABELS) {
    return CATEGORY_LABELS[value as Category];
  }

  return value;
}
