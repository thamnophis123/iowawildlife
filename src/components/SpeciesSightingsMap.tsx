"use client";

import dynamic from "next/dynamic";
import type { SpeciesMapPin } from "@/components/SpeciesLeaflet";

const SpeciesLeaflet = dynamic(() => import("@/components/SpeciesLeaflet"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center bg-[#fbfaf6] text-sm text-stone-500">
      Loading map…
    </div>
  ),
});

type SpeciesSightingsMapProps = {
  pins: SpeciesMapPin[];
};

export default function SpeciesSightingsMap({ pins }: SpeciesSightingsMapProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#d8e3d4]">
      <SpeciesLeaflet pins={pins} />
    </div>
  );
}
