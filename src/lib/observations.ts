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

      const photoUrl = row.photo_path
        ? supabase.storage.from("photos").getPublicUrl(row.photo_path).data
            .publicUrl
        : null;

      return {
        id: row.id,
        lat: row.lat_public,
        lng: row.lng_public,
        photoUrl,
        notes: row.notes,
        category: row.category,
        isAnonymous: Boolean(row.is_anonymous),
        createdAtLabel: row.created_at
          ? new Date(row.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : null,
      } satisfies MapObservation;
    })
    .filter((row): row is MapObservation => row !== null);

  return { observations, error: null };
}
