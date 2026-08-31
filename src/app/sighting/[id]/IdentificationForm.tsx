"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SpeciesOption } from "@/lib/species";
import SpeciesSearch from "@/components/SpeciesSearch";

type IdentificationFormProps = {
  observationId: string;
  speciesOptions: SpeciesOption[];
};

export default function IdentificationForm({
  observationId,
  speciesOptions,
}: IdentificationFormProps) {
  const router = useRouter();
  const [speciesId, setSpeciesId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!speciesId) {
      setError("Choose a species first.");
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
        setError("Sign in to add an identification.");
        return;
      }

      const { error: upsertError } = await supabase.from("identifications").upsert(
        {
          observation_id: observationId,
          user_id: user.id,
          species_id: speciesId,
          note: note.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "observation_id,user_id" },
      );

      if (upsertError) {
        setError(upsertError.message);
        return;
      }

      const { error: applyError } = await supabase.rpc("apply_community_species", {
        p_observation_id: observationId,
      });

      if (applyError) {
        router.refresh();
        setError(applyError.message);
        return;
      }

      setNote("");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save this identification.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
      <div>
        <label
          htmlFor="identification-species"
          className="block text-sm font-medium text-[#1b4332]"
        >
          Suggest a species
        </label>
        <SpeciesSearch
          inputId="identification-species"
          species={speciesOptions}
          selectedId={speciesId}
          onSelect={(item) => setSpeciesId(item?.id ?? "")}
        />
      </div>
      <label className="block text-sm font-medium text-[#1b4332]">
        Note
        <span className="font-normal text-stone-500"> (optional)</span>
        <textarea
          className="mt-1 min-h-16 w-full rounded-lg border border-[#d8e3d4] bg-white px-3 py-2 text-stone-800 outline-none focus:border-[#2d6a4f]"
          name="note"
          rows={2}
          maxLength={280}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#1b4332] px-4 py-2 text-sm font-medium text-[#fbfaf6] hover:bg-[#163828] disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save identification"}
      </button>
    </form>
  );
}
