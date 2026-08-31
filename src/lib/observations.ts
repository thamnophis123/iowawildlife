import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export type MapObservation = {
  id: string;
  lat: number;
  lng: number;
  photoUrl: string | null;
  notes: string | null;
  category: string | null;
  isAnonymous: boolean;
  createdAtLabel: string | null;
};

export type SightingComment = {
  id: string;
  body: string;
  createdAtLabel: string | null;
  authorName: string;
};

export type SightingSpecies = {
  id: string;
  commonName: string;
  scientificName: string | null;
  slug: string | null;
};

export type SightingIdentification = {
  id: string;
  speciesId: string;
  commonName: string;
  scientificName: string | null;
  slug: string | null;
  note: string | null;
  authorName: string;
  createdAtLabel: string | null;
};

export type SightingDetail = {
  id: string;
  photoUrl: string | null;
  notes: string | null;
  category: string | null;
  createdAtLabel: string | null;
  observerName: string;
  suggestedName: string | null;
  displayedSpecies: SightingSpecies | null;
  identifications: SightingIdentification[];
  comments: SightingComment[];
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

function toSpecies(row: {
  id: string;
  common_name: string;
  scientific_name: string | null;
  slug: string | null;
} | null): SightingSpecies | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    commonName: row.common_name,
    scientificName: row.scientific_name,
    slug: row.slug,
  };
}

function displayedSpeciesId(
  identifications: { species_id: string }[],
  observationSpeciesId: string | null,
) {
  const counts = new Map<string, number>();

  for (const row of identifications) {
    counts.set(row.species_id, (counts.get(row.species_id) ?? 0) + 1);
  }

  let winner: string | null = null;
  let winnerCount = 0;

  for (const [speciesId, count] of counts) {
    if (count >= 2 && count > winnerCount) {
      winner = speciesId;
      winnerCount = count;
    }
  }

  if (winner) {
    return winner;
  }

  return observationSpeciesId;
}

function identificationAuthorName(params: {
  identificationUserId: string | null;
  observationUserId: string | null;
  isAnonymous: boolean;
  displayName: string | null | undefined;
}) {
  if (
    params.isAnonymous &&
    params.identificationUserId &&
    params.identificationUserId === params.observationUserId
  ) {
    return "Anonymous";
  }

  return params.displayName || "User";
}

async function displayNamesByUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[],
) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map<string, string | null>();
  }

  const { data } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", uniqueIds);

  return new Map(
    (data ?? []).map((profile) => [profile.id, profile.display_name]),
  );
}

export async function getMapObservations(): Promise<{
  observations: MapObservation[];
  error: string | null;
}> {
  if (!getSupabaseEnv()) {
    return { observations: [], error: "Sightings are unavailable right now." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("observations")
    .select(
      "id, lat_public, lng_public, photo_path, notes, category, is_anonymous, created_at",
    );

  if (error) {
    return { observations: [], error: error.message };
  }

  const observations = (data ?? [])
    .map((row) => {
      if (
        typeof row.lat_public !== "number" ||
        typeof row.lng_public !== "number"
      ) {
        return null;
      }

      return {
        id: row.id,
        lat: row.lat_public,
        lng: row.lng_public,
        photoUrl: photoUrlFor(supabase, row.photo_path),
        notes: row.notes,
        category: row.category,
        isAnonymous: Boolean(row.is_anonymous),
        createdAtLabel: formatDate(row.created_at),
      } satisfies MapObservation;
    })
    .filter((row): row is MapObservation => row !== null);

  return { observations, error: null };
}

export async function getSighting(
  id: string,
): Promise<{ sighting: SightingDetail | null; error: string | null }> {
  if (!getSupabaseEnv()) {
    return { sighting: null, error: "Sightings are unavailable right now." };
  }

  const supabase = await createClient();
  const { data: observation, error: observationError } = await supabase
    .from("observations")
    .select(
      "id, user_id, photo_path, notes, category, is_anonymous, created_at, species_id, suggested_name",
    )
    .eq("id", id)
    .maybeSingle();

  if (observationError) {
    return { sighting: null, error: observationError.message };
  }

  if (!observation) {
    return { sighting: null, error: null };
  }

  const [commentsResult, identificationsResult] = await Promise.all([
    supabase
      .from("comments")
      .select("id, body, user_id, created_at")
      .eq("observation_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("identifications")
      .select("id, user_id, species_id, note, created_at")
      .eq("observation_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (commentsResult.error) {
    return { sighting: null, error: commentsResult.error.message };
  }

  if (identificationsResult.error) {
    return { sighting: null, error: identificationsResult.error.message };
  }

  const commentRows = commentsResult.data ?? [];
  const identificationRows = identificationsResult.data ?? [];
  const speciesIds = [
    ...identificationRows.map((row) => row.species_id),
    ...(observation.species_id ? [observation.species_id] : []),
  ];
  const uniqueSpeciesIds = [...new Set(speciesIds.filter(Boolean))];

  const { data: speciesRows } =
    uniqueSpeciesIds.length > 0
      ? await supabase
          .from("species")
          .select("id, common_name, scientific_name, slug")
          .in("id", uniqueSpeciesIds)
      : { data: [] as { id: string; common_name: string; scientific_name: string | null; slug: string | null }[] };

  const speciesById = new Map(
    (speciesRows ?? []).map((row) => [row.id, toSpecies(row)]),
  );

  const profileIds = [
    ...(observation.user_id ? [observation.user_id] : []),
    ...commentRows
      .map((comment) => comment.user_id)
      .filter((userId): userId is string => Boolean(userId)),
    ...identificationRows.map((row) => row.user_id),
  ];
  const names = await displayNamesByUserId(supabase, profileIds);

  const consensusId = displayedSpeciesId(
    identificationRows,
    observation.species_id,
  );
  const displayedSpecies = consensusId
    ? (speciesById.get(consensusId) ?? null)
    : null;

  const observerName = observation.is_anonymous
    ? "Anonymous"
    : (observation.user_id && names.get(observation.user_id)) ||
      "Community member";

  return {
    sighting: {
      id: observation.id,
      photoUrl: photoUrlFor(supabase, observation.photo_path),
      notes: observation.notes,
      category: observation.category,
      createdAtLabel: formatDate(observation.created_at),
      observerName,
      suggestedName: observation.suggested_name,
      displayedSpecies,
      identifications: identificationRows.map((row) => {
        const species = speciesById.get(row.species_id);
        return {
          id: row.id,
          speciesId: row.species_id,
          commonName: species?.commonName ?? "Unknown species",
          scientificName: species?.scientificName ?? null,
          slug: species?.slug ?? null,
          note: row.note,
          authorName: identificationAuthorName({
            identificationUserId: row.user_id,
            observationUserId: observation.user_id,
            isAnonymous: Boolean(observation.is_anonymous),
            displayName: names.get(row.user_id),
          }),
          createdAtLabel: formatDate(row.created_at),
        };
      }),
      comments: commentRows.map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAtLabel: formatDate(comment.created_at),
        authorName: comment.user_id
          ? names.get(comment.user_id) || "Community member"
          : "Community member",
      })),
    },
    error: null,
  };
}
