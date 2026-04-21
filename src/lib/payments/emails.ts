import { Resend } from "resend";
import { ALTERNATE_PAYMENT_INSTRUCTIONS } from "./alternate-payment-instructions";
import type { Payment } from "./types";

type ResendResult = {
  data?: { id?: string } | null;
  error?: { message?: string; name?: string } | null;
};

/**
 * Structured return from every email function. Callers propagate this up to
 * the API response + admin toast so a failed send is visible instead of
 * swallowed. `error` is the Resend-reported message or the thrown message;
 * keep it short enough to show in a UI banner (Resend errors are typically
 * one sentence already).
 */
export interface EmailSendResult {
  sent: boolean;
  id?: string;
  error?: string;
}

function fromAddress(): string {
  return process.env.INQUIRY_FROM_EMAIL || "onboarding@resend.dev";
}

function ownerAddress(): string | undefined {
  return process.env.INQUIRY_NOTIFICATION_EMAIL;
}

function formatAmount(amountCents: number, currency: string): string {
  const dollars = amountCents / 100;
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

function extractErrorMessage(raw: unknown): string {
  if (!raw) return "Unknown email error.";
  if (typeof raw === "string") return raw;
  if (typeof raw === "object") {
    const obj = raw as { message?: string; name?: string };
    if (obj.message) return obj.message;
    if (obj.name) return obj.name;
  }
  return String(raw);
}

/**
 * Square hosted checkout link — sent to the agent. Logs every decision so a
 * failed send is traceable in Vercel logs, and returns a structured result so
 * the API can surface the status in its response / the admin UI toast.
 */
export async function sendPaymentLinkEmail(params: {
  toEmail: string;
  toName: string;
  payment: Payment;
}): Promise<EmailSendResult> {
  const { payment, toEmail, toName } = params;
  console.log("[payments-email] sendPaymentLinkEmail entered", {
    paymentId: payment.id,
    toEmail,
    hasCheckoutUrl: Boolean(payment.checkout_url)
  });

  const apiKey = process.env.RESEND_API_KEY;
  const from = fromAddress();
  console.log("[payments-email] env check", {
    hasApiKey: Boolean(apiKey),
    from,
    replyTo: ownerAddress() ?? null
  });

  if (!apiKey) {
    const msg = "RESEND_API_KEY not configured.";
    console.warn("[payments-email]", msg);
    return { sent: false, error: msg };
  }
  if (!payment.checkout_url) {
    const msg = "Payment has no checkout_url; cannot send payment-link email.";
    console.warn("[payments-email]", msg, { paymentId: payment.id });
    return { sent: false, error: msg };
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
        Secure checkout hosted by Square. After payment, we kick off your feature campaign
        within 24 hours. Reply to this email if anything looks off.
      </p>
    </div>
  `;

  try {
    console.log("[payments-email] calling resend.emails.send", {
      to: toEmail,
      from,
      subject
    });
    const result = (await resend.emails.send({
      from,
      to: toEmail,
      replyTo: ownerAddress(),
      subject,
      html
    })) as ResendResult;
    console.log("[payments-email] resend returned", {
      id: result?.data?.id ?? null,
      error: result?.error ?? null
    });

    if (result?.error) {
      const msg = extractErrorMessage(result.error);
      console.error("[payments-email] Resend API returned error", result.error);
      return { sent: false, error: msg };
    }
    return { sent: true, id: result?.data?.id };
  } catch (err) {
    const msg = extractErrorMessage(err);
    console.error("[payments-email] send threw", err);
    return { sent: false, error: msg };
  }
}

/**
 * Alternate-payment instructions (Zelle / wire) — sent to the agent. Same
 * shape and logging pattern as sendPaymentLinkEmail so both paths report
 * back uniformly to the route handler.
 */
export async function sendAlternatePaymentEmail(params: {
  toEmail: string;
  toName: string;
  payment: Payment;
}): Promise<EmailSendResult> {
  const { payment, toEmail, toName } = params;
  console.log("[payments-email] sendAlternatePaymentEmail entered", {
    paymentId: payment.id,
    toEmail
  });

  const apiKey = process.env.RESEND_API_KEY;
  const from = fromAddress();
  console.log("[payments-email] env check (alternate)", {
    hasApiKey: Boolean(apiKey),
    from,
    replyTo: ownerAddress() ?? null
  });

  if (!apiKey) {
    const msg = "RESEND_API_KEY not configured.";
    console.warn("[payments-email]", msg);
    return { sent: false, error: msg };
  }

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
    console.log("[payments-email] calling resend.emails.send (alternate)", {
      to: toEmail,
      from,
      subject
    });
    const result = (await resend.emails.send({
      from,
      to: toEmail,
      replyTo: ownerAddress(),
      subject,
      html
    })) as ResendResult;
    console.log("[payments-email] resend returned (alternate)", {
      id: result?.data?.id ?? null,
      error: result?.error ?? null
    });

    if (result?.error) {
      const msg = extractErrorMessage(result.error);
      console.error("[payments-email] Resend API returned error (alternate)", result.error);
      return { sent: false, error: msg };
    }
    return { sent: true, id: result?.data?.id };
  } catch (err) {
    const msg = extractErrorMessage(err);
    console.error("[payments-email] send threw (alternate)", err);
    return { sent: false, error: msg };
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
