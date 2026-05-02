import { NextResponse } from "next/server";
import {
  deleteDestination,
  getDestinationById,
  getDestinationBySlug,
  updateDestination
} from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

const SLUG_RX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseId(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
  } catch (res) {
    return res as Response;
  }

  const { id: raw } = await params;
  const id = parseId(raw);
  if (id === null) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const existing = await getDestinationById(id).catch(() => null);
  if (!existing) {
    return NextResponse.json(
      { error: "Destination not found." },
      { status: 404 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Coerce fields, falling back to existing values when keys are
  // absent. The form always sends every field, but the route stays
  // lenient so future scripted callers can patch one attribute.
  const name =
    body?.name !== undefined ? String(body.name).trim() : existing.name;
  const slug =
    body?.slug !== undefined
      ? String(body.slug).trim().toLowerCase()
      : existing.slug;
  const displayName =
    body?.display_name !== undefined
      ? String(body.display_name).trim()
      : existing.display_name;
  const region =
    body?.region === undefined
      ? existing.region
      : body.region
        ? String(body.region).trim()
        : null;
  const blurb =
    body?.blurb === undefined
      ? existing.blurb
      : body.blurb
        ? String(body.blurb).trim()
        : null;
  const heroImageUrl =
    body?.hero_image_url === undefined
      ? existing.hero_image_url
      : body.hero_image_url
        ? String(body.hero_image_url).trim()
        : null;
  const heroImageAlt =
    body?.hero_image_alt === undefined
      ? existing.hero_image_alt
      : body.hero_image_alt
        ? String(body.hero_image_alt).trim()
        : null;
  const seoTitle =
    body?.seo_title === undefined
      ? existing.seo_title
      : body.seo_title
        ? String(body.seo_title).trim()
        : null;
  const seoDescription =
    body?.seo_description === undefined
      ? existing.seo_description
      : body.seo_description
        ? String(body.seo_description).trim()
        : null;
  const published =
    body?.published === undefined ? existing.published : Boolean(body.published);

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

  // Slug uniqueness check excludes self — saving without changing the
  // slug shouldn't fail against itself. DB UNIQUE catches the race.
  if (slug !== existing.slug) {
    const conflict = await getDestinationBySlug(slug);
    if (conflict && conflict.id !== existing.id) {
      return NextResponse.json(
        { error: "That slug is already taken." },
        { status: 409 }
      );
    }
  }

  try {
    const updated = await updateDestination(id, {
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
    if (!updated) {
      return NextResponse.json({ error: "Update failed." }, { status: 500 });
    }
    return NextResponse.json({ destination: updated });
  } catch (err: any) {
    if (err?.code === "23505") {
      return NextResponse.json(
        { error: "That slug is already taken." },
        { status: 409 }
      );
    }
    console.error("Failed to update destination:", err);
    return NextResponse.json(
      { error: "Failed to update destination." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
  } catch (res) {
    return res as Response;
  }

  const { id: raw } = await params;
  const id = parseId(raw);
  if (id === null) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const existing = await getDestinationById(id).catch(() => null);
  if (!existing) {
    return NextResponse.json(
      { error: "Destination not found." },
      { status: 404 }
    );
  }

  try {
    const ok = await deleteDestination(id);
    if (!ok) {
      return NextResponse.json({ error: "Delete failed." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Failed to delete destination:", err);
    return NextResponse.json(
      { error: "Failed to delete destination." },
      { status: 500 }
    );
  }
}
