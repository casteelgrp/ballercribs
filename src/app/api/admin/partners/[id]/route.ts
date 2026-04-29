import { NextResponse } from "next/server";
import {
  getPartnerById,
  getPartnerBySlug,
  updatePartner
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner();
  } catch (res) {
    return res as Response;
  }

  const { id } = await params;
  const existing = await getPartnerById(id).catch(() => null);
  if (!existing) {
    return NextResponse.json({ error: "Partner not found." }, { status: 404 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Coerce fields, falling back to existing values when keys are absent.
  // The form always sends every field, but the route stays lenient so
  // future scripted callers can patch a single attribute.
  const name = body?.name !== undefined ? String(body.name).trim() : existing.name;
  const slug =
    body?.slug !== undefined
      ? String(body.slug).trim().toLowerCase()
      : existing.slug;
  const type = body?.type !== undefined ? body.type : existing.type;
  const ctaMode = body?.cta_mode !== undefined ? body.cta_mode : existing.cta_mode;
  const ctaLabel =
    body?.cta_label !== undefined ? String(body.cta_label).trim() : existing.cta_label;
  const logoUrl =
    body?.logo_url === undefined
      ? existing.logo_url
      : body.logo_url
        ? String(body.logo_url).trim()
        : null;
  const disclosureText =
    body?.disclosure_text === undefined
      ? existing.disclosure_text
      : body.disclosure_text
        ? String(body.disclosure_text).trim()
        : null;
  const forwardInquiriesTo =
    body?.forward_inquiries_to === undefined
      ? existing.forward_inquiries_to
      : body.forward_inquiries_to
        ? String(body.forward_inquiries_to).trim()
        : null;
  const active =
    body?.active === undefined ? existing.active : Boolean(body.active);

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

  // Slug uniqueness check excludes the partner being edited — saving
  // without changing the slug would otherwise fail against itself.
  // The DB UNIQUE catches the race-window case below.
  if (slug !== existing.slug) {
    const conflict = await getPartnerBySlug(slug);
    if (conflict && conflict.id !== existing.id) {
      return NextResponse.json(
        { error: "That slug is already taken." },
        { status: 409 }
      );
    }
  }

  try {
    const updated = await updatePartner(id, {
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
    if (!updated) {
      return NextResponse.json({ error: "Update failed." }, { status: 500 });
    }
    return NextResponse.json({ partner: updated });
  } catch (err: any) {
    if (err?.code === "23505") {
      return NextResponse.json(
        { error: "That slug is already taken." },
        { status: 409 }
      );
    }
    console.error("Failed to update partner:", err);
    return NextResponse.json(
      { error: "Failed to update partner." },
      { status: 500 }
    );
  }
}
