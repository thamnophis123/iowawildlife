"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CATEGORIES, CATEGORY_LABELS, categoryLabel } from "@/lib/categories";
import type { SpeciesIndexItem } from "@/lib/species";

type CategoryFilter = "all" | (typeof CATEGORIES)[number];

type SpeciesIndexProps = {
  species: SpeciesIndexItem[];
};

function matchesSearch(item: SpeciesIndexItem, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return (
    item.commonName.toLowerCase().includes(needle) ||
    Boolean(item.scientificName?.toLowerCase().includes(needle))
  );
}

function SpeciesRow({ item }: { item: SpeciesIndexItem }) {
  const category = categoryLabel(item.category) || item.category;

  return (
    <li>
      <Link
        href={`/species/${item.slug}`}
        className="block rounded-xl border border-[#d8e3d4] bg-[#fbfaf6] px-4 py-3 hover:border-[#2d6a4f]"
      >
        <p className="font-medium text-[#1b4332]">
          {item.commonName}
          {item.scientificName ? (
            <span className="ml-2 italic font-normal text-stone-500">
              {item.scientificName}
            </span>
          ) : null}
        </p>
        <p className="mt-1 text-sm text-stone-500">
          {category}
          {item.status ? ` · ${item.status}` : ""}
        </p>
        {item.hasAccountText || item.onTheMap ? (
          <p className="mt-2 flex flex-wrap gap-2">
            {item.hasAccountText ? (
              <span className="rounded-full border border-[#d8e3d4] bg-white px-2 py-0.5 text-xs text-[#1b4332]">
                Has account text
              </span>
            ) : null}
            {item.onTheMap ? (
              <span className="rounded-full border border-[#d8e3d4] bg-[#eef4ee] px-2 py-0.5 text-xs text-[#1b4332]">
                On the map
              </span>
            ) : null}
          </p>
        ) : null}
      </Link>
    </li>
  );
}

export default function SpeciesIndex({ species }: SpeciesIndexProps) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    return species.filter((item) => {
      if (category !== "all" && item.category !== category) {
        return false;
      }

      return matchesSearch(item, query);
    });
  }, [category, query, species]);

  const groups = useMemo(() => {
    if (category !== "all") {
      return [{ key: category, label: CATEGORY_LABELS[category], items: visible }];
    }

    const byCategory = new Map<string, SpeciesIndexItem[]>();
    for (const item of visible) {
      const key = item.category || "other";
      const list = byCategory.get(key);
      if (list) {
        list.push(item);
      } else {
        byCategory.set(key, [item]);
      }
    }

    const ordered = CATEGORIES.filter((key) => byCategory.has(key)).map(
      (key) => ({
        key,
        label: CATEGORY_LABELS[key],
        items: byCategory.get(key) ?? [],
      }),
    );

    const extras = [...byCategory.keys()]
      .filter((key) => !CATEGORIES.includes(key as (typeof CATEGORIES)[number]))
      .sort((a, b) => a.localeCompare(b, "en"))
      .map((key) => ({
        key,
        label: categoryLabel(key) || key,
        items: byCategory.get(key) ?? [],
      }));

    return [...ordered, ...extras];
  }, [category, visible]);

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
      <label className="block text-sm font-medium text-[#1b4332]">
        Search
        <input
          className="mt-1 w-full rounded-lg border border-[#d8e3d4] bg-white px-3 py-2 text-stone-800 outline-none focus:border-[#2d6a4f]"
          type="search"
          value={query}
          placeholder="Common or scientific name"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <p className="text-sm text-stone-500">
        {visible.length} species shown.
      </p>
      {visible.length === 0 ? (
        <p className="text-sm text-stone-500">No species match this search.</p>
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.key}>
              {category === "all" ? (
                <h2 className="text-xl font-semibold tracking-tight text-[#1b4332]">
                  {group.label}
                </h2>
              ) : null}
              <ul className={category === "all" ? "mt-4 space-y-3" : "space-y-3"}>
                {group.items.map((item) => (
                  <SpeciesRow key={item.id} item={item} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
