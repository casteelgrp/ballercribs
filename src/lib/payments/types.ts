// Provider-neutral payment types. The rest of the app talks only to these;
// Square-specific shapes stay inside src/lib/payments/square.ts. Swapping
// providers is a matter of writing a new file that implements PaymentProvider
// and pointing src/lib/payments/index.ts at it.

export type InquiryPaymentType = "buyer_lead" | "agent_feature";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "cancelled";

export type PaymentMethod = "card" | "ach" | "zelle" | "wire" | "check" | "cash";

export type PaymentProviderName = "square";

export interface Payment {
  id: number;
  inquiry_type: InquiryPaymentType;
  inquiry_id: number;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  payment_method: PaymentMethod | null;
  provider: PaymentProviderName;
  provider_payment_id: string | null;
  provider_link_id: string | null;
  provider_order_id: string | null;
  checkout_url: string | null;
  reference_code: string;
  tier: string | null;
  line_item_description: string | null;
  created_by_user_id: number | null;
  created_at: string;
  paid_at: string | null;
  updated_at: string;
  metadata: Record<string, unknown>;
}

// ─── Provider interface ─────────────────────────────────────────────────────
//
// Generic contract the rest of the app codes against. Square's SDK types
// must never leak past the provider boundary.

export interface CheckoutParams {
  /** Money in the smallest currency unit (cents for USD). */
  amount_cents: number;
  /** ISO 4217, uppercase. Square only supports USD for US merchants today. */
  currency: string;
  /** Short human-facing line item (rendered on Square's hosted checkout). */
  name: string;
  /** Our own short code (BC-YYYY-XXXXXX) — stored as Square's reference_id for webhook correlation. */
  reference_code: string;
  /** Optional buyer email for pre-populating Square's checkout form. */
  buyer_email?: string;
  /** Free-text note attached to the resulting Square payment. Useful for reconciliation. */
  payment_note?: string;
}

export interface CheckoutLinkResult {
  /** Provider-assigned payment link ID. */
  provider_link_id: string;
  /** Provider-assigned order ID — used for webhook lookup. */
  provider_order_id: string;
  /** Hosted checkout URL the agent opens to pay. */
  checkout_url: string;
}

export type PaymentEventKind =
  | "payment.created"
  | "payment.updated"
  | "payment.completed"
  | "payment.failed"
  | "refund.created"
  | "refund.updated"
  | "unknown";

/**
 * Normalized webhook event shape. Square's raw JSON is logged to webhook_logs
 * separately — this is what the route handler reasons against.
 *
 * `provider_order_id` is our primary lookup key (indexed on payments table);
 * `provider_payment_id` is recorded once the payment exists.
 */
export interface PaymentEvent {
  kind: PaymentEventKind;
  event_type: string; // raw "payment.updated" etc from provider
  provider_payment_id: string | null;
  provider_order_id: string | null;
  /** Normalized high-level status derived from the provider's state machine. */
  normalized_status: PaymentStatus | null;
  /** 'card' / 'ach' etc. when the payment completed. */
  payment_method: PaymentMethod | null;
  amount_cents: number | null;
  currency: string | null;
}

export interface VerifyWebhookInput {
  /** Raw request body as a string — must not be re-serialized; signature is over exact bytes. */
  raw_body: string;
  /** All incoming request headers, lowercased keys. */
  headers: Record<string, string>;
  /** Full URL the webhook was posted to, used by Square's HMAC check. */
  notification_url: string;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;

  createCheckoutLink(params: CheckoutParams): Promise<CheckoutLinkResult>;

  /**
   * Returns true if the request was cryptographically signed by the provider.
   *
   * Sandbox fallback: implementations MAY accept unsigned requests in
   * non-production environments (logged as a warning) so a developer can test
   * with Square's webhook simulator before adding the signature key. In
   * production, always reject unsigned requests.
   */
  verifyWebhookSignature(input: VerifyWebhookInput): Promise<boolean>;

  /** Parse a raw webhook body into our normalized event. */
  parseWebhookEvent(raw_body: string): PaymentEvent;
}
