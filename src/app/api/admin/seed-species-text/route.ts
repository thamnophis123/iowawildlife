import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const GEMINI_DELAY_MS = 300;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-2.5-flash",
] as const;

type SpeciesRow = {
  id: string;
  slug: string;
  common_name: string;
  scientific_name: string | null;
  category: string;
  short_summary: string | null;
  inat_taxon_id: number | null;
};

type SpeciesText = {
  short_summary: string;
  id_tips: string | null;
  habitat: string | null;
  similar_species: string | null;
  status: string | null;
};

type GeminiBody = {
  error?: { message?: string; status?: string };
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string }[] };
  }[];
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

function extractJsonObject(text: string) {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<
        string,
        unknown
      >;
    } catch {
      return null;
    }
  }
}

function parseSpeciesText(text: string): SpeciesText | null {
  const parsed = extractJsonObject(text);
  if (!parsed) {
    return null;
  }

  const shortSummary =
    textField(parsed.short_summary) || textField(parsed.shortSummary);
  if (!shortSummary) {
    return null;
  }

  return {
    short_summary: shortSummary,
    id_tips: textField(parsed.id_tips) || textField(parsed.idTips),
    habitat: textField(parsed.habitat),
    similar_species:
      textField(parsed.similar_species) || textField(parsed.similarSpecies),
    status: textField(parsed.status),
  };
}

function geminiText(payload: GeminiBody) {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

function isMissingModel(status: number, body: GeminiBody) {
  return (
    status === 404 ||
    body.error?.status === "NOT_FOUND" ||
    /not found|is not found/i.test(body.error?.message ?? "")
  );
}

function sourceUrlsFor(row: SpeciesRow) {
  const urls: string[] = [];

  if (row.inat_taxon_id != null) {
    urls.push(`https://www.inaturalist.org/taxa/${row.inat_taxon_id}`);
  }

  if (row.category === "amphibian") {
    const parts = row.scientific_name?.trim().split(/\s+/) ?? [];
    const amphibia = new URL("https://amphibiaweb.org/search/index.html");
    amphibia.searchParams.set("title", "");
    amphibia.searchParams.set("remark", "");
    amphibia.searchParams.set("genus", parts[0] ?? "");
    amphibia.searchParams.set("species", parts[1] ?? "");
    urls.push(amphibia.toString());
  }

  return urls;
}

function promptFor(row: SpeciesRow) {
  return `Iowa wildlife species page for:
common name: ${row.common_name}
scientific name: ${row.scientific_name || "unknown"}
category: ${row.category}

Return JSON only: short_summary (2–4 sentences), id_tips, habitat, similar_species, status.
Original wording, not copied from any website.
If unsure, say so in the text.`;
}

async function callGemini(params: {
  apiKey: string;
  model: string;
  prompt: string;
  jsonMode: boolean;
}) {
  const generationConfig: Record<string, unknown> = { temperature: 0.3 };
  if (params.jsonMode) {
    generationConfig.responseMimeType = "application/json";
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": params.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: params.prompt }] }],
        generationConfig,
      }),
    },
  );

  const raw = await response.text();
  let body: GeminiBody = {};
  try {
    body = JSON.parse(raw) as GeminiBody;
  } catch {
    body = { error: { message: raw.slice(0, 500) } };
  }

  const text = geminiText(body);
  console.info(
    `[seed-species-text] Gemini ${params.model} HTTP ${response.status}${params.jsonMode ? "" : " (text mode)"}`,
  );

  return { ok: response.ok, status: response.status, body, text };
}

async function generateSpeciesText(
  apiKey: string,
  row: SpeciesRow,
): Promise<SpeciesText> {
  const prompt = promptFor(row);
  let lastMessage = "Gemini returned no usable species text.";

  for (const model of MODELS) {
    for (const jsonMode of [true, false]) {
      const result = await callGemini({
        apiKey,
        model,
        prompt,
        jsonMode,
      });

      if (!result.ok && isMissingModel(result.status, result.body)) {
        lastMessage = result.body.error?.message || `${model} was not found.`;
        break;
      }

      if (result.status === 401 || result.status === 403) {
        throw new Error(
          result.body.error?.message || "Gemini rejected the API key.",
        );
      }

      if (
        !result.ok &&
        jsonMode &&
        result.status === 400 &&
        /mime|json|schema/i.test(result.body.error?.message ?? "")
      ) {
        continue;
      }

      if (!result.ok) {
        lastMessage =
          result.body.error?.message ||
          `Gemini returned HTTP ${result.status}.`;
        break;
      }

      if (!result.text) {
        lastMessage =
          result.body.candidates?.[0]?.finishReason === "SAFETY"
            ? "Gemini blocked this request."
            : "Gemini returned an empty reply.";
        continue;
      }

      const parsed = parseSpeciesText(result.text);
      if (parsed) {
        return parsed;
      }

      lastMessage = "Gemini returned a reply that could not be read.";
    }
  }

  throw new Error(lastMessage);
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured." },
      { status: 503 },
    );
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
    .select(
      "id, slug, common_name, scientific_name, category, short_summary, inat_taxon_id",
    )
    .not("slug", "is", null)
    .neq("slug", "");

  if (slug) {
    query = query.eq("slug", slug).limit(1);
  } else {
    query = query
      .or('short_summary.is.null,short_summary.eq.""')
      .order("common_name", { ascending: true })
      .limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[seed-species-text] load failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).filter(
    (row): row is SpeciesRow =>
      Boolean(row.slug) && isBlank(row.short_summary),
  );

  if (slug && (data ?? []).length === 0) {
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
  let geminiCalls = 0;

  const toProcess = slug ? rows.slice(0, 1) : rows.slice(0, limit);

  if (slug && toProcess.length === 0 && (data ?? []).length > 0) {
    skipped.push(slug);
  }

  for (const row of toProcess) {
    if (isBlank(row.slug)) {
      continue;
    }

    if (!isBlank(row.short_summary)) {
      skipped.push(row.slug);
      continue;
    }

    if (geminiCalls > 0) {
      await delay(GEMINI_DELAY_MS);
    }

    try {
      geminiCalls += 1;
      const text = await generateSpeciesText(apiKey, row);

      const { error: updateError } = await supabase
        .from("species")
        .update({
          short_summary: text.short_summary,
          id_tips: text.id_tips,
          habitat: text.habitat,
          similar_species: text.similar_species,
          status: text.status,
          source_urls: sourceUrlsFor(row),
        })
        .eq("id", row.id);

      if (updateError) {
        errors.push({ slug: row.slug, error: updateError.message });
        continue;
      }

      updated.push(row.slug);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Species text seed failed.";
      console.error(`[seed-species-text] ${row.slug}: ${message}`);
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
