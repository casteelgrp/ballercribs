import { NextResponse } from "next/server";
import {
  getAgentInquiryById,
  getRentalInquiryById,
  updateAgentInquiryStatus,
  updateRentalInquiryStatus
} from "@/lib/db";
import {
  getPaymentByProviderOrderId,
  getPaymentByProviderPaymentId,
  logWebhookEvent,
  markWebhookLogResult,
  paymentProvider,
  sendPaymentReceivedNotification,
  updatePayment,
  type Payment
} from "@/lib/payments";

export const runtime = "nodejs";

function isProduction(): boolean {
  return process.env.SQUARE_ENVIRONMENT === "production";
}

/**
 * POST /api/webhooks/square
 *
 * Square posts payment / refund events here. Order of operations:
 *   1. Read raw body (signature is over exact bytes — don't let the
 *      framework re-parse).
 *   2. Log the raw payload unconditionally so failed events are
 *      debuggable later.
 *   3. Verify signature via paymentProvider.verifyWebhookSignature.
 *      Sandbox allows unsigned (with warning); prod rejects.
 *   4. Parse into our normalized PaymentEvent.
 *   5. Dispatch by event kind: flip payment status, auto-mark the
 *      inquiry won, notify owner.
 *
 * Square retries non-2xx responses — we return 200 even when the event
 * references a payment we don't recognize (log, but don't ask Square to
 * keep hammering us). Signature failures return 401 so the event lands
 * in the retry queue if it's genuinely ours.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();

  // Collect headers for signature verification. Using a plain object with
  // lowercased keys — Next.js headers are already lowercased, but we
  // normalize defensively in case of stray case elsewhere.
  const headerMap: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    headerMap[k.toLowerCase()] = v;
  });

  // Log first so every inbound event is recorded, even ones we fail to
  // parse. processed_ok=null means "received, not yet classified".
  let parsedPayload: unknown = null;
  try {
    parsedPayload = JSON.parse(rawBody);
  } catch {
    // parse failure is normal when Square sends a challenge / health-check;
    // we still log the raw body as a string-in-JSON.
    parsedPayload = { _raw: rawBody };
  }
  const eventType = (parsedPayload as { type?: string } | null)?.type ?? null;

  const logId = await logWebhookEvent({
    provider: "square",
    event_type: eventType,
    payload: parsedPayload,
    processed_ok: null,
    error: null
  });

  // Build notification URL from the request. Square signs the full URL,
  // so using req.url keeps that consistent across local / Vercel deploys.
  const notificationUrl = new URL(req.url).toString();

  const signed = await paymentProvider.verifyWebhookSignature({
    raw_body: rawBody,
    headers: headerMap,
    notification_url: notificationUrl
  });

  if (!signed) {
    await markWebhookLogResult(
      logId,
      false,
      isProduction() ? "signature invalid or missing key" : "signature invalid"
    );
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event;
  try {
    event = paymentProvider.parseWebhookEvent(rawBody);
  } catch (err) {
    await markWebhookLogResult(logId, false, `parse error: ${String(err)}`);
    // 200 so Square doesn't retry a malformed payload forever.
    return NextResponse.json({ ok: false, error: "parse failed" });
  }

  // Find the payment row. Order ID is the primary key; payment_id is a
  // fallback for events whose body lacks the order reference.
  let payment: Payment | null = null;
  if (event.provider_order_id) {
    payment = await getPaymentByProviderOrderId(event.provider_order_id);
  }
  if (!payment && event.provider_payment_id) {
    payment = await getPaymentByProviderPaymentId(event.provider_payment_id);
  }

  if (!payment) {
    await markWebhookLogResult(
      logId,
      true,
      `no matching payment (order_id=${event.provider_order_id ?? "null"}, payment_id=${event.provider_payment_id ?? "null"})`
    );
    return NextResponse.json({ ok: true, note: "unknown payment" });
  }

  // Dispatch. Today we only act on completion, failure, and refund
  // transitions — 'payment.created' for pending state is already implied
  // by our row.
  try {
    if (event.normalized_status === "paid" && payment.status !== "paid") {
      const updated = await updatePayment(payment.id, {
        status: "paid",
        payment_method: event.payment_method ?? payment.payment_method,
        provider_payment_id: event.provider_payment_id ?? payment.provider_payment_id,
        paid_at: new Date(),
        metadata_merge: { webhook_event: event.event_type }
      });
      if (updated) {
        await flipInquiryToWonAndNotify(updated);
      }
    } else if (event.normalized_status === "failed" && payment.status !== "failed") {
      await updatePayment(payment.id, {
        status: "failed",
        metadata_merge: { webhook_event: event.event_type }
      });
    } else if (event.normalized_status === "refunded" && payment.status !== "refunded") {
      await updatePayment(payment.id, {
        status: "refunded",
        metadata_merge: { webhook_event: event.event_type }
      });
      // We deliberately do NOT flip the inquiry back off 'won' — a refund
      // is a business-level decision that might need manual review. The
      // payment status shows the truth in admin.
    } else {
      // No-op for 'payment.created' or duplicates — still counts as
      // processed_ok for log purposes.
    }
    await markWebhookLogResult(logId, true, null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[square-webhook] processing failed", err);
    await markWebhookLogResult(logId, false, msg);
    return NextResponse.json({ ok: false, error: "processing failed" }, { status: 500 });
  }
}

async function flipInquiryToWonAndNotify(payment: Payment): Promise<void> {
  if (payment.inquiry_type === "agent_feature") {
    const inq = await getAgentInquiryById(payment.inquiry_id);
    if (!inq) {
      console.warn(
        "[square-webhook] agent inquiry missing, cannot flip to won",
        payment.inquiry_id
      );
      return;
    }
    await updateAgentInquiryStatus(inq.id, "won", null).catch((e) =>
      console.error("[square-webhook] flip-to-won failed", e)
    );
    await sendPaymentReceivedNotification({
      payment,
      payerName: inq.name,
      payerEmail: inq.email,
      inquiryLabel: `${inq.name} — ${inq.brokerage ?? inq.city_state ?? "agent inquiry"}`
    }).catch((e) => console.error("[square-webhook] owner notify failed", e));
    return;
  }

  if (payment.inquiry_type === "rental") {
    const inq = await getRentalInquiryById(payment.inquiry_id);
    if (!inq) {
      console.warn(
        "[square-webhook] rental inquiry missing, cannot flip to won",
        payment.inquiry_id
      );
      return;
    }
    await updateRentalInquiryStatus(inq.id, "won", null).catch((e) =>
      console.error("[square-webhook] flip-to-won (rental) failed", e)
    );
    await sendPaymentReceivedNotification({
      payment,
      payerName: inq.name,
      payerEmail: inq.email,
      inquiryLabel: `${inq.name} — ${inq.destination}`
    }).catch((e) => console.error("[square-webhook] owner notify (rental) failed", e));
    return;
  }
  // buyer_lead intentionally unhandled — no buyer-lead payment flow yet.
}
