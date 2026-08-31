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

export type SightingDetail = {
  id: string;
  photoUrl: string | null;
  notes: string | null;
  category: string | null;
  createdAtLabel: string | null;
  observerName: string;
  speciesSlug: string | null;
  speciesCommonName: string | null;
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
      "id, user_id, photo_path, notes, category, is_anonymous, created_at, species_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (observationError) {
    return { sighting: null, error: observationError.message };
  }

  if (!observation) {
    return { sighting: null, error: null };
  }

  const { data: comments, error: commentsError } = await supabase
    .from("comments")
    .select("id, body, user_id, created_at")
    .eq("observation_id", id)
    .order("created_at", { ascending: true });

  if (commentsError) {
    return { sighting: null, error: commentsError.message };
  }

  const commentRows = comments ?? [];
  const profileIds = [
    ...(!observation.is_anonymous && observation.user_id
      ? [observation.user_id]
      : []),
    ...commentRows
      .map((comment) => comment.user_id)
      .filter((userId): userId is string => Boolean(userId)),
  ];
  const names = await displayNamesByUserId(supabase, profileIds);

  let speciesSlug: string | null = null;
  let speciesCommonName: string | null = null;

  if (observation.species_id) {
    const { data: species } = await supabase
      .from("species")
      .select("slug, common_name")
      .eq("id", observation.species_id)
      .maybeSingle();

    if (species?.slug) {
      speciesSlug = species.slug;
      speciesCommonName = species.common_name;
    }
  }

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
      speciesSlug,
      speciesCommonName,
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
