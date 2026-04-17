import { NextResponse } from "next/server";
import { createListing } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { slugify } from "@/lib/format";

export const runtime = "nodejs";

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

  if (!title || !location || !description || !hero_image_url) {
    return NextResponse.json(
      { error: "Title, location, description, and hero image are required." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(price_usd) || price_usd < 0) {
    return NextResponse.json({ error: "Valid price is required." }, { status: 400 });
  }

  const slug = body?.slug ? slugify(String(body.slug)) : slugify(title);
  if (!slug) {
    return NextResponse.json({ error: "Could not generate slug." }, { status: 400 });
  }

  const gallery = Array.isArray(body?.gallery_image_urls)
    ? body.gallery_image_urls.map((u: unknown) => String(u).trim()).filter(Boolean)
    : [];

  try {
    const listing = await createListing({
      slug,
      title,
      location,
      price_usd: Math.round(price_usd),
      bedrooms:
        body?.bedrooms !== null && body?.bedrooms !== undefined ? Number(body.bedrooms) : null,
      bathrooms:
        body?.bathrooms !== null && body?.bathrooms !== undefined ? Number(body.bathrooms) : null,
      square_feet:
        body?.square_feet !== null && body?.square_feet !== undefined
          ? Number(body.square_feet)
          : null,
      description,
      hero_image_url,
      gallery_image_urls: gallery,
      agent_name: body?.agent_name ? String(body.agent_name).trim() : null,
      agent_brokerage: body?.agent_brokerage ? String(body.agent_brokerage).trim() : null,
      featured: Boolean(body?.featured),
      created_by_user_id: user.id
    });
    return NextResponse.json({ ok: true, id: listing.id, slug: listing.slug });
  } catch (err: any) {
    console.error("Failed to create listing:", err);
    if (err?.code === "23505") {
      return NextResponse.json(
        { error: "A listing with this slug already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to create listing." }, { status: 500 });
  }
}
