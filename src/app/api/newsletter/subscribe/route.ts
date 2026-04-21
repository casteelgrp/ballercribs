import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Minimal RFC-flavored email check. Same rule applied on both the form
 * (browser) and server, so we never depend on client-side validation.
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * POST /api/newsletter/subscribe
 *
 * Wraps Beehiiv's subscription endpoint. All signup surfaces (/newsletter
 * page, homepage CTA, listing detail CTA) send the same email-only payload.
 *
 * Logging contract: every branch emits a single structured `[newsletter]`
 * line so Vercel log grep shows the full picture of what happened. The API
 * key is never logged — only its presence and length. Beehiiv's response
 * body is parsed when it's JSON and logged as an object; when it's text,
 * logged verbatim. The Beehiiv-reported message is surfaced to the client
 * in the error payload so the banner can show the real cause instead of a
 * generic "subscription failed."
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    console.warn("[newsletter] invalid JSON on request");
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = String((body as { email?: unknown })?.email || "").trim().toLowerCase();

  if (!email || !isValidEmail(email)) {
    console.warn("[newsletter] rejected — bad email", { providedLength: email.length });
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const apiKey = process.env.BEEHIIV_API_KEY;
  const pubId = process.env.BEEHIIV_PUBLICATION_ID;

  // Structured env audit: prints at start of every real attempt so we can
  // confirm Vercel env in the log line alongside the outgoing request.
  console.log("[newsletter] attempt", {
    email,
    env: {
      hasApiKey: Boolean(apiKey),
      apiKeyLength: apiKey?.length ?? 0,
      hasPubId: Boolean(pubId),
      pubIdLength: pubId?.length ?? 0
    }
  });

  if (!apiKey || !pubId) {
    console.error("[newsletter] env vars missing — cannot call Beehiiv");
    return NextResponse.json(
      { error: "Newsletter temporarily unavailable" },
      { status: 500 }
    );
  }

  // Beehiiv payload. `reactivate_existing` lets returning subscribers
  // re-subscribe without a 409; `send_welcome_email` triggers the
  // configured welcome automation. UTM fields are free-form tagging.
  const payload = {
    email,
    reactivate_existing: true,
    send_welcome_email: true,
    utm_source: "ballercribs_site",
    utm_medium: "newsletter_subscribe"
  };

  const url = `https://api.beehiiv.com/v2/publications/${pubId}/subscriptions`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    // Network-level failure — Beehiiv unreachable, DNS, timeout, etc.
    console.error("[newsletter] fetch threw", {
      url,
      payload,
      error: err instanceof Error ? { name: err.name, message: err.message } : err
    });
    return NextResponse.json(
      { error: "Newsletter service unreachable. Please try again." },
      { status: 502 }
    );
  }

  // Parse the response body once; log-friendly shape regardless of
  // whether Beehiiv returned JSON or plain text.
  const contentType = res.headers.get("content-type") ?? "";
  let parsedBody: unknown;
  let rawText: string | null = null;
  if (contentType.includes("application/json")) {
    try {
      parsedBody = await res.json();
    } catch {
      parsedBody = null;
    }
  } else {
    rawText = await res.text();
    parsedBody = rawText;
  }

  if (!res.ok) {
    console.error("[newsletter] Beehiiv returned non-OK", {
      status: res.status,
      statusText: res.statusText,
      contentType,
      body: parsedBody,
      requestPayload: payload
    });

    // Try to surface Beehiiv's own message so the user sees something
    // actionable. Beehiiv's common error shapes:
    //   { errors: [{ message: "..." }] }
    //   { message: "..." }
    //   plain text
    const beehiivMessage = extractBeehiivMessage(parsedBody);

    return NextResponse.json(
      {
        error: beehiivMessage
          ? `Beehiiv: ${beehiivMessage}`
          : "Subscription failed. Please try again.",
        // Include the status so the client (and any ops tooling) can
        // distinguish "we were rejected" from "service down".
        providerStatus: res.status
      },
      { status: 502 }
    );
  }

  console.log("[newsletter] Beehiiv accepted", {
    status: res.status,
    body: parsedBody
  });
  return NextResponse.json({ ok: true });
}

/**
 * Try several known Beehiiv error shapes and return the first readable
 * message. Returns null when nothing matches — caller falls back to
 * generic copy.
 */
function extractBeehiivMessage(body: unknown): string | null {
  if (typeof body === "string") return body.trim() || null;
  if (!body || typeof body !== "object") return null;

  const obj = body as {
    errors?: Array<{ message?: string }>;
    message?: string;
    error?: string;
  };
  if (Array.isArray(obj.errors) && obj.errors.length > 0) {
    const first = obj.errors[0]?.message;
    if (typeof first === "string" && first.trim()) return first.trim();
  }
  if (typeof obj.message === "string" && obj.message.trim()) return obj.message.trim();
  if (typeof obj.error === "string" && obj.error.trim()) return obj.error.trim();
  return null;
}
