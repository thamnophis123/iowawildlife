"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import exifr from "exifr";
import { createClient } from "@/lib/supabase/client";
import { offsetCoordinates, type LatLng } from "@/lib/geo";
import { PHOTO_ACCEPT, photoExtension } from "@/lib/photo";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/categories";

type LocationSource = "exif" | "map";

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

export default function UploadForm() {
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
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [fuzzy, setFuzzy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setError(null);
    setFile(nextFile);
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return nextFile ? URL.createObjectURL(nextFile) : null;
    });

    if (!nextFile) {
      return;
    }

    if (!photoExtension(nextFile)) {
      setFile(null);
      setPreviewUrl(null);
      setError("Choose a JPEG, PNG, WebP, or HEIC photo.");
      return;
    }

    try {
      const gps = await exifr.gps(nextFile);
      if (
        gps &&
        typeof gps.latitude === "number" &&
        typeof gps.longitude === "number"
      ) {
        setPosition({ lat: gps.latitude, lng: gps.longitude });
        setFocusPosition({ lat: gps.latitude, lng: gps.longitude });
        setLocationSource("exif");
      }
    } catch {
      // EXIF is optional; the user can still drop a pin on the map.
    }
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
        is_anonymous: isAnonymous,
        geoprivacy: fuzzy ? "fuzzy" : "precise",
        location_source: locationSource,
        lat_precise: position.lat,
        lng_precise: position.lng,
        lat_public: publicCoords.lat,
        lng_public: publicCoords.lng,
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

      <div>
        <label
          htmlFor="category"
          className="block text-sm font-medium text-[#1b4332]"
        >
          Category
        </label>
        <p className="mt-1 text-sm text-stone-600">
          Choose the group this animal belongs to.
        </p>
        <select
          id="category"
          className={fieldClassName}
          name="category"
          value={category}
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
