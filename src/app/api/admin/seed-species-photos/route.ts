import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const INAT_USER_AGENT = "IowaWildlife/1.0 (www.iowawildlife.org)";
const REQUEST_DELAY_MS = 200;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type SpeciesRow = {
  id: string;
  slug: string;
  image_url: string | null;
  inat_taxon_id: number | null;
};

type InatPhoto = {
  attribution?: string | null;
  license_code?: string | null;
  medium_url?: string | null;
  square_url?: string | null;
  url?: string | null;
};

type InatTaxaResponse = {
  results?: { default_photo?: InatPhoto | null }[];
};

type RowError = {
  slug: string;
  error: string;
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
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isBlank(value: string | null | undefined) {
  return !value || !value.trim();
}

function textField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseLimit(value: string | null) {
  if (!value) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function photoSizeUrl(url: string, size: "medium" | "large") {
  return url.replace(
    /\/(square|small|medium|large|original)\.(jpe?g|png|webp|gif)/i,
    `/${size}.$2`,
  );
}

function photoUrlFrom(photo: InatPhoto) {
  const medium = textField(photo.medium_url);
  if (medium) {
    const large = photoSizeUrl(medium, "large");
    return large !== medium ? large : medium;
  }

  const fallback = textField(photo.square_url) || textField(photo.url);
  if (!fallback) {
    return null;
  }

  const large = photoSizeUrl(fallback, "large");
  if (large !== fallback) {
    return large;
  }

  return photoSizeUrl(fallback, "medium");
}

async function fetchTaxonPhoto(taxonId: number): Promise<InatPhoto | null> {
  const url = `https://api.inaturalist.org/v1/taxa/${taxonId}`;

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
      throw new Error(`iNaturalist taxa failed (${response.status}) for ${taxonId}`);
    }

    const body = (await response.json()) as InatTaxaResponse;
    return body.results?.[0]?.default_photo ?? null;
  }

  throw new Error(`iNaturalist rate-limited taxon ${taxonId} after retries`);
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
          "SUPABASE_SERVICE_ROLE_KEY is required to update species (RLS blocks the anon key).",
      },
      { status: 503 },
    );
  }

  const slug = searchParams.get("slug")?.trim() || null;
  const limit = parseLimit(searchParams.get("limit"));

  let query = supabase
    .from("species")
    .select("id, slug, image_url, inat_taxon_id")
    .not("slug", "is", null)
    .neq("slug", "")
    .not("inat_taxon_id", "is", null);

  if (slug) {
    query = query.eq("slug", slug).limit(1);
  } else {
    query = query
      .or('image_url.is.null,image_url.eq.""')
      .order("common_name", { ascending: true })
      .limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[seed-species-photos] load failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).filter(
    (row): row is SpeciesRow =>
      Boolean(row.slug) && row.inat_taxon_id != null,
  );

  if (slug && rows.length === 0) {
    return NextResponse.json({
      ok: true,
      updated: 0,
      skipped: 0,
      errors: [{ slug, error: "Species not found." }],
    });
  }

  const updated: string[] = [];
  const skipped: string[] = [];
  const errors: RowError[] = [];
  let inatCalls = 0;

  const toProcess = slug ? rows.slice(0, 1) : rows.slice(0, limit);

  for (const row of toProcess) {
    if (!isBlank(row.image_url)) {
      skipped.push(row.slug);
      continue;
    }

    if (row.inat_taxon_id == null) {
      skipped.push(row.slug);
      continue;
    }

    if (inatCalls > 0) {
      await delay(REQUEST_DELAY_MS);
    }

    try {
      inatCalls += 1;
      const photo = await fetchTaxonPhoto(row.inat_taxon_id);
      const imageUrl = photo ? photoUrlFrom(photo) : null;

      if (!photo || !imageUrl) {
        skipped.push(row.slug);
        continue;
      }

      const { error: updateError } = await supabase
        .from("species")
        .update({
          image_url: imageUrl,
          image_attribution: textField(photo.attribution),
          image_license: textField(photo.license_code),
          image_source_url: `https://www.inaturalist.org/taxa/${row.inat_taxon_id}`,
        })
        .eq("id", row.id);

      if (updateError) {
        errors.push({ slug: row.slug, error: updateError.message });
        continue;
      }

      updated.push(row.slug);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Species photo seed failed.";
      console.error(`[seed-species-photos] ${row.slug}: ${message}`);
      errors.push({ slug: row.slug, error: message });
    }
  }

  return NextResponse.json({
    ok: true,
    updated: updated.length,
    skipped: skipped.length,
    errors,
  });
}
