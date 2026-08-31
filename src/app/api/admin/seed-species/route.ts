import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const INAT_USER_AGENT = "IowaWildlife/1.0 (www.iowawildlife.org)";
const PAGE_DELAY_MS = 200;
const PER_PAGE = 200;

const ICONIC_TAXA = [
  { id: 40151, category: "mammal" },
  { id: 3, category: "bird" },
  { id: 26036, category: "reptile" },
  { id: 20978, category: "amphibian" },
  { id: 47178, category: "fish" },
] as const;

type Category = (typeof ICONIC_TAXA)[number]["category"];

type InatTaxon = {
  id: number;
  name: string;
  rank?: string | null;
  preferred_common_name?: string | null;
};

const SKIP_RANKS = new Set(["subspecies", "variety"]);

type SpeciesCountsResponse = {
  total_results: number;
  page: number;
  per_page: number;
  results: { taxon?: InatTaxon | null }[];
};

function secretMatches(provided: string | null, expected: string) {
  if (!provided) {
    return false;
  }

  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function kebabCase(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueSlug(
  commonName: string,
  taxonId: number,
  usedSlugs: Set<string>,
) {
  const base = kebabCase(commonName) || `taxon-${taxonId}`;

  if (!usedSlugs.has(base)) {
    return base;
  }

  const withId = `${base}-${taxonId}`;
  if (!usedSlugs.has(withId)) {
    return withId;
  }

  let n = 2;
  while (usedSlugs.has(`${withId}-${n}`)) {
    n += 1;
  }
  return `${withId}-${n}`;
}

async function fetchSpeciesCountsPage(
  taxonId: number,
  page: number,
): Promise<SpeciesCountsResponse> {
  const url = new URL(
    "https://api.inaturalist.org/v1/observations/species_counts",
  );
  url.searchParams.set("place_id", "24");
  url.searchParams.set("verifiable", "true");
  url.searchParams.set("iconic_taxon_id", String(taxonId));
  // species_counts ignores iconic_taxon_id; taxon_id limits to that clade.
  url.searchParams.set("taxon_id", String(taxonId));
  url.searchParams.set("rank", "species");
  url.searchParams.set("per_page", String(PER_PAGE));
  url.searchParams.set("page", String(page));

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": INAT_USER_AGENT,
      },
    });

    if (response.status === 429 && attempt < 3) {
      await delay(1000 * (attempt + 1));
      continue;
    }

    if (!response.ok) {
      throw new Error(
        `iNaturalist species_counts failed (${response.status}) for taxon ${taxonId} page ${page}`,
      );
    }

    return (await response.json()) as SpeciesCountsResponse;
  }

  throw new Error(
    `iNaturalist rate-limited taxon ${taxonId} page ${page} after retries`,
  );
}

export async function GET(request: Request) {
  const expected = process.env.SEED_SECRET;
  const { searchParams } = new URL(request.url);

  if (!expected) {
    return NextResponse.json(
      { error: "SEED_SECRET is not configured." },
      { status: 503 },
    );
  }

  if (!secretMatches(searchParams.get("key"), expected)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY is required to upsert species (RLS blocks the anon key).",
      },
      { status: 503 },
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from("species")
    .select("inat_taxon_id, slug");

  if (existingError) {
    return NextResponse.json(
      { error: existingError.message },
      { status: 500 },
    );
  }

  const slugByTaxon = new Map<number, string>();
  const usedSlugs = new Set<string>();

  for (const row of existing ?? []) {
    if (row.slug) {
      usedSlugs.add(row.slug);
      if (row.inat_taxon_id != null) {
        slugByTaxon.set(row.inat_taxon_id, row.slug);
      }
    }
  }

  const upsertedByCategory: Record<Category, number> = {
    mammal: 0,
    bird: 0,
    reptile: 0,
    amphibian: 0,
    fish: 0,
  };

  let pagesFetched = 0;
  let upserted = 0;
  let firstRequest = true;

  try {
    for (const group of ICONIC_TAXA) {
      let page = 1;

      for (;;) {
        if (!firstRequest) {
          await delay(PAGE_DELAY_MS);
        }
        firstRequest = false;

        const payload = await fetchSpeciesCountsPage(group.id, page);
        pagesFetched += 1;

        const rows = [];
        for (const result of payload.results ?? []) {
          const taxon = result.taxon;
          if (!taxon?.id || !taxon.name) {
            continue;
          }

          if (taxon.rank && SKIP_RANKS.has(taxon.rank)) {
            continue;
          }

          const commonName =
            taxon.preferred_common_name?.trim() || taxon.name;
          const existingSlug = slugByTaxon.get(taxon.id);
          const slug =
            existingSlug ?? uniqueSlug(commonName, taxon.id, usedSlugs);

          usedSlugs.add(slug);
          slugByTaxon.set(taxon.id, slug);

          rows.push({
            inat_taxon_id: taxon.id,
            common_name: commonName,
            scientific_name: taxon.name,
            category: group.category,
            slug,
          });
        }

        if (rows.length > 0) {
          const { error: upsertError } = await supabase
            .from("species")
            .upsert(rows, { onConflict: "inat_taxon_id" });

          if (upsertError) {
            return NextResponse.json(
              { error: upsertError.message },
              { status: 500 },
            );
          }

          upserted += rows.length;
          upsertedByCategory[group.category] += rows.length;
        }

        const received = payload.results?.length ?? 0;
        if (received < PER_PAGE) {
          break;
        }

        page += 1;
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Species seed failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    upserted,
    pagesFetched,
    byCategory: upsertedByCategory,
  });
}
