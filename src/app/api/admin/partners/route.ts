import { NextResponse } from "next/server";
import {
  createPartner,
  getAllPartners,
  getPartnerBySlug
} from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import type { PartnerCtaMode, PartnerType } from "@/lib/types";

export const runtime = "nodejs";

const SLUG_RX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isPartnerType(v: unknown): v is PartnerType {
  return v === "affiliate" || v === "direct";
}
function isPartnerCtaMode(v: unknown): v is PartnerCtaMode {
  return v === "outbound_link" || v === "inquiry_form";
}

export async function GET() {
  try {
    await requireOwner();
  } catch (res) {
    return res as Response;
  }
  const partners = await getAllPartners();
  return NextResponse.json({ partners });
}

export async function POST(req: Request) {
  try {
    await requireOwner();
  } catch (res) {
    return res as Response;
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body?.name ?? "").trim();
  const slug = String(body?.slug ?? "").trim().toLowerCase();
  const type = body?.type;
  const ctaMode = body?.cta_mode;
  const ctaLabel = String(body?.cta_label ?? "").trim();
  const logoUrl = body?.logo_url ? String(body.logo_url).trim() : null;
  const disclosureText = body?.disclosure_text
    ? String(body.disclosure_text).trim()
    : null;
  const forwardInquiriesTo = body?.forward_inquiries_to
    ? String(body.forward_inquiries_to).trim()
    : null;
  const active = body?.active === undefined ? true : Boolean(body.active);

  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!slug) return NextResponse.json({ error: "Slug is required." }, { status: 400 });
  if (!SLUG_RX.test(slug)) {
    return NextResponse.json(
      { error: "Slug must be lowercase kebab-case." },
      { status: 400 }
    );
  }
  if (!isPartnerType(type)) {
    return NextResponse.json({ error: "Invalid type." }, { status: 400 });
  }
  if (!isPartnerCtaMode(ctaMode)) {
    return NextResponse.json({ error: "Invalid CTA mode." }, { status: 400 });
  }
  if (!ctaLabel) {
    return NextResponse.json({ error: "CTA label is required." }, { status: 400 });
  }
  // Conditional gate: forward_inquiries_to required only when
  // cta_mode='inquiry_form'. Outbound-link partners route via the
  // listing's tracking URL — no forwarding email needed.
  if (ctaMode === "inquiry_form") {
    if (!forwardInquiriesTo) {
      return NextResponse.json(
        { error: "Forward inquiries to is required for inquiry-form partners." },
        { status: 400 }
      );
    }
    if (!EMAIL_RX.test(forwardInquiriesTo)) {
      return NextResponse.json(
        { error: "Forward inquiries to must be a valid email." },
        { status: 400 }
      );
    }
  }

  // Pre-check slug uniqueness for a clean 409 — the DB UNIQUE
  // constraint would also catch it, but the route would surface as a
  // generic 500 without this branch.
  const existing = await getPartnerBySlug(slug);
  if (existing) {
    return NextResponse.json(
      { error: "That slug is already taken." },
      { status: 409 }
    );
  }

  try {
    const partner = await createPartner({
      name,
      slug,
      type,
      cta_mode: ctaMode,
      cta_label: ctaLabel,
      logo_url: logoUrl,
      disclosure_text: disclosureText,
      forward_inquiries_to: forwardInquiriesTo,
      active
    });
    return NextResponse.json({ partner });
  } catch (err: any) {
    // Race-window on slug uniqueness: two simultaneous creates could
    // both pass the pre-check. The DB still enforces UNIQUE — surface
    // as 409 instead of 500 if the race fires.
    if (err?.code === "23505") {
      return NextResponse.json(
        { error: "That slug is already taken." },
        { status: 409 }
      );
    }
    console.error("Failed to create partner:", err);
    return NextResponse.json(
      { error: "Failed to create partner." },
      { status: 500 }
    );
  }
}
