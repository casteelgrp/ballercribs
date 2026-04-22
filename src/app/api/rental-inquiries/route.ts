import { NextResponse } from "next/server";
import { createRentalInquiry } from "@/lib/db";
import { sendRentalInquiryNotification } from "@/lib/email";

export const runtime = "nodejs";

const VALID_BUDGETS = new Set([
  "under_25k",
  "25k_50k",
  "50k_100k",
  "100k_plus",
  "flexible"
]);

const VALID_TERM_PREFERENCES = new Set<string>([
  "short_term",
  "long_term",
  "not_sure"
]);

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidIsoDate(s: string): boolean {
  // YYYY-MM-DD from <input type="date">; reject anything else.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(s);
  return !Number.isNaN(t);
}

/**
 * POST /api/rental-inquiries
 *
 * Public endpoint powering the /rentals form. Same shape as
 * /api/agents/inquire: honeypot first, validate, insert, then await the
 * owner notification so Vercel doesn't kill the function before the
 * Resend request completes.
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Honeypot — hidden 'website' field that humans never fill. Fake success.
  if (typeof body?.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const name = String(body?.name || "").trim();
  const email = String(body?.email || "").trim();
  const phone = body?.phone ? String(body.phone).trim() : null;
  const destination = String(body?.destination || "").trim();
  const startDate = body?.start_date ? String(body.start_date).trim() : "";
  const endDate = body?.end_date ? String(body.end_date).trim() : "";
  const flexibleDates = Boolean(body?.flexible_dates);
  const groupSizeRaw = body?.group_size;
  const budgetRangeRaw = body?.budget_range ? String(body.budget_range) : "";
  const occasion = body?.occasion ? String(body.occasion).trim() : null;
  const message = body?.message ? String(body.message).trim() : null;
  // Optional listing back-link. Both are nullable — an organic inquiry
  // from the /rentals form without a ?property= param lands with nulls.
  // We take listing_slug at face value and verify listing_id if present.
  const listingSlug = body?.listing_slug ? String(body.listing_slug).trim() : null;
  const listingIdRaw = body?.listing_id;
  const listingId =
    listingIdRaw === null || listingIdRaw === undefined || listingIdRaw === ""
      ? null
      : Number(listingIdRaw);

  const termPrefRaw = body?.rental_term_preference
    ? String(body.rental_term_preference)
    : "";

  // ── Required fields ──────────────────────────────────────────────────────
  if (!name || name.length > 200) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (!email || !isValidEmail(email) || email.length > 200) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }
  if (!destination || destination.length > 200) {
    return NextResponse.json({ error: "Destination is required." }, { status: 400 });
  }

  // Group size: required per spec. Accept as number or numeric string.
  const groupSize =
    groupSizeRaw === null || groupSizeRaw === undefined || groupSizeRaw === ""
      ? null
      : Number(groupSizeRaw);
  if (groupSize === null || !Number.isFinite(groupSize) || groupSize < 1) {
    return NextResponse.json({ error: "Group size is required." }, { status: 400 });
  }

  if (!budgetRangeRaw || !VALID_BUDGETS.has(budgetRangeRaw)) {
    return NextResponse.json({ error: "Budget range is required." }, { status: 400 });
  }

  if (!termPrefRaw || !VALID_TERM_PREFERENCES.has(termPrefRaw)) {
    return NextResponse.json(
      { error: "Rental term preference is required." },
      { status: 400 }
    );
  }

  // ── Optional fields — validate only when present ────────────────────────
  let startDateValue: string | null = null;
  let endDateValue: string | null = null;
  if (!flexibleDates) {
    if (startDate) {
      if (!isValidIsoDate(startDate)) {
        return NextResponse.json({ error: "Start date is invalid." }, { status: 400 });
      }
      startDateValue = startDate;
    }
    if (endDate) {
      if (!isValidIsoDate(endDate)) {
        return NextResponse.json({ error: "End date is invalid." }, { status: 400 });
      }
      endDateValue = endDate;
    }
    if (startDateValue && endDateValue && endDateValue < startDateValue) {
      return NextResponse.json(
        { error: "End date must be on or after start date." },
        { status: 400 }
      );
    }
  }

  if (message && message.length > 5000) {
    return NextResponse.json({ error: "Message too long." }, { status: 400 });
  }

  try {
    const inquiry = await createRentalInquiry({
      name,
      email,
      phone,
      destination,
      start_date: startDateValue,
      end_date: endDateValue,
      flexible_dates: flexibleDates,
      group_size: Math.round(groupSize),
      budget_range: budgetRangeRaw,
      occasion,
      message,
      listing_id: listingId !== null && Number.isFinite(listingId) ? listingId : null,
      listing_slug: listingSlug,
      rental_term_preference: termPrefRaw as
        | "short_term"
        | "long_term"
        | "not_sure"
    });

    // Awaited, not fire-and-forget — serverless functions can be torn down
    // the moment the response returns. See matching comment in
    // /api/agents/inquire.
    console.log("[rental-route] about to send notification", { inquiryId: inquiry.id });
    try {
      await sendRentalInquiryNotification(inquiry);
      console.log("[rental-route] notification call completed", { inquiryId: inquiry.id });
    } catch (err) {
      console.error("[rental-route] notification threw unexpectedly", err);
    }

    return NextResponse.json({ ok: true, id: inquiry.id });
  } catch (err) {
    console.error("Failed to create rental inquiry:", err);
    return NextResponse.json({ error: "Failed to submit inquiry." }, { status: 500 });
  }
}
