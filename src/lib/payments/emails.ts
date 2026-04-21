import { Resend } from "resend";
import { ALTERNATE_PAYMENT_INSTRUCTIONS } from "./alternate-payment-instructions";
import type { Payment } from "./types";

type ResendResult = {
  data?: { id?: string } | null;
  error?: { message?: string; name?: string } | null;
};

function fromAddress(): string {
  return process.env.INQUIRY_FROM_EMAIL || "onboarding@resend.dev";
}

function ownerAddress(): string | undefined {
  return process.env.INQUIRY_NOTIFICATION_EMAIL;
}

function formatAmount(amountCents: number, currency: string): string {
  const dollars = amountCents / 100;
  // Keep the currency explicit in emails — agents might not be US-based.
  return `$${dollars.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} ${currency}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function textToHtml(s: string): string {
  return escapeHtml(s).replace(/\n/g, "<br/>");
}

/** Square hosted checkout link — sent to the agent. */
export async function sendPaymentLinkEmail(params: {
  toEmail: string;
  toName: string;
  payment: Payment;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[payments-email] Resend not configured — skipping payment-link email.");
    return;
  }
  const { payment, toEmail, toName } = params;
  if (!payment.checkout_url) {
    console.warn("[payments-email] payment has no checkout_url; skipping link email.", {
      paymentId: payment.id
    });
    return;
  }

  const resend = new Resend(apiKey);
  const amount = formatAmount(payment.amount_cents, payment.currency);
  const subject = `Payment link — ${payment.line_item_description ?? "BallerCribs feature"}`;

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 560px;">
      <h2 style="margin:0 0 16px">Your BallerCribs payment link</h2>
      <p>Hi ${escapeHtml(toName)},</p>
      <p>
        ${escapeHtml(payment.line_item_description ?? "BallerCribs feature")}<br/>
        <strong>Amount:</strong> ${amount}
      </p>
      <p style="margin:24px 0">
        <a href="${payment.checkout_url}"
           style="display:inline-block;background:#111;color:#fff;padding:12px 20px;
                  text-decoration:none;font-size:14px;letter-spacing:0.05em;text-transform:uppercase">
          Pay Now →
        </a>
      </p>
      <p style="color:#666;font-size:13px">
        Reference: <code>${escapeHtml(payment.reference_code)}</code><br/>
        If the button doesn't work, copy this URL:<br/>
        <code style="word-break:break-all">${escapeHtml(payment.checkout_url)}</code>
      </p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
      <p style="color:#888;font-size:12px">
        Secure checkout hosted by Square. Reply to this email if anything looks off.
      </p>
    </div>
  `;

  try {
    const result = (await resend.emails.send({
      from: fromAddress(),
      to: toEmail,
      replyTo: ownerAddress(),
      subject,
      html
    })) as ResendResult;
    if (result?.error) {
      console.error("[payments-email] send failed", result.error);
    }
  } catch (err) {
    console.error("[payments-email] threw", err);
  }
}

/** Alternate-payment instructions (Zelle / wire) — sent to the agent. */
export async function sendAlternatePaymentEmail(params: {
  toEmail: string;
  toName: string;
  payment: Payment;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[payments-email] Resend not configured — skipping alternate-payment email.");
    return;
  }
  const { payment, toEmail, toName } = params;
  const resend = new Resend(apiKey);

  const amountStr = formatAmount(payment.amount_cents, payment.currency);
  const amountShort = (payment.amount_cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const instructions = ALTERNATE_PAYMENT_INSTRUCTIONS.replace(/\[AMOUNT\]/g, amountShort).replace(
    /\[REFERENCE_CODE\]/g,
    payment.reference_code
  );

  const subject = `Payment instructions — ${payment.line_item_description ?? "BallerCribs feature"}`;

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 560px;">
      <h2 style="margin:0 0 16px">Payment instructions</h2>
      <p>Hi ${escapeHtml(toName)},</p>
      <p>
        ${escapeHtml(payment.line_item_description ?? "BallerCribs feature")}<br/>
        <strong>Amount:</strong> ${amountStr}
      </p>
      <div style="background:#f6f5f1;border:1px solid #e4e1d6;padding:16px 20px;
                  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;font-size:13px;
                  white-space:pre-wrap;line-height:1.55">${textToHtml(instructions)}</div>
      <p style="color:#666;font-size:13px;margin-top:16px">
        Reference: <code>${escapeHtml(payment.reference_code)}</code>
      </p>
    </div>
  `;

  try {
    const result = (await resend.emails.send({
      from: fromAddress(),
      to: toEmail,
      replyTo: ownerAddress(),
      subject,
      html
    })) as ResendResult;
    if (result?.error) {
      console.error("[payments-email] send failed", result.error);
    }
  } catch (err) {
    console.error("[payments-email] threw", err);
  }
}

/** Owner notification when a payment completes (webhook or manual mark-paid). */
export async function sendPaymentReceivedNotification(params: {
  payment: Payment;
  payerName: string | null;
  payerEmail: string | null;
  inquiryLabel: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = ownerAddress();
  if (!apiKey || !to) {
    console.warn(
      "[payments-email] owner notify skipped — RESEND_API_KEY or INQUIRY_NOTIFICATION_EMAIL not set."
    );
    return;
  }
  const { payment, payerName, payerEmail, inquiryLabel } = params;
  const resend = new Resend(apiKey);
  const amount = formatAmount(payment.amount_cents, payment.currency);

  const subject = `Payment received: ${amount} — ${payerName ?? "BallerCribs agent"}`;
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 560px;">
      <h2 style="margin:0 0 16px">Payment received</h2>
      <p><strong>Amount:</strong> ${amount}</p>
      <p><strong>From:</strong> ${escapeHtml(payerName ?? "—")}${
        payerEmail ? ` &lt;${escapeHtml(payerEmail)}&gt;` : ""
      }</p>
      <p><strong>For:</strong> ${escapeHtml(inquiryLabel)}</p>
      <p><strong>Method:</strong> ${escapeHtml(payment.payment_method ?? "—")}</p>
      <p><strong>Reference:</strong> <code>${escapeHtml(payment.reference_code)}</code></p>
      <p><strong>Status:</strong> ${escapeHtml(payment.status)}</p>
    </div>
  `;

  try {
    const result = (await resend.emails.send({
      from: fromAddress(),
      to,
      subject,
      html
    })) as ResendResult;
    if (result?.error) {
      console.error("[payments-email] owner notify failed", result.error);
    }
  } catch (err) {
    console.error("[payments-email] owner notify threw", err);
  }
}
