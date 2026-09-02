import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import {
  dedupeSpeciesByScientificName,
  titleCaseCommonName,
} from "@/lib/species-names";

export type SpeciesOption = {
  id: string;
  commonName: string;
  scientificName: string | null;
  category: string;
  slug: string | null;
  inatTaxonId: number | null;
};

export type SpeciesSighting = {
  id: string;
  photoUrl: string | null;
  createdAtLabel: string | null;
  category: string | null;
  lat: number | null;
  lng: number | null;
};

export type SpeciesDetail = {
  id: string;
  slug: string;
  commonName: string;
  scientificName: string | null;
  category: string;
  status: string | null;
  shortSummary: string | null;
  idTips: string | null;
  habitat: string | null;
  similarSpecies: string | null;
  sourceUrls: string[];
  inatTaxonId: number | null;
  isSensitive: boolean;
  imageUrl: string | null;
  imageAttribution: string | null;
  imageLicense: string | null;
  imageSourceUrl: string | null;
  sightings: SpeciesSighting[];
};

export type SpeciesIndexItem = {
  id: string;
  slug: string;
  commonName: string;
  scientificName: string | null;
  category: string;
  status: string | null;
  hasAccountText: boolean;
  onTheMap: boolean;
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

function textOrNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function sourceUrlsFrom(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
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
      .select("id, common_name, scientific_name, category, slug, inat_taxon_id")
      .order("common_name", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error || !data) {
      break;
    }

    for (const row of data) {
      options.push({
        id: row.id,
        commonName: titleCaseCommonName(row.common_name),
        scientificName: row.scientific_name,
        category: row.category,
        slug: row.slug,
        inatTaxonId: row.inat_taxon_id,
      });
    }

    if (data.length < pageSize) {
      break;
    }
  }

  return dedupeSpeciesByScientificName(options).sort((a, b) =>
    a.commonName.localeCompare(b.commonName, "en"),
  );
}

export async function getSpeciesIndex(): Promise<{
  species: SpeciesIndexItem[];
  error: string | null;
}> {
  if (!getSupabaseEnv()) {
    return { species: [], error: "Species are unavailable right now." };
  }

  const supabase = await createClient();
  const pageSize = 1000;
  const rows: {
    id: string;
    slug: string | null;
    common_name: string;
    scientific_name: string | null;
    category: string;
    status: string | null;
    short_summary: string | null;
    inat_taxon_id: number | null;
  }[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("species")
      .select(
        "id, slug, common_name, scientific_name, category, status, short_summary, inat_taxon_id",
      )
      .not("slug", "is", null)
      .neq("slug", "")
      .order("common_name", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      return { species: [], error: error.message };
    }

    if (!data?.length) {
      break;
    }

    for (const row of data) {
      rows.push(row);
    }

    if (data.length < pageSize) {
      break;
    }
  }

  const onTheMap = new Set<string>();

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("observations")
      .select("species_id")
      .not("species_id", "is", null)
      .range(from, from + pageSize - 1);

    if (error) {
      return { species: [], error: error.message };
    }

    if (!data?.length) {
      break;
    }

    for (const row of data) {
      if (row.species_id) {
        onTheMap.add(row.species_id);
      }
    }

    if (data.length < pageSize) {
      break;
    }
  }

  const withNames = rows
    .filter((row): row is typeof row & { slug: string } => Boolean(row.slug))
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      commonName: titleCaseCommonName(row.common_name),
      scientificName: textOrNull(row.scientific_name),
      category: row.category,
      status: textOrNull(row.status),
      hasAccountText: Boolean(textOrNull(row.short_summary)),
      onTheMap: onTheMap.has(row.id),
      inatTaxonId: numberOrNull(row.inat_taxon_id),
    }));

  const species = dedupeSpeciesByScientificName(withNames)
    .sort((a, b) => a.commonName.localeCompare(b.commonName, "en"))
    .map((item) => ({
      id: item.id,
      slug: item.slug,
      commonName: item.commonName,
      scientificName: item.scientificName,
      category: item.category,
      status: item.status,
      hasAccountText: item.hasAccountText,
      onTheMap: item.onTheMap,
    }));

  return { species, error: null };
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
  const detailColumns =
    "id, slug, common_name, scientific_name, category, status, short_summary, id_tips, habitat, similar_species, source_urls, inat_taxon_id, is_sensitive, image_url, image_attribution, image_license, image_source_url";
  let { data: row, error } = await supabase
    .from("species")
    .select(detailColumns)
    .eq("slug", slug)
    .maybeSingle();

  if (
    error?.message.includes("image_url") ||
    error?.message.includes("image_attribution") ||
    error?.message.includes("image_license") ||
    error?.message.includes("image_source_url")
  ) {
    const retry = await supabase
      .from("species")
      .select(
        "id, slug, common_name, scientific_name, category, status, short_summary, id_tips, habitat, similar_species, source_urls, inat_taxon_id, is_sensitive",
      )
      .eq("slug", slug)
      .maybeSingle();
    row = retry.data;
    error = retry.error;
  }

  if (error) {
    return { species: null, error: error.message };
  }

  if (!row?.slug) {
    return { species: null, error: null };
  }

  const { data: observations, error: observationsError } = await supabase
    .from("observations")
    .select("id, photo_path, created_at, category, lat_public, lng_public")
    .eq("species_id", row.id)
    .order("created_at", { ascending: false })
    .limit(12);

  if (observationsError) {
    return { species: null, error: observationsError.message };
  }

  return {
    species: {
      id: row.id,
      slug: row.slug,
      commonName: row.common_name,
      scientificName: textOrNull(row.scientific_name),
      category: row.category,
      status: textOrNull(row.status),
      shortSummary: textOrNull(row.short_summary),
      idTips: textOrNull(row.id_tips),
      habitat: textOrNull(row.habitat),
      similarSpecies: textOrNull(row.similar_species),
      sourceUrls: sourceUrlsFrom(row.source_urls),
      inatTaxonId: numberOrNull(row.inat_taxon_id),
      isSensitive: Boolean(row.is_sensitive),
      imageUrl: textOrNull("image_url" in row ? row.image_url : null),
      imageAttribution: textOrNull(
        "image_attribution" in row ? row.image_attribution : null,
      ),
      imageLicense: textOrNull("image_license" in row ? row.image_license : null),
      imageSourceUrl: textOrNull(
        "image_source_url" in row ? row.image_source_url : null,
      ),
      sightings: (observations ?? []).map((observation) => ({
        id: observation.id,
        photoUrl: photoUrlFor(supabase, observation.photo_path),
        createdAtLabel: formatDate(observation.created_at),
        category: observation.category,
        lat: numberOrNull(observation.lat_public),
        lng: numberOrNull(observation.lng_public),
      })),
    },
    error: null,
  };
}
