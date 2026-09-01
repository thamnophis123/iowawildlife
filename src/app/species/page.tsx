import type { Metadata } from "next";
import SpeciesIndex from "@/components/SpeciesIndex";
import { getSpeciesIndex } from "@/lib/species";

export const metadata: Metadata = {
  title: "Species",
};

export default async function SpeciesIndexPage() {
  const { species, error } = await getSpeciesIndex();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 sm:px-8">
      <h1 className="text-4xl font-semibold tracking-tight text-[#1b4332]">
        Species
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-stone-600">
        Iowa animals with pages on this site. Open a name for identification
        notes, habitat, and sightings.
      </p>
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      <SpeciesIndex species={species} />
    </main>
  );
}
