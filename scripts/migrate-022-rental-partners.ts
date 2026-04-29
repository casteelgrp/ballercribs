import { sql } from "@vercel/postgres";

/**
 * D9 Commit 1 — rental booking partners.
 *
 * Adds:
 *   - partners table (affiliate / direct, outbound_link / inquiry_form)
 *   - listings.partner_id + partner_property_url + partner_tracking_url
 *   - rental_inquiries.partner_id + forwarded_to_partner_at
 *
 * App-layer validation (NOT enforced at the DB):
 *   - listings.listing_type='rental'  ⇒ partner_id required
 *   - listings.listing_type='sale'    ⇒ partner_id MUST be NULL
 *   - partner.cta_mode='outbound_link' ⇒ partner_property_url +
 *     partner_tracking_url required on the rental row
 *   - partner.cta_mode='inquiry_form' ⇒ both URL columns MUST be NULL
 *
 * The DB stays permissive on these so existing sales rows don't fail
 * an ADD CONSTRAINT during backfill, and so the listings table can
 * carry both row shapes (sale + rental) without a partial-CHECK
 * acrobatics. Form + route handlers enforce in subsequent commits.
 *
 * Backfill: seeds one "Direct" partner row (cta_mode='inquiry_form')
 * and points the single existing rental (id=13, southlake-rental-170-jellico
 * — verified via prod query during audit) at it. Idempotent via
 * ON CONFLICT DO NOTHING + WHERE listing_type='rental'.
 *
 * Run with: npm run migrate:022
 */
async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:022` so .env.local is loaded."
    );
  }

  console.log("Running 022 rental-partners migration...");

  // ─── partners table ─────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS partners (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name                  TEXT NOT NULL,
      slug                  TEXT NOT NULL UNIQUE,
      type                  TEXT NOT NULL CHECK (type IN ('affiliate', 'direct')),
      cta_mode              TEXT NOT NULL CHECK (cta_mode IN ('outbound_link', 'inquiry_form')),
      cta_label             TEXT NOT NULL,
      logo_url              TEXT,
      disclosure_text       TEXT,
      forward_inquiries_to  TEXT,
      active                BOOLEAN NOT NULL DEFAULT TRUE,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  // Partial index — most reads (admin dropdown, public render) only
  // care about active partners. Filtering at the index level keeps the
  // common path off a full scan.
  await sql`
    CREATE INDEX IF NOT EXISTS partners_active_idx
      ON partners (active) WHERE active = TRUE;
  `;

  // ─── listings: partner linkage + URL fields ─────────────────────────────
  //
  // ON DELETE RESTRICT so attempting to delete a partner with rentals
  // attached fails loud rather than orphaning rentals to NULL — admin
  // soft-deletes via active=false instead. Partner deletion isn't
  // exposed in admin v1 anyway; this just makes the implicit invariant
  // explicit at the DB level.
  await sql`
    ALTER TABLE listings
      ADD COLUMN IF NOT EXISTS partner_id            UUID REFERENCES partners(id) ON DELETE RESTRICT,
      ADD COLUMN IF NOT EXISTS partner_property_url  TEXT,
      ADD COLUMN IF NOT EXISTS partner_tracking_url  TEXT;
  `;

  // ─── rental_inquiries: partner linkage + forwarding stamp ──────────────
  //
  // ON DELETE SET NULL: deleting a partner shouldn't blow up historical
  // inquiries — they stay readable, just lose their partner pointer.
  // forwarded_to_partner_at is admin-set via "Mark forwarded" in the
  // inbox (Commit 5).
  await sql`
    ALTER TABLE rental_inquiries
      ADD COLUMN IF NOT EXISTS partner_id               UUID REFERENCES partners(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS forwarded_to_partner_at  TIMESTAMPTZ;
  `;

  // ─── Seed: "Direct" placeholder partner ────────────────────────────────
  //
  // Inquiry-form mode so the existing rental's behavior (bounces to
  // /rentals#inquire then captures via the universal form) keeps
  // working unchanged once the listing is attached. Jay can edit the
  // forward_inquiries_to via /admin/partners (Commit 2). Using the
  // existing owner inbox as the seed value is safe — same address
  // already receives every rental inquiry today.
  await sql`
    INSERT INTO partners (name, slug, type, cta_mode, cta_label, forward_inquiries_to)
    VALUES (
      'Direct',
      'direct',
      'direct',
      'inquiry_form',
      'Inquire about this rental',
      'theballercribs@gmail.com'
    )
    ON CONFLICT (slug) DO NOTHING;
  `;

  // ─── Backfill: existing rental → Direct partner ────────────────────────
  //
  // Single existing rental at audit time was id=13 (southlake-rental-170-jellico).
  // Filtering by listing_type='rental' AND partner_id IS NULL keeps the
  // statement idempotent — re-runs after the column already populated
  // are no-ops. WHERE listing_type='rental' also guards against ever
  // accidentally stamping a sale row.
  await sql`
    UPDATE listings
    SET partner_id = (SELECT id FROM partners WHERE slug = 'direct')
    WHERE listing_type = 'rental' AND partner_id IS NULL;
  `;

  // ─── updated_at trigger? No — partners gets manual NOW() on UPDATE
  // from the app layer, matching how blog_posts.updated_at is handled.
  // Keeps trigger surface tight and predictable.

  console.log("✓ partners table created.");
  console.log("✓ listings + rental_inquiries extended.");
  console.log("✓ Direct partner seeded; existing rental backfilled.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
