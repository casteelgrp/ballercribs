import { sql } from "@vercel/postgres";

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run migrate:008` so .env.local is loaded."
    );
  }

  console.log("Running 008 payments migration...");

  // ─── payments ──────────────────────────────────────────────────────────────
  //
  // Single table for all payment activity, agent and buyer-side. inquiry_type
  // plus inquiry_id lets us link to either table without a polymorphic FK.
  // amount_cents (int) not amount (money) to avoid float drift.
  //
  // provider_* columns live here rather than a separate provider table since
  // we're exclusively Square today and the PaymentProvider interface in
  // src/lib/payments/types.ts is the seam if we ever swap. reference_code is
  // our own short string — used for alternate-payment reconciliation (Zelle /
  // wire) and as Square's order reference_id so webhook lookups can find the
  // row without retrieving the full order.
  await sql`
    CREATE TABLE IF NOT EXISTS payments (
      id                    SERIAL       PRIMARY KEY,
      inquiry_type          TEXT         NOT NULL
                              CHECK (inquiry_type IN ('buyer_lead', 'agent_feature')),
      inquiry_id            INTEGER      NOT NULL,
      amount_cents          INTEGER      NOT NULL,
      currency              TEXT         NOT NULL DEFAULT 'USD',
      status                TEXT         NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','paid','failed','refunded','cancelled')),
      payment_method        TEXT,
      provider              TEXT         NOT NULL DEFAULT 'square',
      provider_payment_id   TEXT,
      provider_link_id      TEXT,
      provider_order_id     TEXT,
      checkout_url          TEXT,
      reference_code        TEXT         NOT NULL UNIQUE,
      tier                  TEXT,
      line_item_description TEXT,
      created_by_user_id    INTEGER      REFERENCES users(id) ON DELETE SET NULL,
      created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      paid_at               TIMESTAMPTZ,
      updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      metadata              JSONB        NOT NULL DEFAULT '{}'::jsonb
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_payments_provider_payment_id ON payments(provider_payment_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_payments_provider_order_id  ON payments(provider_order_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_payments_inquiry            ON payments(inquiry_id, inquiry_type);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_payments_status             ON payments(status);`;

  // ─── webhook_logs ─────────────────────────────────────────────────────────
  //
  // Append-only log of everything we receive at /api/webhooks/*. processed_ok
  // tracks whether we successfully acted on the event; error captures the
  // reason when not. Keeping the full JSON payload lets us debug issues
  // (signature mismatch, unknown event type, DB update failure) after the
  // fact without re-triggering a payment.
  await sql`
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id            SERIAL       PRIMARY KEY,
      provider      TEXT         NOT NULL,
      event_type    TEXT,
      payload       JSONB        NOT NULL,
      received_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      processed_ok  BOOLEAN,
      error         TEXT
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_webhook_logs_received_at ON webhook_logs(received_at DESC);`;

  // ─── agent_inquiries.tier ─────────────────────────────────────────────────
  //
  // Already added in migrate-007. IF NOT EXISTS keeps this a no-op on a DB
  // that ran 007, but still provisions the column on fresh setups where 008
  // runs against a pre-007 state.
  await sql`ALTER TABLE agent_inquiries ADD COLUMN IF NOT EXISTS tier TEXT;`;

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
