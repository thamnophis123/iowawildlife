const EARTH_RADIUS_KM = 6371;

export type LatLng = {
  lat: number;
  lng: number;
};

export const IOWA_CENTER: LatLng = { lat: 42.0, lng: -93.5 };

export const IOWA_BOUNDS = {
  minLat: 40.3,
  maxLat: 43.6,
  minLng: -96.7,
  maxLng: -90.1,
};

export const OUT_OF_STATE_NOTE =
  "Posted with an out-of-state location override.";

export function isInsideIowa(lat: number, lng: number) {
  return (
    lat >= IOWA_BOUNDS.minLat &&
    lat <= IOWA_BOUNDS.maxLat &&
    lng >= IOWA_BOUNDS.minLng &&
    lng <= IOWA_BOUNDS.maxLng
  );
}

export function notesWithOutOfStateOverride(
  notes: string,
  override: boolean,
) {
  const trimmed = notes.trim();
  if (!override) {
    return trimmed || null;
  }

  if (!trimmed) {
    return OUT_OF_STATE_NOTE;
  }

  if (trimmed.includes(OUT_OF_STATE_NOTE)) {
    return trimmed;
  }

  return `${trimmed}\n\n${OUT_OF_STATE_NOTE}`;
}

export function splitOutOfStateNote(notes: string | null) {
  if (!notes) {
    return { notes: null, outOfStateOverride: false };
  }

  const outOfStateOverride = notes.includes(OUT_OF_STATE_NOTE);
  const cleaned = notes
    .replace(OUT_OF_STATE_NOTE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    notes: cleaned || null,
    outOfStateOverride,
  };
}

export function offsetCoordinates(
  lat: number,
  lng: number,
  minKm = 0.5,
  maxKm = 3,
): LatLng {
  const distanceKm = minKm + Math.random() * (maxKm - minKm);
  const bearing = Math.random() * 2 * Math.PI;
  const lat1 = toRadians(lat);
  const lng1 = toRadians(lng);
  const angularDistance = distanceKm / EARTH_RADIUS_KM;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return {
    lat: toDegrees(lat2),
    lng: normalizeLongitude(toDegrees(lng2)),
  };
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number) {
  return (radians * 180) / Math.PI;
}

function normalizeLongitude(lng: number) {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}
