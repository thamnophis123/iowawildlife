import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash-lite",
  "gemini-1.5-flash",
] as const;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const PROMPT = `Identify the animal in this photo if reasonably possible.
Use unknown only when it is not an organism or the photo is unusable.
Prefer species that occur in Iowa.
Return JSON only: { "common_name": "...", "scientific_name": "...", "confidence": 0.0 }`;

type IdentifyResult = {
  unknown: boolean;
  common_name: string | null;
  scientific_name: string | null;
  confidence: number | null;
  model: string;
};

type GeminiBody = {
  error?: { message?: string; status?: string };
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string }[] };
  }[];
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
  const rawType = file.type.toLowerCase();
  if (rawType === "image/jpg" || rawType === "image/pjpeg") {
    return "image/jpeg";
  }
  if (ALLOWED_TYPES.has(rawType)) {
    return rawType;
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

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseConfidence(value: unknown) {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isFinite(raw)) {
    return null;
  }

  const scaled = raw > 1 && raw <= 100 ? raw / 100 : raw;
  return Math.min(1, Math.max(0, scaled));
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

function nameFromPlainText(text: string) {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const lines = text
    .split("\n")
    .map((line) =>
      line
        .replace(/^[\s>*#-]+/, "")
        .replace(/\*+/g, "")
        .replace(/^["']|["']$/g, "")
        .trim(),
    )
    .filter(Boolean);

  for (const line of lines) {
    if (/^unknown$/i.test(line)) {
      continue;
    }
    if (line.length > 80 || /[{}]/.test(line)) {
      continue;
    }
    if (/^(here|json|response|the photo|identify)\b/i.test(line)) {
      continue;
    }

    return line
      .replace(/^(it |this )?(is|looks like|appears to be)\s+/i, "")
      .replace(/\.$/, "")
      .trim();
  }

  if (
    cleaned &&
    cleaned.length <= 80 &&
    !/[{}]/.test(cleaned) &&
    !/^unknown$/i.test(cleaned)
  ) {
    return cleaned;
  }

  return null;
}

function normalizeGuess(
  parsed: Record<string, unknown>,
  model: string,
): IdentifyResult | null {
  const common =
    stringField(parsed.common_name) || stringField(parsed.commonName);
  const scientific =
    stringField(parsed.scientific_name) || stringField(parsed.scientificName);
  const confidence = parseConfidence(parsed.confidence);
  const looksUnknown =
    parsed.unknown === true ||
    common.toLowerCase() === "unknown" ||
    scientific.toLowerCase() === "unknown";

  if (looksUnknown && !scientific && (common.toLowerCase() === "unknown" || !common)) {
    return {
      unknown: true,
      common_name: null,
      scientific_name: null,
      confidence,
      model,
    };
  }

  if (!common && !scientific) {
    return null;
  }

  return {
    unknown: false,
    common_name: common && common.toLowerCase() !== "unknown" ? common : null,
    scientific_name:
      scientific && scientific.toLowerCase() !== "unknown" ? scientific : null,
    confidence,
    model,
  };
}

function guessFromText(text: string, model: string): IdentifyResult | null {
  const parsed = extractJsonObject(text);
  if (parsed) {
    const fromJson = normalizeGuess(parsed, model);
    if (fromJson) {
      return fromJson;
    }
  }

  const plain = nameFromPlainText(text);
  if (!plain) {
    return null;
  }

  return {
    unknown: false,
    common_name: plain,
    scientific_name: null,
    confidence: null,
    model,
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

async function callGemini(params: {
  apiKey: string;
  model: string;
  mimeType: string;
  base64: string;
  lat: number | null;
  lng: number | null;
  jsonMode: boolean;
}) {
  const locationLine =
    params.lat != null && params.lng != null
      ? `\nThe photo was taken near latitude ${params.lat}, longitude ${params.lng}.`
      : "";

  const generationConfig: Record<string, unknown> = { temperature: 0.2 };
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
        contents: [
          {
            parts: [
              { text: `${PROMPT}${locationLine}` },
              {
                inlineData: {
                  mimeType: params.mimeType,
                  data: params.base64,
                },
              },
            ],
          },
        ],
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
    `[identify] Gemini ${params.model} HTTP ${response.status}${params.jsonMode ? "" : " (text mode)"}`,
  );
  console.info(`[identify] raw text reply: ${text || raw.slice(0, 4000)}`);

  return { ok: response.ok, status: response.status, body, text, raw };
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
    const modes = [true, false];

    for (const jsonMode of modes) {
      const result = await callGemini({
        apiKey,
        model,
        mimeType,
        base64,
        lat,
        lng,
        jsonMode,
      });

      if (!result.ok && isMissingModel(result.status, result.body)) {
        lastStatus = result.status;
        lastMessage = result.body.error?.message || `${model} was not found.`;
        break;
      }

      if (result.status === 401 || result.status === 403) {
        return NextResponse.json(
          {
            error:
              result.body.error?.message ||
              "Gemini rejected the API key.",
          },
          { status: result.status },
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
        lastStatus = result.status >= 400 ? result.status : 502;
        lastMessage =
          result.body.error?.message ||
          `Gemini returned HTTP ${result.status}.`;
        break;
      }

      if (!result.text) {
        lastStatus = 502;
        lastMessage =
          result.body.candidates?.[0]?.finishReason === "SAFETY"
            ? "Gemini blocked this photo."
            : "Gemini returned an empty reply.";
        break;
      }

      const guess = guessFromText(result.text, model);
      if (guess) {
        return NextResponse.json(guess);
      }

      lastStatus = 502;
      lastMessage = "Gemini returned a reply that could not be read.";
      break;
    }
  }

  return NextResponse.json({ error: lastMessage }, { status: lastStatus });
}
