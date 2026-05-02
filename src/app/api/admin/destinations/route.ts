import { NextResponse } from "next/server";
import {
  createDestination,
  getDestinationBySlug
} from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

const SLUG_RX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function POST(req: Request) {
  try {
    await requireUser();
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
  const displayName = String(body?.display_name ?? "").trim();
  const region = body?.region ? String(body.region).trim() : null;
  const blurb = body?.blurb ? String(body.blurb).trim() : null;
  const heroImageUrl = body?.hero_image_url ? String(body.hero_image_url).trim() : null;
  const heroImageAlt = body?.hero_image_alt ? String(body.hero_image_alt).trim() : null;
  const seoTitle = body?.seo_title ? String(body.seo_title).trim() : null;
  const seoDescription = body?.seo_description
    ? String(body.seo_description).trim()
    : null;
  const published = body?.published === undefined ? false : Boolean(body.published);

  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!slug) return NextResponse.json({ error: "Slug is required." }, { status: 400 });
  if (!SLUG_RX.test(slug)) {
    return NextResponse.json(
      { error: "Slug must be lowercase kebab-case." },
      { status: 400 }
    );
  }
  if (!displayName) {
    return NextResponse.json(
      { error: "Display name is required." },
      { status: 400 }
    );
  }

  // Pre-check slug uniqueness for a clean 409 — the DB UNIQUE
  // constraint would also catch it, but the route would surface as a
  // generic 500 without this branch.
  const existing = await getDestinationBySlug(slug);
  if (existing) {
    return NextResponse.json(
      { error: "That slug is already taken." },
      { status: 409 }
    );
  }

  try {
    const destination = await createDestination({
      name,
      slug,
      display_name: displayName,
      region,
      blurb,
      hero_image_url: heroImageUrl,
      hero_image_alt: heroImageAlt,
      seo_title: seoTitle,
      seo_description: seoDescription,
      published
    });
    return NextResponse.json({ destination });
  } catch (err: any) {
    if (err?.code === "23505") {
      return NextResponse.json(
        { error: "That slug is already taken." },
        { status: 409 }
      );
    }
    console.error("Failed to create destination:", err);
    return NextResponse.json(
      { error: "Failed to create destination." },
      { status: 500 }
    );
  }
}
