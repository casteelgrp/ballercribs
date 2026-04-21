// The only file that imports the `square` SDK. Everything else in the app
// routes through the PaymentProvider interface so we can swap providers by
// writing a parallel file and retargeting src/lib/payments/index.ts.

import crypto from "crypto";
import { Square, SquareClient, SquareEnvironment, WebhooksHelper } from "square";
import type {
  CheckoutLinkResult,
  CheckoutParams,
  PaymentEvent,
  PaymentEventKind,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  VerifyWebhookInput
} from "./types";

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

function isProductionEnvironment(): boolean {
  return env("SQUARE_ENVIRONMENT") === "production";
}

function getClient(): SquareClient {
  const token = env("SQUARE_ACCESS_TOKEN");
  if (!token) {
    throw new Error("SQUARE_ACCESS_TOKEN is not set.");
  }
  return new SquareClient({
    token,
    environment: isProductionEnvironment()
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox
  });
}

function requireLocationId(): string {
  const id = env("SQUARE_LOCATION_ID");
  if (!id) throw new Error("SQUARE_LOCATION_ID is not set.");
  return id;
}

/**
 * Map Square's payment-status string to our normalized status. Square's own
 * values: APPROVED / COMPLETED / CANCELED / FAILED / PENDING.
 */
function mapPaymentStatus(raw: string | undefined | null): PaymentStatus | null {
  if (!raw) return null;
  const s = raw.toUpperCase();
  if (s === "COMPLETED") return "paid";
  if (s === "APPROVED") return "paid"; // treat captured-same-as-completed
  if (s === "PENDING") return "pending";
  if (s === "CANCELED") return "cancelled";
  if (s === "FAILED") return "failed";
  return null;
}

/**
 * Square reports source_type (e.g. "CARD", "BANK_ACCOUNT"). Collapse onto
 * the short labels our UI uses.
 */
function mapSourceToMethod(raw: string | undefined | null): PaymentMethod | null {
  if (!raw) return null;
  const s = raw.toUpperCase();
  if (s === "CARD") return "card";
  if (s === "BANK_ACCOUNT" || s === "ACH") return "ach";
  return null;
}

function classifyEventType(eventType: string): PaymentEventKind {
  if (eventType === "payment.created") return "payment.created";
  if (eventType === "payment.updated") return "payment.updated";
  if (eventType === "refund.created") return "refund.created";
  if (eventType === "refund.updated") return "refund.updated";
  return "unknown";
}

export const squareProvider: PaymentProvider = {
  name: "square",

  async createCheckoutLink(params: CheckoutParams): Promise<CheckoutLinkResult> {
    const client = getClient();
    const locationId = requireLocationId();

    // idempotencyKey prevents duplicate links if this handler is re-invoked
    // (e.g. a network retry from our end). Reference_code is unique per
    // payment row so we key off it.
    const res = await client.checkout.paymentLinks.create({
      idempotencyKey: `${params.reference_code}-${crypto.randomBytes(4).toString("hex")}`,
      quickPay: {
        name: params.name,
        priceMoney: {
          amount: BigInt(params.amount_cents),
          currency: params.currency as typeof Square.Currency.Usd
        },
        locationId
      },
      paymentNote: params.payment_note ?? params.reference_code,
      prePopulatedData: params.buyer_email ? { buyerEmail: params.buyer_email } : undefined
    });

    const link = res.paymentLink;
    if (!link || !link.id || !link.orderId || !(link.url ?? link.longUrl)) {
      throw new Error("Square did not return a complete payment link.");
    }

    return {
      provider_link_id: link.id,
      provider_order_id: link.orderId,
      checkout_url: (link.url ?? link.longUrl) as string
    };
  },

  async verifyWebhookSignature(input: VerifyWebhookInput): Promise<boolean> {
    const key = env("SQUARE_WEBHOOK_SIGNATURE_KEY");
    const signature = input.headers["x-square-hmacsha256-signature"];

    if (!key) {
      // Sandbox/dev fallback: allow through without verification so the
      // webhook simulator in Square's dashboard can exercise the flow
      // before the signature key is provisioned. In production this is a
      // hard reject — see the route handler.
      if (isProductionEnvironment()) return false;
      console.warn(
        "[square] SQUARE_WEBHOOK_SIGNATURE_KEY not set — accepting webhook without verification (non-production only)."
      );
      return true;
    }

    if (!signature) return false;

    try {
      return await WebhooksHelper.verifySignature({
        requestBody: input.raw_body,
        signatureHeader: signature,
        signatureKey: key,
        notificationUrl: input.notification_url
      });
    } catch (err) {
      console.error("[square] verifySignature threw:", err);
      return false;
    }
  },

  parseWebhookEvent(raw_body: string): PaymentEvent {
    // Square webhooks look like:
    //   { type: "payment.updated", data: { object: { payment: {...} } }, ... }
    // or for refunds:
    //   { type: "refund.updated", data: { object: { refund: {...} } }, ... }
    let parsed: any;
    try {
      parsed = JSON.parse(raw_body);
    } catch {
      return {
        kind: "unknown",
        event_type: "invalid_json",
        provider_payment_id: null,
        provider_order_id: null,
        normalized_status: null,
        payment_method: null,
        amount_cents: null,
        currency: null
      };
    }

    const eventType: string = parsed.type ?? "unknown";
    const obj = parsed?.data?.object ?? {};
    const payment = obj.payment ?? obj.refund?.payment ?? obj.refund ?? null;

    const paymentId = payment?.id ?? obj.payment?.id ?? null;
    const orderId = payment?.order_id ?? obj.payment?.order_id ?? obj.refund?.order_id ?? null;
    const rawStatus = payment?.status ?? obj.refund?.status ?? null;
    const sourceType = payment?.source_type ?? null;
    const amountMinor = payment?.amount_money?.amount ?? null;
    const currency = payment?.amount_money?.currency ?? null;

    // Refund events get their own normalized status so the handler can flip
    // our row to 'refunded' regardless of the payment's current state.
    let normalizedStatus: PaymentStatus | null = mapPaymentStatus(rawStatus);
    if (eventType.startsWith("refund.")) {
      // Square's refund states: PENDING / COMPLETED / FAILED / REJECTED.
      if (typeof rawStatus === "string" && rawStatus.toUpperCase() === "COMPLETED") {
        normalizedStatus = "refunded";
      }
    }

    return {
      kind: classifyEventType(eventType),
      event_type: eventType,
      provider_payment_id: paymentId,
      provider_order_id: orderId,
      normalized_status: normalizedStatus,
      payment_method: mapSourceToMethod(sourceType),
      amount_cents: typeof amountMinor === "number" ? amountMinor : null,
      currency: typeof currency === "string" ? currency : null
    };
  }
};
