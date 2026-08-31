"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { SpeciesOption } from "@/lib/species";
import {
  dedupeSpeciesByScientificName,
  titleCaseCommonName,
} from "@/lib/species-names";

const UNKNOWN_LABEL = "Not sure / unknown";

type SpeciesSearchProps = {
  species: SpeciesOption[];
  selectedId: string;
  onSelect: (species: SpeciesOption | null) => void;
};

function matchesQuery(item: SpeciesOption, query: string) {
  const needle = query.toLowerCase();
  if (item.commonName.toLowerCase().includes(needle)) {
    return true;
  }

  return Boolean(item.scientificName?.toLowerCase().includes(needle));
}

export default function SpeciesSearch({
  species,
  selectedId,
  onSelect,
}: SpeciesSearchProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = species.find((item) => item.id === selectedId) ?? null;
  const selectedLabel = selected
    ? titleCaseCommonName(selected.commonName)
    : "";
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const matches = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return [];
    }

    const found = species.filter((item) => matchesQuery(item, trimmed));
    return dedupeSpeciesByScientificName(found).slice(0, 15);
  }, [query, species]);

  const optionCount = 1 + matches.length;

  useEffect(() => {
    if (selectedId && selectedLabel) {
      setQuery(selectedLabel);
    }
  }, [selectedId, selectedLabel]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function chooseUnknown() {
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
    onSelect(null);
  }

  function chooseSpecies(item: SpeciesOption) {
    setQuery(titleCaseCommonName(item.commonName));
    setOpen(false);
    setActiveIndex(0);
    onSelect(item);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setOpen(true);
    setActiveIndex(0);
    if (selected && value !== selectedLabel) {
      onSelect(null);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current + 1) % optionCount);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current - 1 + optionCount) % optionCount);
      return;
    }

    if (event.key === "Enter" && open) {
      event.preventDefault();
      if (activeIndex === 0) {
        chooseUnknown();
        return;
      }

      const item = matches[activeIndex - 1];
      if (item) {
        chooseSpecies(item);
      }
    }
  }

  const showTypeHint = open && query.trim().length < 2;
  const showEmpty = open && query.trim().length >= 2 && matches.length === 0;

  return (
    <div ref={rootRef} className="relative">
      <input
        id="species"
        className="mt-1 w-full rounded-lg border border-[#d8e3d4] bg-white px-3 py-2 text-stone-800 outline-none focus:border-[#2d6a4f]"
        type="text"
        name="species-search"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-opt-${activeIndex}` : undefined}
        placeholder="Search common or scientific name"
        value={query}
        onChange={(event) => handleQueryChange(event.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      <p className="mt-1 text-sm text-stone-600">
        {selected
          ? `${selectedLabel}${selected.scientificName ? ` (${selected.scientificName})` : ""}`
          : UNKNOWN_LABEL}
      </p>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[#d8e3d4] bg-white py-1 shadow-md"
        >
          <li
            id={`${listId}-opt-0`}
            role="option"
            aria-selected={activeIndex === 0}
            className={`cursor-pointer px-3 py-2 text-sm ${
              activeIndex === 0 ? "bg-[#eef4ee] text-[#1b4332]" : "text-stone-700"
            }`}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setActiveIndex(0)}
            onClick={chooseUnknown}
          >
            {UNKNOWN_LABEL}
          </li>
          {matches.map((item, index) => {
            const optionIndex = index + 1;
            const active = activeIndex === optionIndex;
            return (
              <li
                key={item.id}
                id={`${listId}-opt-${optionIndex}`}
                role="option"
                aria-selected={active}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  active ? "bg-[#eef4ee] text-[#1b4332]" : "text-stone-700"
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(optionIndex)}
                onClick={() => chooseSpecies(item)}
              >
                <span className="font-medium">
                  {titleCaseCommonName(item.commonName)}
                </span>
                {item.scientificName ? (
                  <span className="ml-2 italic text-stone-500">
                    {item.scientificName}
                  </span>
                ) : null}
              </li>
            );
          })}
          {showTypeHint ? (
            <li className="px-3 py-2 text-sm text-stone-500">
              Type at least 2 characters to search.
            </li>
          ) : null}
          {showEmpty ? (
            <li className="px-3 py-2 text-sm text-stone-500">
              No matching species.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
