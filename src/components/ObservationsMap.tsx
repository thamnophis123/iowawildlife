"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import type { MapObservation } from "@/lib/observations";

const ObservationsLeaflet = dynamic(
  () => import("@/components/ObservationsLeaflet"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(70vh,36rem)] items-center justify-center bg-[#fbfaf6] text-sm text-stone-500">
        Loading map…
      </div>
    ),
  },
);

type ObservationsMapProps = {
  observations: MapObservation[];
};

export default function ObservationsMap({ observations }: ObservationsMapProps) {
  const [category, setCategory] = useState<"all" | (typeof CATEGORIES)[number]>(
    "all",
  );

  const visible = useMemo(() => {
    if (category === "all") {
      return observations;
    }

    return observations.filter((item) => item.category === category);
  }, [category, observations]);

  return (
    <div className="mt-8 space-y-4">
      <label className="block text-sm font-medium text-[#1b4332]">
        Category
        <select
          className="mt-1 w-full max-w-xs rounded-lg border border-[#d8e3d4] bg-white px-3 py-2 text-stone-800 outline-none focus:border-[#2d6a4f]"
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as typeof category)
          }
        >
          <option value="all">All</option>
          {CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {CATEGORY_LABELS[item]}
            </option>
          ))}
        </select>
      </label>
      <div className="overflow-hidden rounded-xl border border-[#d8e3d4]">
        <ObservationsLeaflet observations={visible} />
      </div>
      <p className="text-sm text-stone-500">
        {visible.length} sighting{visible.length === 1 ? "" : "s"} shown.
      </p>
    </div>
  );
}
