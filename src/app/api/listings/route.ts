import { NextResponse } from "next/server";
import { createListingWithUniqueSlug } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { generateSlug, validateSlug } from "@/lib/format";
import type { GalleryItem, ListingStatus } from "@/lib/types";
import { isOwner } from "@/lib/permissions";

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

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = String(body?.title || "").trim();
  const location = String(body?.location || "").trim();
  const description = String(body?.description || "").trim();
  const hero_image_url = String(body?.hero_image_url || "").trim();
  const price_usd = Number(body?.price_usd);
  const social_cover_url =
    typeof body?.social_cover_url === "string" && body.social_cover_url.trim()
      ? String(body.social_cover_url).trim()
      : null;

  if (!title || !location || !description || !hero_image_url) {
    return NextResponse.json(
      { error: "Title, location, description, and hero image are required." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(price_usd) || price_usd < 0) {
    return NextResponse.json({ error: "Valid price is required." }, { status: 400 });
  }

  // Slug: use the client-provided value if any (already shaped by the form),
  // otherwise derive from title + location with the same algorithm the form uses.
  const requestedSlug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const slug = requestedSlug || generateSlug(title, location);
  const slugError = validateSlug(slug);
  if (slugError) {
    return NextResponse.json({ error: `Slug: ${slugError.message}` }, { status: 400 });
  }

  const gallery = normalizeGalleryInput(body?.gallery_image_urls);

  // Status: clamp to what the user is allowed to set on creation.
  // Owners can pick any status; non-owners can only create as draft or submit for review.
  const requested = String(body?.status || "draft") as ListingStatus;
  const allowedForOwner: ListingStatus[] = ["draft", "review", "published"];
  const allowedForUser: ListingStatus[] = ["draft", "review"];
  const allowed = isOwner(user) ? allowedForOwner : allowedForUser;
  const status: ListingStatus = allowed.includes(requested) ? requested : "draft";

  try {
    const listing = await createListingWithUniqueSlug({
      slug,
      title,
      location,
      price_usd: Math.round(price_usd),
      bedrooms:
        body?.bedrooms !== null && body?.bedrooms !== undefined && body.bedrooms !== ""
          ? Number(body.bedrooms)
          : null,
      bathrooms:
        body?.bathrooms !== null && body?.bathrooms !== undefined && body.bathrooms !== ""
          ? Number(body.bathrooms)
          : null,
      square_feet:
        body?.square_feet !== null && body?.square_feet !== undefined && body.square_feet !== ""
          ? Number(body.square_feet)
          : null,
      description,
      hero_image_url,
      gallery_image_urls: gallery,
      social_cover_url,
      agent_name: body?.agent_name ? String(body.agent_name).trim() : null,
      agent_brokerage: body?.agent_brokerage ? String(body.agent_brokerage).trim() : null,
      featured: Boolean(body?.featured),
      status,
      created_by_user_id: user.id,
      seo_title:
        typeof body?.seo_title === "string" && body.seo_title.trim()
          ? body.seo_title.trim()
          : null,
      seo_description:
        typeof body?.seo_description === "string" && body.seo_description.trim()
          ? body.seo_description.trim()
          : null
    });
    return NextResponse.json({ ok: true, id: listing.id, slug: listing.slug, status: listing.status });
  } catch (err: any) {
    console.error("Failed to create listing:", err);
    if (err?.code === "23505") {
      return NextResponse.json(
        {
          error:
            "A listing with this title already exists — try a more specific title (e.g. add the neighbourhood or street name)."
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to create listing." }, { status: 500 });
  }
}
