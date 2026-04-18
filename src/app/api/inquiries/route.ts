import { NextResponse } from "next/server";
import { createInquiry, getListingByIdAdmin } from "@/lib/db";
import { sendInquiryNotification } from "@/lib/email";

export const runtime = "nodejs";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body?.name || "").trim();
  const email = String(body?.email || "").trim();
  const phone = body?.phone ? String(body.phone).trim() : null;
  const message = body?.message ? String(body.message).trim() : null;
  const timeline = body?.timeline ? String(body.timeline).trim() : null;
  const pre_approved = Boolean(body?.pre_approved);
  const listing_id = body?.listing_id ? Number(body.listing_id) : null;

  if (!name || name.length > 200) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (!email || !isValidEmail(email) || email.length > 200) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }
  if (message && message.length > 5000) {
    return NextResponse.json({ error: "Message too long." }, { status: 400 });
  }
  if (listing_id !== null && (!Number.isFinite(listing_id) || listing_id < 1)) {
    return NextResponse.json({ error: "Invalid listing." }, { status: 400 });
  }

  try {
    const inquiry = await createInquiry({
      listing_id,
      name,
      email,
      phone,
      message,
      pre_approved,
      timeline
    });

    const listing = listing_id ? await getListingByIdAdmin(listing_id) : null;

    // Fire-and-forget email - don't block response if it fails
    sendInquiryNotification(inquiry, listing).catch((err) =>
      console.error("Email notification failed:", err)
    );

    return NextResponse.json({ ok: true, id: inquiry.id });
  } catch (err) {
    console.error("Failed to create inquiry:", err);
    return NextResponse.json({ error: "Failed to submit inquiry." }, { status: 500 });
  }
}
