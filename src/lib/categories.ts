export const CATEGORIES = [
  "bird",
  "mammal",
  "reptile",
  "amphibian",
  "fish",
  "insect",
  "plant",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];
