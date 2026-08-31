import type { Metadata } from "next";
import ObservationsMap from "@/components/ObservationsMap";
import { getMapObservations } from "@/lib/observations";

export const metadata: Metadata = {
  title: "Map",
};

export default async function MapPage() {
  const { observations, error } = await getMapObservations();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16 sm:px-8">
      <h1 className="text-4xl font-semibold tracking-tight text-[#1b4332]">
        Map
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-stone-600">
        Sightings across Iowa. Pins use public locations only.
      </p>
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      <ObservationsMap observations={observations} />
    </main>
  );
}
