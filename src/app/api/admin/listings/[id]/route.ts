import { NextResponse } from "next/server";
import {
  deleteListing,
  getDestinationById,
  getListingByIdAdmin,
  getPartnerById,
  transitionListingStatus,
  updateListing
} from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  canApprove,
  canArchive,
  canDelete,
  canEdit,
  canPublishDirect,
  canRestoreFromArchive,
  canSendBackToDraft,
  canSubmitForReview
} from "@/lib/permissions";
import { validateSlug } from "@/lib/format";
import { isCurrencyCode } from "@/lib/currency";
import { revalidateListingSurfaces } from "@/lib/revalidate-listings";
import { resolvePartnerFields, resolveRentalFields } from "@/lib/listing-validation";
import type { GalleryItem, ListingStatus } from "@/lib/types";

export const runtime = "nodejs";

function normalizeGalleryInput(raw: unknown): GalleryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") {
        const u = item.trim();
        return u ? { url: u, caption: null } : null;
      }
      if (item && typeof item === "object" && typeof (item as any).url === "string") {
        const url = String((item as any).url).trim();
        if (!url) return null;
        const cap = (item as any).caption;
        return {
          url,
          caption: typeof cap === "string" && cap.trim() !== "" ? cap : null
        };
      }
      return null;
    })
    .filter((x): x is GalleryItem => x !== null);
}

type Action =
  | "submit_for_review"
  | "publish"
  | "approve"
  | "send_back_to_draft"
  | "archive"
  | "restore"
  | "update_fields";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const listing = await getListingByIdAdmin(id);
  if (!listing) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  let body: { action?: unknown; fields?: any; transition_to?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = String(body.action || "") as Action;

  // ── Field updates (called from the edit form) ────────────────────────────
  if (action === "update_fields") {
    if (!canEdit(user, listing)) {
      return NextResponse.json({ error: "Not allowed to edit this listing." }, { status: 403 });
    }
    const fields = body.fields ?? {};

    // Normalize partial input. undefined = leave alone; explicit null = clear (for nullable fields).
    const updates: Parameters<typeof updateListing>[1] = {};
    if (typeof fields.slug === "string" && fields.slug.trim()) {
      const newSlug = fields.slug.trim().toLowerCase();
      if (newSlug !== listing.slug) {
        const slugError = validateSlug(newSlug);
        if (slugError) {
          return NextResponse.json({ error: `Slug: ${slugError.message}` }, { status: 400 });
        }
        updates.slug = newSlug;
      }
    }
    if (typeof fields.title === "string") updates.title = fields.title.trim();
    if (typeof fields.location === "string") updates.location = fields.location.trim();
    if (typeof fields.description === "string") updates.description = fields.description.trim();
    if (typeof fields.hero_image_url === "string")
      updates.hero_image_url = fields.hero_image_url.trim();
    if (fields.price_usd !== undefined) {
      const p = Number(fields.price_usd);
      if (!Number.isFinite(p) || p < 0) {
        return NextResponse.json({ error: "Invalid price." }, { status: 400 });
      }
      updates.price_usd = Math.round(p);
    }
    if ("currency" in fields) {
      // Defensive: silently clamp to USD if the caller sends something we
      // don't support. The dropdown is the source of truth server-side.
      updates.currency = isCurrencyCode(fields.currency) ? fields.currency : "USD";
    }
    if ("bedrooms" in fields) {
      updates.bedrooms =
        fields.bedrooms === null || fields.bedrooms === "" ? null : Number(fields.bedrooms);
    }
    if ("bathrooms" in fields) {
      updates.bathrooms =
        fields.bathrooms === null || fields.bathrooms === "" ? null : Number(fields.bathrooms);
    }
    if ("square_feet" in fields) {
      updates.square_feet =
        fields.square_feet === null || fields.square_feet === "" ? null : Number(fields.square_feet);
    }
    if ("gallery_image_urls" in fields) {
      updates.gallery_image_urls = normalizeGalleryInput(fields.gallery_image_urls);
    }
    if ("social_cover_url" in fields) {
      updates.social_cover_url =
        typeof fields.social_cover_url === "string" && fields.social_cover_url.trim()
          ? fields.social_cover_url.trim()
          : null;
    }
    if ("agent_name" in fields) {
      updates.agent_name =
        typeof fields.agent_name === "string" && fields.agent_name.trim()
          ? fields.agent_name.trim()
          : null;
    }
    if ("agent_brokerage" in fields) {
      updates.agent_brokerage =
        typeof fields.agent_brokerage === "string" && fields.agent_brokerage.trim()
          ? fields.agent_brokerage.trim()
          : null;
    }
    if ("featured" in fields) updates.featured = Boolean(fields.featured);
    if ("seo_title" in fields) {
      updates.seo_title =
        typeof fields.seo_title === "string" && fields.seo_title.trim()
          ? fields.seo_title.trim()
          : null;
    }
    if ("seo_description" in fields) {
      updates.seo_description =
        typeof fields.seo_description === "string" && fields.seo_description.trim()
          ? fields.seo_description.trim()
          : null;
    }

    // Destination tag (D10). Optional. null clears, missing key
    // preserves. Pre-verify the id resolves to a real row so a stale
    // dropdown doesn't surface as a generic 23503 from the FK.
    if ("destination_id" in fields) {
      const raw = fields.destination_id;
      if (raw === null || raw === "") {
        updates.destination_id = null;
      } else {
        const n = Number(raw);
        if (!Number.isInteger(n) || n <= 0) {
          return NextResponse.json(
            { error: "Invalid destination_id." },
            { status: 400 }
          );
        }
        const dest = await getDestinationById(n).catch(() => null);
        if (!dest) {
          return NextResponse.json(
            { error: "Destination not found." },
            { status: 400 }
          );
        }
        updates.destination_id = n;
      }
    }

    // Listing type + rental fields. The form always sends the full rental
    // surface when `listing_type` is present, so we validate the whole
    // combo together via the same helper the POST uses. When the payload
    // doesn't mention listing_type at all, we leave those columns alone.
    if ("listing_type" in fields) {
      const rentalResolution = resolveRentalFields(fields);
      if (!rentalResolution.ok) {
        return NextResponse.json({ error: rentalResolution.error }, { status: 400 });
      }
      const rental = rentalResolution.data;
      updates.listing_type = rental.listing_type;
      updates.rental_term = rental.rental_term;
      updates.rental_price_cents = rental.rental_price_cents;
      updates.rental_price_unit = rental.rental_price_unit;
      // Flipping rental ↔ sale clears the opposite side. When switching to
      // rental, force price_usd to 0 so the sale-side value doesn't linger
      // alongside the rental pricing.
      if (rental.listing_type === "rental") {
        updates.price_usd = 0;
      }

      // Partner attribution rides on the same listing_type branch —
      // the rental form always sends partner_id when it sends
      // listing_type. Validation reads cta_mode from the live partner
      // row; URLs come back null on inquiry_form regardless of what
      // the client sent (mode-switch cleanup).
      const partnerIdRaw =
        typeof fields.partner_id === "string" && fields.partner_id.trim()
          ? fields.partner_id.trim()
          : null;
      const partner =
        rental.listing_type === "rental" && partnerIdRaw
          ? await getPartnerById(partnerIdRaw).catch(() => null)
          : null;
      if (rental.listing_type === "rental" && partnerIdRaw && !partner) {
        return NextResponse.json({ error: "Partner not found." }, { status: 400 });
      }
      const partnerResolution = resolvePartnerFields(
        fields,
        rental.listing_type,
        partner
      );
      if (!partnerResolution.ok) {
        return NextResponse.json(
          { error: partnerResolution.error },
          { status: 400 }
        );
      }
      updates.partner_id = partnerResolution.data.partner_id;
      updates.partner_property_url = partnerResolution.data.partner_property_url;
      updates.partner_tracking_url = partnerResolution.data.partner_tracking_url;
    }

    let updated;
    try {
      updated = await updateListing(id, updates);
    } catch (err: unknown) {
      const e = err as { code?: string; constraint?: string } | null;
      if (e?.code === "23505") {
        return NextResponse.json(
          { error: "That slug is already taken — try another." },
          { status: 409 }
        );
      }
      throw err;
    }
    if (!updated) {
      return NextResponse.json({ error: "Update failed." }, { status: 500 });
    }

    // Optional atomic transition. Form's "Submit for Review" path sends
    // update_fields + transition_to='review' so we save fields and flip
    // status in one round-trip — no risk of saving without transitioning
    // (or vice versa) due to a network glitch between two requests.
    const transitionTo = body.transition_to;
    if (transitionTo === undefined || transitionTo === null) {
      // Only invalidate public caches when the edit could be seen —
      // drafts and review-queue rows aren't on any public surface.
      if (updated.status === "published") {
        revalidateListingSurfaces(updated.slug, updated.listing_type);
      }
      return NextResponse.json({ ok: true, listing: updated });
    }
    if (
      transitionTo !== "draft" &&
      transitionTo !== "review" &&
      transitionTo !== "published" &&
      transitionTo !== "archived"
    ) {
      return NextResponse.json({ error: "Invalid transition_to value." }, { status: 400 });
    }

    // Re-check permissions against the *updated* listing state.
    let allowed = false;
    let reviewerId: number | null = null;
    switch (transitionTo) {
      case "review":
        allowed = canSubmitForReview(user, updated);
        break;
      case "published":
        // Owner can either approve a review submission or publish their own draft directly.
        if (canApprove(user, updated)) {
          allowed = true;
          reviewerId = user.id;
        } else if (canPublishDirect(user, updated)) {
          allowed = true;
          reviewerId = user.id;
        }
        break;
      case "draft":
        allowed = canSendBackToDraft(user, updated) || canRestoreFromArchive(user, updated);
        break;
      case "archived":
        allowed = canArchive(user, updated);
        break;
    }
    if (!allowed) {
      return NextResponse.json(
        { error: `Saved fields, but not allowed to transition to ${transitionTo}.` },
        { status: 403 }
      );
    }

    const transitioned = await transitionListingStatus(id, transitionTo, reviewerId);
    if (!transitioned) {
      return NextResponse.json({ error: "Transition failed after save." }, { status: 500 });
    }
    // Transition either added the row to public surfaces (→ published) or
    // removed it (→ archived / draft from published). Either way the public
    // grid + homepage need to re-render; the slug page also needs it so a
    // newly-unpublished listing doesn't linger on the detail URL.
    revalidateListingSurfaces(transitioned.slug, transitioned.listing_type);
    return NextResponse.json({ ok: true, listing: transitioned });
  }

  // ── Status transitions ───────────────────────────────────────────────────
  let target: ListingStatus | null = null;
  let reviewerId: number | null = null;

  switch (action) {
    case "submit_for_review":
      if (!canSubmitForReview(user, listing))
        return NextResponse.json({ error: "Not allowed." }, { status: 403 });
      target = "review";
      break;
    case "publish":
      if (!canPublishDirect(user, listing))
        return NextResponse.json({ error: "Not allowed." }, { status: 403 });
      target = "published";
      reviewerId = user.id;
      break;
    case "approve":
      if (!canApprove(user, listing))
        return NextResponse.json({ error: "Not allowed." }, { status: 403 });
      target = "published";
      reviewerId = user.id;
      break;
    case "send_back_to_draft":
      if (!canSendBackToDraft(user, listing))
        return NextResponse.json({ error: "Not allowed." }, { status: 403 });
      target = "draft";
      break;
    case "archive":
      if (!canArchive(user, listing))
        return NextResponse.json({ error: "Not allowed." }, { status: 403 });
      target = "archived";
      break;
    case "restore":
      if (!canRestoreFromArchive(user, listing))
        return NextResponse.json({ error: "Not allowed." }, { status: 403 });
      target = "draft";
      break;
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const updated = await transitionListingStatus(id, target, reviewerId);
  if (!updated) {
    return NextResponse.json({ error: "Transition failed." }, { status: 500 });
  }
  revalidateListingSurfaces(updated.slug);
  return NextResponse.json({ ok: true, listing: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  if (!canDelete(user)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  // Grab the pre-delete state so we can invalidate the correct slug on its
  // way out. A published listing being deleted needs /, /listings, and its
  // slug page purged; draft / archived rows don't touch public caches.
  const existing = await getListingByIdAdmin(id);
  await deleteListing(id);
  if (existing?.status === "published") {
    revalidateListingSurfaces(existing.slug, existing.listing_type);
  }
  return NextResponse.json({ ok: true });
}
