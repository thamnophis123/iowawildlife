import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export type SpeciesOption = {
  id: string;
  commonName: string;
  scientificName: string | null;
  category: string;
  slug: string | null;
};

export type SpeciesSighting = {
  id: string;
  photoUrl: string | null;
  createdAtLabel: string | null;
  category: string | null;
};

export type SpeciesDetail = {
  id: string;
  slug: string;
  commonName: string;
  scientificName: string | null;
  category: string;
  shortSummary: string | null;
  isSensitive: boolean;
  sightings: SpeciesSighting[];
};

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function photoUrlFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  photoPath: string | null,
) {
  if (!photoPath) {
    return null;
  }

  return supabase.storage.from("photos").getPublicUrl(photoPath).data.publicUrl;
}

export async function getSpeciesOptions(): Promise<SpeciesOption[]> {
  if (!getSupabaseEnv()) {
    return [];
  }

  const supabase = await createClient();
  const pageSize = 1000;
  const options: SpeciesOption[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("species")
      .select("id, common_name, scientific_name, category, slug")
      .order("common_name", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error || !data) {
      return options;
    }

    for (const row of data) {
      options.push({
        id: row.id,
        commonName: row.common_name,
        scientificName: row.scientific_name,
        category: row.category,
        slug: row.slug,
      });
    }

    if (data.length < pageSize) {
      break;
    }
  }

  return options;
}

export async function getSpeciesBySlug(
  slug: string,
): Promise<{ species: SpeciesDetail | null; error: string | null }> {
  if (!slug) {
    return { species: null, error: null };
  }

  if (!getSupabaseEnv()) {
    return { species: null, error: "Species are unavailable right now." };
  }

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("species")
    .select(
      "id, slug, common_name, scientific_name, category, short_summary, is_sensitive",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return { species: null, error: error.message };
  }

  if (!row?.slug) {
    return { species: null, error: null };
  }

  const { data: observations, error: observationsError } = await supabase
    .from("observations")
    .select("id, photo_path, created_at, category")
    .eq("species_id", row.id)
    .order("created_at", { ascending: false })
    .limit(24);

  if (observationsError) {
    return { species: null, error: observationsError.message };
  }

  return {
    species: {
      id: row.id,
      slug: row.slug,
      commonName: row.common_name,
      scientificName: row.scientific_name,
      category: row.category,
      shortSummary: row.short_summary,
      isSensitive: Boolean(row.is_sensitive),
      sightings: (observations ?? []).map((observation) => ({
        id: observation.id,
        photoUrl: photoUrlFor(supabase, observation.photo_path),
        createdAtLabel: formatDate(observation.created_at),
        category: observation.category,
      })),
    },
    error: null,
  };
}
