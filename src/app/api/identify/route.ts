import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const MODELS = ["gemini-2.5-flash-lite", "gemini-2.0-flash"] as const;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const PROMPT = `This is a wild animal photo from Iowa.
Return JSON only with this shape:
{"common_name": string, "scientific_name": string, "confidence": number}
or {"unknown": true}.
confidence is a number from 0 to 1.
Do not invent species that are not plausible for Iowa.
If you are unsure, return unknown.`;

type IdentifyResult = {
  unknown: boolean;
  common_name: string | null;
  scientific_name: string | null;
  confidence: number | null;
  model: string;
};

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  return null;
}

function parseCoordinate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mimeTypeFor(file: File) {
  if (ALLOWED_TYPES.has(file.type)) {
    return file.type;
  }

  const name = file.name.toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (name.endsWith(".png")) {
    return "image/png";
  }
  if (name.endsWith(".webp")) {
    return "image/webp";
  }
  if (name.endsWith(".heic")) {
    return "image/heic";
  }
  if (name.endsWith(".heif")) {
    return "image/heif";
  }

  return null;
}

function parseModelJson(text: string) {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(trimmed) as Record<string, unknown>;
}

function normalizeGuess(
  parsed: Record<string, unknown>,
  model: string,
): IdentifyResult {
  const unknownFlag = parsed.unknown === true;
  const common =
    typeof parsed.common_name === "string" ? parsed.common_name.trim() : "";
  const scientific =
    typeof parsed.scientific_name === "string"
      ? parsed.scientific_name.trim()
      : "";
  const confidenceRaw =
    typeof parsed.confidence === "number"
      ? parsed.confidence
      : typeof parsed.confidence === "string"
        ? Number(parsed.confidence)
        : null;
  const confidence =
    confidenceRaw != null && Number.isFinite(confidenceRaw)
      ? Math.min(1, Math.max(0, confidenceRaw))
      : null;

  const isUnknown =
    unknownFlag ||
    common.toLowerCase() === "unknown" ||
    (!common && !scientific);

  if (isUnknown) {
    return {
      unknown: true,
      common_name: null,
      scientific_name: null,
      confidence,
      model,
    };
  }

  return {
    unknown: false,
    common_name: common || null,
    scientific_name: scientific || null,
    confidence,
    model,
  };
}

function geminiText(payload: {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}) {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

async function callGemini(params: {
  apiKey: string;
  model: string;
  mimeType: string;
  base64: string;
  lat: number | null;
  lng: number | null;
}) {
  const locationLine =
    params.lat != null && params.lng != null
      ? `\nThe photo was taken near latitude ${params.lat}, longitude ${params.lng}.`
      : "";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": params.apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${PROMPT}${locationLine}` },
              {
                inline_data: {
                  mime_type: params.mimeType,
                  data: params.base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  const body = (await response.json()) as {
    error?: { message?: string; status?: string };
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  return { ok: response.ok, status: response.status, body };
}

export async function GET() {
  const unauthorized = await requireUser();
  if (unauthorized) {
    return unauthorized;
  }

  return NextResponse.json({
    ok: true,
    configured: Boolean(process.env.GEMINI_API_KEY),
  });
}

export async function POST(request: Request) {
  const unauthorized = await requireUser();
  if (unauthorized) {
    return unauthorized;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured." },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const photo = form.get("photo") ?? form.get("image");
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: "A photo is required." }, { status: 400 });
  }

  if (photo.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Photo is too large to identify." },
      { status: 413 },
    );
  }

  const mimeType = mimeTypeFor(photo);
  if (!mimeType) {
    return NextResponse.json(
      { error: "Choose a JPEG, PNG, WebP, or HEIC photo." },
      { status: 400 },
    );
  }

  const lat = parseCoordinate(form.get("lat"));
  const lng = parseCoordinate(form.get("lng"));
  const buffer = Buffer.from(await photo.arrayBuffer());
  const base64 = buffer.toString("base64");

  let lastStatus = 502;
  let lastMessage = "Species identification failed.";

  for (const model of MODELS) {
    const result = await callGemini({
      apiKey,
      model,
      mimeType,
      base64,
      lat,
      lng,
    });

    const missingModel =
      result.status === 404 ||
      result.body.error?.status === "NOT_FOUND" ||
      /not found|not supported/i.test(result.body.error?.message ?? "");

    if (!result.ok && missingModel && model !== MODELS[MODELS.length - 1]) {
      continue;
    }

    if (!result.ok) {
      lastStatus = result.status >= 400 ? result.status : 502;
      lastMessage = result.body.error?.message || lastMessage;
      break;
    }

    const text = geminiText(result.body);
    if (!text) {
      return NextResponse.json({
        unknown: true,
        common_name: null,
        scientific_name: null,
        confidence: null,
        model,
      } satisfies IdentifyResult);
    }

    try {
      return NextResponse.json(normalizeGuess(parseModelJson(text), model));
    } catch {
      return NextResponse.json({
        unknown: true,
        common_name: null,
        scientific_name: null,
        confidence: null,
        model,
      } satisfies IdentifyResult);
    }
  }

  return NextResponse.json({ error: lastMessage }, { status: lastStatus });
}
