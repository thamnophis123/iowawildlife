import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_MESSAGE = 5000;
const MAX_NAME = 200;
const MAX_EMAIL = 320;

function textField(value: unknown, max: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, max);
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (textField(body.company, 200) || textField(body.website, 200)) {
    return NextResponse.json({ ok: true });
  }

  const name = textField(body.name, MAX_NAME) || null;
  const email = textField(body.email, MAX_EMAIL);
  const message = textField(body.message, MAX_MESSAGE);

  if (!message) {
    return NextResponse.json({ error: "A message is required." }, { status: 400 });
  }

  if (email && !looksLikeEmail(email)) {
    return NextResponse.json(
      { error: "Enter a valid email, or leave it blank." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Contact form is unavailable right now." },
      { status: 503 },
    );
  }

  const { error } = await supabase.from("contact_messages").insert({
    name,
    email: email || null,
    message,
  });

  if (error) {
    console.error("[contact] insert failed", error.message);
    return NextResponse.json(
      { error: "Message could not be sent. Try again later." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
