"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import exifr from "exifr";
import { createClient } from "@/lib/supabase/client";
import { offsetCoordinates, type LatLng } from "@/lib/geo";
import { PHOTO_ACCEPT, photoExtension } from "@/lib/photo";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  isCategory,
  type Category,
} from "@/lib/categories";
import type { SpeciesOption } from "@/lib/species";
import { matchSpeciesByName, titleCaseCommonName } from "@/lib/species-names";
import SpeciesSearch from "./SpeciesSearch";

type IdentifyGuess = {
  unknown: boolean;
  common_name: string | null;
  scientific_name: string | null;
  confidence: number | null;
};

type IdentifyResponse = IdentifyGuess & {
  error?: string;
};

type LocationSource = "exif" | "map";

type UploadFormProps = {
  speciesOptions: SpeciesOption[];
};

const fieldClassName =
  "mt-1 w-full rounded-lg border border-[#d8e3d4] bg-white px-3 py-2 text-stone-800 outline-none focus:border-[#2d6a4f]";

const SightingMap = dynamic(() => import("@/components/SightingMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center bg-[#fbfaf6] text-sm text-stone-500">
      Loading map…
    </div>
  ),
});

export default function UploadForm({ speciesOptions }: UploadFormProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [focusPosition, setFocusPosition] = useState<LatLng | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource | null>(
    null,
  );
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<Category>("bird");
  const [speciesId, setSpeciesId] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [fuzzy, setFuzzy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [guess, setGuess] = useState<IdentifyGuess | null>(null);
  const [guessPending, setGuessPending] = useState(false);
  const [identifyError, setIdentifyError] = useState<string | null>(null);
  const identifyRequest = useRef(0);

  const locationLabel = useMemo(() => {
    if (!position) {
      return "No pin yet. Click the map or choose a photo with GPS.";
    }

    const coords = `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`;
    if (locationSource === "exif") {
      return `Pin from photo GPS: ${coords}`;
    }

    return `Pin from map: ${coords}`;
  }, [locationSource, position]);

  const matchedGuess = useMemo(() => {
    if (!guess || guess.unknown) {
      return null;
    }

    return matchSpeciesByName(
      speciesOptions,
      guess.common_name,
      guess.scientific_name,
    );
  }, [guess, speciesOptions]);

  const guessLabel = guessPending
    ? "identifying…"
    : guess?.unknown
      ? "unknown"
      : guess
        ? titleCaseCommonName(
            guess.common_name || guess.scientific_name || "unknown",
          )
        : null;

  async function requestIdentify(nextFile: File, coords: LatLng | null) {
    const requestId = identifyRequest.current + 1;
    identifyRequest.current = requestId;
    setGuess(null);
    setIdentifyError(null);
    setGuessPending(true);

    try {
      const body = new FormData();
      body.append("photo", nextFile);
      if (coords) {
        body.append("lat", String(coords.lat));
        body.append("lng", String(coords.lng));
      }

      const response = await fetch("/api/identify", {
        method: "POST",
        body,
      });
      const payload = (await response.json().catch(() => ({}))) as IdentifyResponse;

      if (identifyRequest.current !== requestId) {
        return;
      }

      if (!response.ok) {
        setGuess(null);
        setIdentifyError(
          payload.error || `Identification failed (HTTP ${response.status}).`,
        );
        return;
      }

      setGuess({
        unknown: Boolean(payload.unknown),
        common_name: payload.common_name,
        scientific_name: payload.scientific_name,
        confidence: payload.confidence,
      });
    } catch (identifyRequestError) {
      if (identifyRequest.current !== requestId) {
        return;
      }

      setGuess(null);
      setIdentifyError(
        identifyRequestError instanceof Error
          ? identifyRequestError.message
          : "Identification failed.",
      );
    } finally {
      if (identifyRequest.current === requestId) {
        setGuessPending(false);
      }
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setError(null);
    setGuess(null);
    setIdentifyError(null);
    identifyRequest.current += 1;
    setFile(nextFile);
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return nextFile ? URL.createObjectURL(nextFile) : null;
    });

    if (!nextFile) {
      setGuessPending(false);
      return;
    }

    if (!photoExtension(nextFile)) {
      setFile(null);
      setPreviewUrl(null);
      setGuessPending(false);
      setError("Choose a JPEG, PNG, WebP, or HEIC photo.");
      return;
    }

    setGuessPending(true);

    let coords = position;
    try {
      const gps = await exifr.gps(nextFile);
      if (
        gps &&
        typeof gps.latitude === "number" &&
        typeof gps.longitude === "number"
      ) {
        coords = { lat: gps.latitude, lng: gps.longitude };
        setPosition(coords);
        setFocusPosition(coords);
        setLocationSource("exif");
      }
    } catch {
      // EXIF is optional; the user can still drop a pin on the map.
    }

    await requestIdentify(nextFile, coords);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError("A photo is required.");
      return;
    }

    const extension = photoExtension(file);
    if (!extension) {
      setError("Choose a JPEG, PNG, WebP, or HEIC photo.");
      return;
    }

    if (!position || !locationSource) {
      setError("Drop a pin on the map before submitting.");
      return;
    }

    setPending(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("Sign in to upload a sighting.");
        return;
      }

      const photoPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(photoPath, file);

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const publicCoords = fuzzy
        ? offsetCoordinates(position.lat, position.lng)
        : position;

      const { error: insertError } = await supabase.from("observations").insert({
        user_id: user.id,
        photo_path: photoPath,
        notes: notes.trim() || null,
        category,
        species_id: speciesId || null,
        is_anonymous: isAnonymous,
        geoprivacy: fuzzy ? "fuzzy" : "precise",
        location_source: locationSource,
        lat_precise: position.lat,
        lng_precise: position.lng,
        lat_public: publicCoords.lat,
        lng_public: publicCoords.lng,
        suggested_name: guess
          ? guess.unknown
            ? "unknown"
            : guess.common_name || guess.scientific_name
          : null,
        suggestion_confidence: guess?.confidence ?? null,
        suggestion_source: guess ? "gemini" : null,
      });

      if (insertError) {
        await supabase.storage.from("photos").remove([photoPath]);
        setError(insertError.message);
        return;
      }

      router.push("/map");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save this sighting.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
      <label className="block text-sm font-medium text-[#1b4332]">
        Photo
        <input
          className={`${fieldClassName} file:mr-3 file:rounded-md file:border-0 file:bg-[#1b4332] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#fbfaf6]`}
          type="file"
          name="photo"
          accept={PHOTO_ACCEPT}
          required
          onChange={handleFileChange}
        />
      </label>

      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Selected sighting"
          className="max-h-48 rounded-xl border border-[#d8e3d4] object-contain bg-[#fbfaf6]"
        />
      ) : null}

      <div>
        <p className="text-sm font-medium text-[#1b4332]">Location</p>
        <p className="mt-1 text-sm text-stone-600">{locationLabel}</p>
        <div className="mt-3 overflow-hidden rounded-xl border border-[#d8e3d4]">
          <SightingMap
            position={position}
            focusPosition={focusPosition}
            onUserSetPosition={(next) => {
              setPosition(next);
              setLocationSource("map");
            }}
          />
        </div>
      </div>

      <label className="block text-sm font-medium text-[#1b4332]">
        Notes
        <textarea
          className={`${fieldClassName} min-h-24`}
          name="notes"
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>

      {file ? (
        <div className="rounded-lg border border-[#d8e3d4] bg-white px-3 py-3">
          {identifyError ? (
            <p className="text-sm text-red-700">{identifyError}</p>
          ) : (
            <>
              <p className="text-sm text-[#1b4332]">
                AI guess: {guessLabel ?? "identifying…"}
              </p>
              <p className="mt-1 text-sm text-stone-600">Not confirmed.</p>
              {matchedGuess && speciesId !== matchedGuess.id ? (
                <button
                  type="button"
                  className="mt-3 rounded-lg border border-[#1b4332] px-3 py-1.5 text-sm font-medium text-[#1b4332] hover:bg-[#eef4ee]"
                  onClick={() => {
                    setSpeciesId(matchedGuess.id);
                    if (isCategory(matchedGuess.category)) {
                      setCategory(matchedGuess.category);
                    }
                  }}
                >
                  Accept AI guess
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <div>
        <label
          htmlFor="species"
          className="block text-sm font-medium text-[#1b4332]"
        >
          Species
        </label>
        <p className="mt-1 text-sm text-stone-600">
          Search by name, or choose Not sure / unknown.
        </p>
        <SpeciesSearch
          species={speciesOptions}
          selectedId={speciesId}
          onSelect={(item) => {
            if (!item) {
              setSpeciesId("");
              return;
            }

            setSpeciesId(item.id);
            if (isCategory(item.category)) {
              setCategory(item.category);
            }
          }}
        />
      </div>

      <div>
        <label
          htmlFor="category"
          className="block text-sm font-medium text-[#1b4332]"
        >
          Category
        </label>
        <p className="mt-1 text-sm text-stone-600">
          {speciesId
            ? "Filled from the species you chose."
            : "Choose the group this animal belongs to."}
        </p>
        <select
          id="category"
          className={`${fieldClassName} disabled:bg-[#fbfaf6] disabled:text-stone-500`}
          name="category"
          value={category}
          disabled={Boolean(speciesId)}
          onChange={(event) => setCategory(event.target.value as Category)}
        >
          {CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {CATEGORY_LABELS[item]}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-[#1b4332]">
        <input
          type="checkbox"
          checked={isAnonymous}
          onChange={(event) => setIsAnonymous(event.target.checked)}
        />
        Anonymous observer
      </label>

      <label className="flex items-center gap-2 text-sm text-[#1b4332]">
        <input
          type="checkbox"
          checked={fuzzy}
          onChange={(event) => setFuzzy(event.target.checked)}
        />
        Fuzzy location (~3 km)
      </label>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#1b4332] px-4 py-2 text-sm font-medium text-[#fbfaf6] hover:bg-[#163828] disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save sighting"}
      </button>
    </form>
  );
}
