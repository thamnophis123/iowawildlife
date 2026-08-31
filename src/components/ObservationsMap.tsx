"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CATEGORIES, CATEGORY_LABELS, categoryLabel } from "@/lib/categories";
import type { MapObservation } from "@/lib/observations";
import { titleCaseCommonName } from "@/lib/species-names";

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

type CategoryFilter = "all" | (typeof CATEGORIES)[number];
type SelectionSource = "list" | "map";

function matchesSearch(observation: MapObservation, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  const fields = [
    observation.speciesCommonName,
    observation.speciesScientificName,
    observation.speciesSlug,
    observation.notes,
    observation.category,
    categoryLabel(observation.category),
  ];

  return fields.some((field) => field?.toLowerCase().includes(needle));
}

export default function ObservationsMap({ observations }: ObservationsMapProps) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectionSource, setSelectionSource] =
    useState<SelectionSource | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());

  const visible = useMemo(() => {
    return observations.filter((item) => {
      if (category !== "all" && item.category !== category) {
        return false;
      }

      return matchesSearch(item, query);
    });
  }, [category, observations, query]);

  useEffect(() => {
    if (selectedId && !visible.some((item) => item.id === selectedId)) {
      setSelectedId(null);
      setSelectionSource(null);
    }
  }, [selectedId, visible]);

  useEffect(() => {
    if (!selectedId || selectionSource !== "map") {
      return;
    }

    rowRefs.current
      .get(selectedId)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId, selectionSource]);

  return (
    <div className="mt-8 space-y-4">
      <label className="block text-sm font-medium text-[#1b4332]">
        Category
        <select
          className="mt-1 w-full max-w-xs rounded-lg border border-[#d8e3d4] bg-white px-3 py-2 text-stone-800 outline-none focus:border-[#2d6a4f]"
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as CategoryFilter)
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
        <ObservationsLeaflet
          observations={visible}
          selectedId={selectedId}
          selectionSource={selectionSource}
          onSelectFromMap={(id) => {
            setSelectedId(id);
            setSelectionSource("map");
          }}
        />
      </div>
      <p className="text-sm text-stone-500">
        {visible.length} sighting{visible.length === 1 ? "" : "s"} shown.
      </p>
      <label className="block text-sm font-medium text-[#1b4332]">
        Search
        <input
          className="mt-1 w-full rounded-lg border border-[#d8e3d4] bg-white px-3 py-2 text-stone-800 outline-none focus:border-[#2d6a4f]"
          type="search"
          value={query}
          placeholder="Name, species, notes, or category"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {visible.length === 0 ? (
        <p className="text-sm text-stone-500">No sightings match this search.</p>
      ) : (
        <ul className="max-h-[36rem] space-y-3 overflow-auto">
          {visible.map((observation) => {
            const selected = observation.id === selectedId;
            const speciesName = observation.speciesCommonName
              ? titleCaseCommonName(observation.speciesCommonName)
              : null;

            return (
              <li key={observation.id}>
                <div
                  role="button"
                  tabIndex={0}
                  ref={(node) => {
                    if (node) {
                      rowRefs.current.set(observation.id, node);
                    } else {
                      rowRefs.current.delete(observation.id);
                    }
                  }}
                  className={`flex cursor-pointer gap-4 rounded-xl border p-3 text-left ${
                    selected
                      ? "border-[#1b4332] bg-[#eef4ee]"
                      : "border-[#d8e3d4] bg-[#fbfaf6] hover:border-[#2d6a4f]"
                  }`}
                  onClick={() => {
                    setSelectedId(observation.id);
                    setSelectionSource("list");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedId(observation.id);
                      setSelectionSource("list");
                    }
                  }}
                >
                  {observation.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={observation.photoUrl}
                      alt={
                        speciesName ||
                        categoryLabel(observation.category) ||
                        "Sighting"
                      }
                      className="h-[120px] w-[120px] shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-[120px] w-[120px] shrink-0 items-center justify-center rounded-lg bg-white text-xs text-stone-400">
                      No photo
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-stone-500">
                      {observation.createdAtLabel || "Date unknown"}
                      {observation.category
                        ? ` · ${categoryLabel(observation.category)}`
                        : ""}
                    </p>
                    {speciesName ? (
                      <p className="mt-1 font-medium text-[#1b4332]">
                        {speciesName}
                        {observation.speciesScientificName ? (
                          <span className="ml-2 italic font-normal text-stone-500">
                            {observation.speciesScientificName}
                          </span>
                        ) : null}
                      </p>
                    ) : observation.suggestedName ? (
                      <p className="mt-1 text-sm text-stone-600">
                        AI guess: {observation.suggestedName}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-stone-500">
                        Not identified.
                      </p>
                    )}
                    <p className="mt-3">
                      <Link
                        href={`/sighting/${observation.id}`}
                        className="text-sm font-medium text-[#2d6a4f] underline decoration-[#d8e3d4] underline-offset-4 hover:text-[#1b4332]"
                        onClick={(event) => event.stopPropagation()}
                      >
                        View sighting
                      </Link>
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
