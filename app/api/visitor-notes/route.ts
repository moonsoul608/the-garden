import { NextResponse } from "next/server";

import { createPublicServerClient } from "@/lib/supabase/public-server";
import { prepareVisitorNoteInput } from "@/lib/visitor-notes";

export const runtime = "nodejs";

type VisitorNoteResponse =
  | { ok: true; message: string }
  | { ok: false; error: string };

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_SUBMISSIONS = 3;
const rateLimitBuckets = new Map<string, number[]>();

function jsonResponse(payload: VisitorNoteResponse, status = 200) {
  return NextResponse.json<VisitorNoteResponse>(payload, { status });
}

function clientKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwardedFor || realIp || "unknown";
}

function isRateLimited(key: string) {
  const now = Date.now();
  const recent = (rateLimitBuckets.get(key) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );
  if (recent.length >= RATE_LIMIT_MAX_SUBMISSIONS) {
    rateLimitBuckets.set(key, recent);
    return true;
  }
  recent.push(now);
  rateLimitBuckets.set(key, recent);
  return false;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "The request must contain valid JSON." }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ ok: false, error: "The request must contain a note." }, 400);
  }

  const payload = body as { name?: unknown; message?: unknown; website?: unknown };
  if (typeof payload.website === "string" && payload.website.trim()) {
    return jsonResponse({ ok: false, error: "The note could not be sent." }, 400);
  }

  const parsed = prepareVisitorNoteInput(payload);
  if (!parsed.ok) {
    return jsonResponse({ ok: false, error: parsed.error }, 400);
  }

  if (isRateLimited(clientKey(request))) {
    return jsonResponse(
      { ok: false, error: "Please wait before sending another note." },
      429,
    );
  }

  try {
    const supabase = createPublicServerClient();
    const { error } = await supabase.from("visitor_notes").insert(parsed.note);
    if (error) {
      return jsonResponse({ ok: false, error: "The note could not be sent right now." }, 503);
    }
  } catch {
    return jsonResponse({ ok: false, error: "The note could not be sent right now." }, 503);
  }

  return jsonResponse({
    ok: true,
    message: "Your note was sent privately. Thank you.",
  });
}

