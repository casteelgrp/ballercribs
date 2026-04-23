import { sql } from "@vercel/postgres";

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:015` so .env.local is loaded."
    );
  }

  console.log("Running 015 short-term-only migration...");

  // ─── Convert existing long-term listings ────────────────────────────────
  //
  // Every long_term rental flips to short_term with a 'night' unit and drops
  // to draft so it doesn't surface publicly at the wrong price. The stored
  // rental_price_cents is left intact — owner reprices and republishes.
  const flip = await sql`
    UPDATE listings
    SET rental_term       = 'short_term',
        rental_price_unit = 'night',
        status            = 'draft',
        published_at      = NULL
    WHERE listing_type = 'rental' AND rental_term = 'long_term';
  `;
  console.log(`Flipped ${flip.rowCount ?? 0} long_term rental(s) to short_term/draft.`);

  // ─── Tighten rental_price_unit CHECK to disallow 'month' ────────────────
  //
  // Leaves rental_term's CHECK alone so historical 'long_term' rows stay
  // valid — the product-layer validation is what keeps new rentals on
  // 'short_term' going forward. Reversing this migration = relax this
  // CHECK back to include 'month'.
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'listings_rental_price_unit_check'
      ) THEN
        ALTER TABLE listings DROP CONSTRAINT listings_rental_price_unit_check;
      END IF;
    END $$;
  `;
  await sql`
    ALTER TABLE listings ADD CONSTRAINT listings_rental_price_unit_check
      CHECK (rental_price_unit IS NULL OR rental_price_unit IN ('night', 'week'));
  `;

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
