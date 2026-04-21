import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { getAgentInquiryById } from "@/lib/db";
import {
  createPayment,
  isTierKey,
  paymentProvider,
  resolveTierAmount,
  sendAlternatePaymentEmail,
  sendPaymentLinkEmail,
  setAgentInquiryTier,
  type InquiryPaymentType,
  type TierKey
} from "@/lib/payments";

export const runtime = "nodejs";

type PaymentMethodChoice = "square" | "alternate";

/**
 * POST /api/admin/payments/generate-link
 *
 * Owner-only. Creates a payments row for an inquiry and either:
 *  - 'square': generates a Square hosted checkout link and emails it to the agent
 *  - 'alternate': records a pending payment and emails Zelle/wire instructions
 *
 * Either way, the agent_inquiries.tier column is updated so the admin UI
 * shows the tier pill. Only agent_feature inquiries are supported today —
 * buyer_lead will come later (the schema allows it).
 */
export async function POST(req: Request) {
  let user;
  try {
    user = await requireOwner();
  } catch (res) {
    return res as Response;
  }

  let body: {
    inquiry_id?: unknown;
    inquiry_type?: unknown;
    tier?: unknown;
    amount_cents?: unknown;
    line_item_description?: unknown;
    payment_method?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const inquiry_id = Number(body.inquiry_id);
  if (!Number.isFinite(inquiry_id) || inquiry_id < 1) {
    return NextResponse.json({ error: "inquiry_id is required." }, { status: 400 });
  }

  if (body.inquiry_type !== "agent_feature") {
    return NextResponse.json(
      { error: "Only inquiry_type='agent_feature' is supported right now." },
      { status: 400 }
    );
  }
  const inquiry_type: InquiryPaymentType = "agent_feature";

  if (!isTierKey(body.tier)) {
    return NextResponse.json(
      { error: "tier must be one of: featured, premium, elite, custom." },
      { status: 400 }
    );
  }
  const tier: TierKey = body.tier;

  if (body.payment_method !== "square" && body.payment_method !== "alternate") {
    return NextResponse.json(
      { error: "payment_method must be 'square' or 'alternate'." },
      { status: 400 }
    );
  }
  const payment_method: PaymentMethodChoice = body.payment_method;

  if (typeof body.line_item_description !== "string" || !body.line_item_description.trim()) {
    return NextResponse.json(
      { error: "line_item_description is required." },
      { status: 400 }
    );
  }
  const lineItem = body.line_item_description.trim();

  // Custom tier requires an explicit amount; other tiers reject amount.
  const customAmount =
    body.amount_cents === undefined || body.amount_cents === null
      ? null
      : Number(body.amount_cents);
  const resolved = resolveTierAmount(
    tier,
    customAmount !== null && Number.isFinite(customAmount) ? customAmount : undefined
  );
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  // Look up the inquiry for email targeting + context in the owner email.
  const inquiry = await getAgentInquiryById(inquiry_id);
  if (!inquiry) {
    return NextResponse.json({ error: "Inquiry not found." }, { status: 404 });
  }

  // ── Square path ──────────────────────────────────────────────────────────
  if (payment_method === "square") {
    let checkout;
    try {
      // Create the row first with a placeholder checkout state so we have a
      // reference_code to hand to Square. Then update once Square responds.
      // If Square fails, the row is still there in status=pending — the
      // admin can retry.
      const payment = await createPayment({
        inquiry_type,
        inquiry_id,
        amount_cents: resolved.amount_cents,
        tier,
        line_item_description: lineItem,
        created_by_user_id: user.id,
        metadata: { payment_method_choice: "square" }
      });

      checkout = await paymentProvider.createCheckoutLink({
        amount_cents: resolved.amount_cents,
        currency: payment.currency,
        name: lineItem,
        reference_code: payment.reference_code,
        buyer_email: inquiry.email,
        payment_note: `BallerCribs ${tier} — ${payment.reference_code}`
      });

      // Fill in provider-side fields + checkout url. updatePayment only
      // exposes the fields it can touch; for the rest we write directly.
      const { sql } = await import("@vercel/postgres");
      await sql`
        UPDATE payments
        SET provider_link_id = ${checkout.provider_link_id},
            provider_order_id = ${checkout.provider_order_id},
            checkout_url = ${checkout.checkout_url},
            updated_at = NOW()
        WHERE id = ${payment.id};
      `;
      const finalPayment = { ...payment, ...checkout, checkout_url: checkout.checkout_url };

      await setAgentInquiryTier(inquiry_id, tier);

      await sendPaymentLinkEmail({
        toEmail: inquiry.email,
        toName: inquiry.name,
        payment: finalPayment
      });

      return NextResponse.json({ ok: true, payment: finalPayment });
    } catch (err) {
      console.error("[generate-link] Square path failed:", err);
      return NextResponse.json(
        { error: "Could not create Square checkout link." },
        { status: 502 }
      );
    }
  }

  // ── Alternate path (Zelle / wire) ────────────────────────────────────────
  const payment = await createPayment({
    inquiry_type,
    inquiry_id,
    amount_cents: resolved.amount_cents,
    tier,
    line_item_description: lineItem,
    // Default the method to zelle — admin updates at mark-paid time with
    // the actual instrument the agent used.
    payment_method: "zelle",
    created_by_user_id: user.id,
    metadata: { payment_method_choice: "alternate" }
  });

  await setAgentInquiryTier(inquiry_id, tier);

  await sendAlternatePaymentEmail({
    toEmail: inquiry.email,
    toName: inquiry.name,
    payment
  });

  return NextResponse.json({ ok: true, payment });
}
