import { sql } from "@vercel/postgres";
import crypto from "crypto";
import type {
  InquiryPaymentType,
  Payment,
  PaymentMethod,
  PaymentStatus
} from "./types";

function rowToPayment(row: any): Payment {
  return {
    id: Number(row.id),
    inquiry_type: row.inquiry_type as InquiryPaymentType,
    inquiry_id: Number(row.inquiry_id),
    amount_cents: Number(row.amount_cents),
    currency: row.currency,
    status: row.status as PaymentStatus,
    payment_method: (row.payment_method as PaymentMethod | null) ?? null,
    provider: row.provider,
    provider_payment_id: row.provider_payment_id ?? null,
    provider_link_id: row.provider_link_id ?? null,
    provider_order_id: row.provider_order_id ?? null,
    checkout_url: row.checkout_url ?? null,
    reference_code: row.reference_code,
    tier: row.tier ?? null,
    line_item_description: row.line_item_description ?? null,
    created_by_user_id:
      row.created_by_user_id !== null && row.created_by_user_id !== undefined
        ? Number(row.created_by_user_id)
        : null,
    created_at: row.created_at,
    paid_at: row.paid_at ?? null,
    updated_at: row.updated_at,
    metadata: (row.metadata ?? {}) as Record<string, unknown>
  };
}

// Our own short reference code. Used as:
//  - memo for alternate-payment (Zelle/wire) so inbound funds can be matched
//  - Square payment note and idempotency seed
//  - human reference in emails
const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I/L/O/0/1 to avoid confusion
function randomSuffix(length = 6): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += REF_ALPHABET[bytes[i] % REF_ALPHABET.length];
  }
  return out;
}
function generateReferenceCode(): string {
  const year = new Date().getFullYear();
  return `BC-${year}-${randomSuffix(6)}`;
}

export interface CreatePaymentInput {
  inquiry_type: InquiryPaymentType;
  inquiry_id: number;
  amount_cents: number;
  currency?: string;
  tier: string | null;
  line_item_description: string | null;
  provider_link_id?: string | null;
  provider_order_id?: string | null;
  checkout_url?: string | null;
  payment_method?: PaymentMethod | null;
  created_by_user_id: number | null;
  metadata?: Record<string, unknown>;
}

/**
 * Inserts a payment row, retrying with a fresh reference code on the rare
 * collision (unique index) — REF_ALPHABET is 30 chars × 6 positions = 7.3e8
 * codes, so retries are a long-tail concern but worth handling cleanly.
 */
export async function createPayment(data: CreatePaymentInput): Promise<Payment> {
  const currency = data.currency ?? "USD";
  const metadata = data.metadata ?? {};

  for (let attempt = 0; attempt < 5; attempt++) {
    const reference = generateReferenceCode();
    try {
      const { rows } = await sql`
        INSERT INTO payments (
          inquiry_type, inquiry_id, amount_cents, currency,
          tier, line_item_description,
          provider_link_id, provider_order_id, checkout_url, payment_method,
          reference_code, created_by_user_id, metadata
        )
        VALUES (
          ${data.inquiry_type}, ${data.inquiry_id}, ${data.amount_cents}, ${currency},
          ${data.tier}, ${data.line_item_description},
          ${data.provider_link_id ?? null}, ${data.provider_order_id ?? null},
          ${data.checkout_url ?? null}, ${data.payment_method ?? null},
          ${reference}, ${data.created_by_user_id}, ${JSON.stringify(metadata)}::jsonb
        )
        RETURNING *;
      `;
      return rowToPayment(rows[0]);
    } catch (err) {
      const e = err as { code?: string; constraint?: string } | null;
      if (e?.code === "23505" && (!e.constraint || e.constraint.includes("reference_code"))) {
        continue;
      }
      throw err;
    }
  }
  throw new Error("Could not generate a unique payment reference code after 5 attempts.");
}

export async function getPaymentById(id: number): Promise<Payment | null> {
  const { rows } = await sql`SELECT * FROM payments WHERE id = ${id} LIMIT 1;`;
  return rows[0] ? rowToPayment(rows[0]) : null;
}

export async function getPaymentByReferenceCode(code: string): Promise<Payment | null> {
  const { rows } = await sql`SELECT * FROM payments WHERE reference_code = ${code} LIMIT 1;`;
  return rows[0] ? rowToPayment(rows[0]) : null;
}

export async function getPaymentByProviderOrderId(orderId: string): Promise<Payment | null> {
  const { rows } = await sql`
    SELECT * FROM payments WHERE provider_order_id = ${orderId} LIMIT 1;
  `;
  return rows[0] ? rowToPayment(rows[0]) : null;
}

export async function getPaymentByProviderPaymentId(
  paymentId: string
): Promise<Payment | null> {
  const { rows } = await sql`
    SELECT * FROM payments WHERE provider_payment_id = ${paymentId} LIMIT 1;
  `;
  return rows[0] ? rowToPayment(rows[0]) : null;
}

export async function getPaymentsForInquiry(
  inquiryId: number,
  inquiryType: InquiryPaymentType
): Promise<Payment[]> {
  const { rows } = await sql`
    SELECT * FROM payments
    WHERE inquiry_id = ${inquiryId} AND inquiry_type = ${inquiryType}
    ORDER BY created_at DESC;
  `;
  return rows.map(rowToPayment);
}

/**
 * Updates any of: status, payment_method, provider_payment_id, paid_at,
 * metadata. Only non-undefined fields are touched. updated_at is always
 * bumped. Returns the fresh row.
 */
export interface UpdatePaymentInput {
  status?: PaymentStatus;
  payment_method?: PaymentMethod | null;
  provider_payment_id?: string | null;
  paid_at?: Date | null;
  /** Shallow-merged into metadata (existing keys preserved unless overwritten). */
  metadata_merge?: Record<string, unknown>;
}

export async function updatePayment(
  id: number,
  patch: UpdatePaymentInput
): Promise<Payment | null> {
  // Use a single UPDATE with COALESCE-style fallbacks. Tagged templates don't
  // support dynamic field lists cleanly, so we branch per-field via coalesce
  // semantics: ${undefined} would bind as null, which would clobber. Instead
  // we compute each new value in JS and pass sentinels.
  const current = await getPaymentById(id);
  if (!current) return null;

  const nextStatus = patch.status ?? current.status;
  const nextMethod =
    patch.payment_method === undefined ? current.payment_method : patch.payment_method;
  const nextPaymentId =
    patch.provider_payment_id === undefined
      ? current.provider_payment_id
      : patch.provider_payment_id;
  const nextPaidAt =
    patch.paid_at === undefined
      ? current.paid_at
      : patch.paid_at === null
        ? null
        : patch.paid_at.toISOString();
  const nextMetadata = patch.metadata_merge
    ? { ...current.metadata, ...patch.metadata_merge }
    : current.metadata;

  const { rows } = await sql`
    UPDATE payments
    SET status = ${nextStatus},
        payment_method = ${nextMethod},
        provider_payment_id = ${nextPaymentId},
        paid_at = ${nextPaidAt},
        metadata = ${JSON.stringify(nextMetadata)}::jsonb,
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows[0] ? rowToPayment(rows[0]) : null;
}

// ─── Listing helpers for /admin/payments ───────────────────────────────────

export interface ListPaymentsOptions {
  status?: PaymentStatus;
  inquiry_type?: InquiryPaymentType;
  limit?: number;
  offset?: number;
}

export type PaymentWithInquiryName = Payment & { inquiry_name: string | null };

export async function listPayments(
  opts: ListPaymentsOptions = {}
): Promise<PaymentWithInquiryName[]> {
  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  // Join all three inquiry tables via COALESCE so the list can show the
  // submitter's name regardless of inquiry_type in a single query.
  const { rows } = await sql`
    SELECT p.*,
           COALESCE(bi.name, ai.name, ri.name) AS inquiry_name
    FROM payments p
    LEFT JOIN inquiries bi ON p.inquiry_type = 'buyer_lead' AND bi.id = p.inquiry_id
    LEFT JOIN agent_inquiries ai ON p.inquiry_type = 'agent_feature' AND ai.id = p.inquiry_id
    LEFT JOIN rental_inquiries ri ON p.inquiry_type = 'rental' AND ri.id = p.inquiry_id
    WHERE (${opts.status ?? null}::text IS NULL OR p.status = ${opts.status ?? null})
      AND (${opts.inquiry_type ?? null}::text IS NULL OR p.inquiry_type = ${opts.inquiry_type ?? null})
    ORDER BY p.created_at DESC
    LIMIT ${limit} OFFSET ${offset};
  `;
  return rows.map((r) => ({
    ...rowToPayment(r),
    inquiry_name: (r.inquiry_name as string | null) ?? null
  }));
}

export async function countPaymentsByStatus(): Promise<Record<PaymentStatus | "all", number>> {
  const { rows } = await sql`
    SELECT status, COUNT(*)::int AS n FROM payments GROUP BY status;
  `;
  const out: Record<PaymentStatus | "all", number> = {
    all: 0,
    pending: 0,
    paid: 0,
    failed: 0,
    refunded: 0,
    cancelled: 0
  };
  for (const row of rows) {
    const s = row.status as PaymentStatus;
    out[s] = Number(row.n);
    out.all += Number(row.n);
  }
  return out;
}

// ─── Webhook event log ─────────────────────────────────────────────────────

export async function logWebhookEvent(data: {
  provider: string;
  event_type: string | null;
  payload: unknown;
  processed_ok: boolean | null;
  error: string | null;
}): Promise<number> {
  const { rows } = await sql`
    INSERT INTO webhook_logs (provider, event_type, payload, processed_ok, error)
    VALUES (
      ${data.provider},
      ${data.event_type},
      ${JSON.stringify(data.payload ?? {})}::jsonb,
      ${data.processed_ok},
      ${data.error}
    )
    RETURNING id;
  `;
  return Number(rows[0].id);
}

export async function markWebhookLogResult(
  id: number,
  processed_ok: boolean,
  error: string | null
): Promise<void> {
  await sql`
    UPDATE webhook_logs
    SET processed_ok = ${processed_ok}, error = ${error}
    WHERE id = ${id};
  `;
}

// ─── Inquiry tier update (called when a payment link is generated) ─────────

export async function setAgentInquiryTier(
  inquiryId: number,
  tier: string
): Promise<void> {
  await sql`UPDATE agent_inquiries SET tier = ${tier} WHERE id = ${inquiryId};`;
}
