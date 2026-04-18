import { NextResponse } from "next/server";
import { createAgentInquiry } from "@/lib/db";
import { sendAgentInquiryNotification } from "@/lib/email";
import type { AgentInquiryType } from "@/lib/types";

export const runtime = "nodejs";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normaliseType(raw: unknown): AgentInquiryType {
  return raw === "referral" ? "referral" : raw === "other" ? "other" : "featured";
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Honeypot — hidden 'website' field that humans never fill. If populated,
  // we return a fake success so bots don't learn to bypass. No DB write, no email.
  if (typeof body?.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const name = String(body?.name || "").trim();
  const email = String(body?.email || "").trim();
  const phone = body?.phone ? String(body.phone).trim() : null;
  const brokerage = body?.brokerage ? String(body.brokerage).trim() : null;
  const cityState = body?.city_state ? String(body.city_state).trim() : null;
  const message = body?.message ? String(body.message).trim() : null;
  const inquiryType = normaliseType(body?.inquiry_type);

  if (!name || name.length > 200) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (!email || !isValidEmail(email) || email.length > 200) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }
  if (!cityState) {
    return NextResponse.json({ error: "City/State is required." }, { status: 400 });
  }
  if (message && message.length > 5000) {
    return NextResponse.json({ error: "Message too long." }, { status: 400 });
  }

  try {
    const inquiry = await createAgentInquiry({
      name,
      email,
      phone,
      brokerage,
      city_state: cityState,
      inquiry_type: inquiryType,
      message
    });

    // Awaited, not fire-and-forget. Fire-and-forget was probably the bug:
    // on Vercel serverless the function can be terminated the moment the
    // response is sent, so the async Resend HTTP call (and its logs) never
    // complete. Adds ~200-500ms to the form response but guarantees the
    // email attempt finishes and the logs flush.
    console.log("[agent-route] about to send notification", { inquiryId: inquiry.id });
    try {
      await sendAgentInquiryNotification(inquiry);
      console.log("[agent-route] notification call completed", { inquiryId: inquiry.id });
    } catch (err) {
      // sendAgentInquiryNotification catches its own errors, so this is
      // belt-and-braces for anything that escapes.
      console.error("[agent-route] notification threw unexpectedly", err);
    }

    return NextResponse.json({ ok: true, id: inquiry.id });
  } catch (err) {
    console.error("Failed to create agent inquiry:", err);
    return NextResponse.json({ error: "Failed to submit inquiry." }, { status: 500 });
  }
}
