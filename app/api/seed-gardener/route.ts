import { NextResponse } from "next/server";
import {
  parseSeedResult,
  SEED_GARDENER_INSTRUCTION,
  validateIdea,
} from "@/lib/seed-gardener";
import type { SeedGardenerResponse } from "@/types/seed";

export const runtime = "nodejs";

const PROVIDER_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-v4-flash";
const PROVIDER_TIMEOUT_MS = 20_000;

function errorResponse(error: string, status: number) {
  return NextResponse.json<SeedGardenerResponse>({ ok: false, error }, { status });
}

function extractMessageContent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== "object") return null;
  const message = (firstChoice as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;
  const content = (message as { content?: unknown }).content;

  return typeof content === "string" && content.trim().length > 0 ? content : null;
}

function providerErrorResponse(status: number) {
  if (status === 401 || status === 403) {
    return errorResponse("The Seed Gardener provider configuration is unavailable.", 502);
  }
  if (status === 402) {
    return errorResponse("The Seed Gardener billing or balance is unavailable.", 503);
  }
  if (status === 429) {
    return errorResponse("The Seed Gardener is temporarily rate limited.", 503);
  }
  if (status >= 500) {
    return errorResponse("The Seed Gardener provider is temporarily unavailable.", 503);
  }
  return errorResponse("The Seed Gardener is unavailable right now.", 502);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("The request must contain valid JSON.", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse("The request must contain an idea.", 400);
  }

  const idea = (body as { idea?: unknown }).idea;
  const ideaError = validateIdea(idea);
  if (ideaError) return errorResponse(ideaError, 400);

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return errorResponse("The Seed Gardener is not configured right now.", 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const providerResponse = await fetch(PROVIDER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SEED_GARDENER_INSTRUCTION },
          { role: "user", content: idea },
        ],
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
        stream: false,
        max_tokens: 700,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!providerResponse.ok) {
      return providerErrorResponse(providerResponse.status);
    }

    const payload: unknown = await providerResponse.json();
    const outputText = extractMessageContent(payload);
    if (!outputText) {
      return errorResponse("The Seed Gardener returned an invalid result.", 502);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      return errorResponse("The Seed Gardener returned an invalid result.", 502);
    }

    const seed = parseSeedResult(parsed);
    if (!seed) {
      return errorResponse("The Seed Gardener returned an invalid result.", 502);
    }

    return NextResponse.json<SeedGardenerResponse>({ ok: true, seed });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return errorResponse("The Seed Gardener request timed out.", 504);
    }
    return errorResponse("The Seed Gardener is unavailable right now.", 502);
  } finally {
    clearTimeout(timeout);
  }
}
