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

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

export function categoryLabel(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  if (isCategory(value)) {
    return CATEGORY_LABELS[value];
  }

  return value;
}
