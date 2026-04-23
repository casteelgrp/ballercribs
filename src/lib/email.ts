import { Resend } from "resend";
import { formatPrice } from "./currency";
import type { AgentInquiry, Inquiry, Listing, RentalInquiry } from "./types";

// Unwrap Resend SDK's { data, error } response shape.
type ResendResult = { data?: { id?: string } | null; error?: { message?: string; name?: string } | null };

export async function sendInquiryNotification(
  inquiry: Inquiry,
  listing: Listing | null
) {
  console.log("[buyer-email] function entered", { inquiryId: inquiry.id });

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.INQUIRY_NOTIFICATION_EMAIL;
  const from = process.env.INQUIRY_FROM_EMAIL || "onboarding@resend.dev";

  console.log("[buyer-email] env check", {
    hasApiKey: Boolean(apiKey),
    from,
    to
  });

  if (!apiKey || !to) {
    console.warn("[buyer-email] Resend not configured — skipping email notification.");
    return;
  }

  const resend = new Resend(apiKey);

  const subject = listing
    ? `New inquiry: ${listing.title}`
    : `New inquiry from ${inquiry.name}`;

  const listingLine = listing
    ? `<p><strong>Property:</strong> ${escapeHtml(listing.title)} — ${escapeHtml(listing.location)}<br/>
       <strong>Price:</strong> ${escapeHtml(formatPrice(listing.price_usd, listing.currency, { compact: false }))}</p>`
    : "";

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px;">
      <h2 style="margin:0 0 16px">New BallerCribs inquiry</h2>
      ${listingLine}
      <p><strong>From:</strong> ${escapeHtml(inquiry.name)} &lt;${escapeHtml(inquiry.email)}&gt;</p>
      ${inquiry.phone ? `<p><strong>Phone:</strong> ${escapeHtml(inquiry.phone)}</p>` : ""}
      ${inquiry.timeline ? `<p><strong>Timeline:</strong> ${escapeHtml(inquiry.timeline)}</p>` : ""}
      <p><strong>Pre-approved / proof of funds:</strong> ${inquiry.pre_approved ? "Yes" : "Not indicated"}</p>
      ${inquiry.message ? `<p><strong>Message:</strong><br/>${escapeHtml(inquiry.message).replace(/\n/g, "<br/>")}</p>` : ""}
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
      <p style="font-size:12px;color:#888">Inquiry #${inquiry.id} · ${new Date(inquiry.created_at).toLocaleString()}</p>
    </div>
  `;

  try {
    console.log("[buyer-email] calling resend", { to, from, subject });
    const result = (await resend.emails.send({
      from,
      to,
      subject,
      html,
      replyTo: inquiry.email
    })) as ResendResult;
    console.log("[buyer-email] resend returned", {
      error: result?.error ?? null,
      id: result?.data?.id ?? null
    });
    if (result?.error) {
      console.error("[buyer-email] Resend returned error object", result.error);
      return;
    }
    console.log("[buyer-email] email sent", { id: inquiry.id, to });
  } catch (err) {
    console.error("[buyer-email] threw", err);
  }
}

export async function sendAgentInquiryNotification(inquiry: AgentInquiry) {
  console.log("[agent-email] function entered", { inquiryId: inquiry.id });

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.INQUIRY_NOTIFICATION_EMAIL;
  const from = process.env.INQUIRY_FROM_EMAIL || "onboarding@resend.dev";

  console.log("[agent-email] env check", {
    hasApiKey: Boolean(apiKey),
    from,
    to
  });

  if (!apiKey || !to) {
    console.warn("[agent-email] Resend not configured — skipping agent-inquiry email.");
    return;
  }

  const resend = new Resend(apiKey);

  const typeLabel =
    inquiry.inquiry_type === "featured"
      ? "Featured listing"
      : inquiry.inquiry_type === "referral"
        ? "Referral partnership"
        : "Other";

  const headerDetail = inquiry.brokerage || inquiry.city_state || inquiry.email;
  const subject = `New agent inquiry: ${typeLabel} — ${inquiry.name} (${headerDetail})`;

  const rows: Array<[string, string | null]> = [
    ["Inquiry type", typeLabel],
    ["Name", inquiry.name],
    ["Email", inquiry.email],
    ["Phone", inquiry.phone],
    ["Brokerage", inquiry.brokerage],
    ["City/State", inquiry.city_state]
  ];

  const detailRows = rows
    .filter(([, v]) => Boolean(v))
    .map(
      ([label, value]) =>
        `<p style="margin:4px 0"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value))}</p>`
    )
    .join("");

  const messageBlock = inquiry.message
    ? `<p style="margin:16px 0 4px"><strong>Message:</strong></p>
       <p style="margin:0;white-space:pre-wrap">${escapeHtml(inquiry.message)}</p>`
    : "";

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px;">
      <h2 style="margin:0 0 16px">New BallerCribs agent inquiry</h2>
      ${detailRows}
      ${messageBlock}
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
      <p style="font-size:12px;color:#888">Agent inquiry #${inquiry.id} · ${new Date(inquiry.created_at).toLocaleString()}</p>
    </div>
  `;

  try {
    console.log("[agent-email] calling resend", { to, from, subject });
    const result = (await resend.emails.send({
      from,
      to,
      subject,
      html,
      replyTo: inquiry.email
    })) as ResendResult;
    console.log("[agent-email] resend returned", {
      error: result?.error ?? null,
      id: result?.data?.id ?? null
    });
    if (result?.error) {
      console.error("[agent-email] Resend returned error object", result.error);
      return;
    }
    console.log("[agent-email] email sent", { id: inquiry.id, to });
  } catch (err) {
    console.error("[agent-email] threw", err);
  }
}

/**
 * Owner notification for a new rental inquiry. Same env-var + log shape as
 * sendAgentInquiryNotification so the two surfaces are diagnosable via a
 * single grep of "[rental-email]" in Vercel logs.
 */
const BUDGET_LABEL: Record<string, string> = {
  under_25k: "Under $25K",
  "25k_50k": "$25K–$50K",
  "50k_100k": "$50K–$100K",
  "100k_plus": "$100K+",
  flexible: "Flexible"
};

export async function sendRentalInquiryNotification(inquiry: RentalInquiry) {
  console.log("[rental-email] function entered", { inquiryId: inquiry.id });

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.INQUIRY_NOTIFICATION_EMAIL;
  const from = process.env.INQUIRY_FROM_EMAIL || "onboarding@resend.dev";

  console.log("[rental-email] env check", {
    hasApiKey: Boolean(apiKey),
    from,
    to
  });

  if (!apiKey || !to) {
    console.warn("[rental-email] Resend not configured — skipping rental-inquiry email.");
    return;
  }

  const resend = new Resend(apiKey);

  const dateRange = inquiry.flexible_dates
    ? "Flexible"
    : inquiry.start_date && inquiry.end_date
      ? `${inquiry.start_date} → ${inquiry.end_date}`
      : inquiry.start_date
        ? `From ${inquiry.start_date}`
        : inquiry.end_date
          ? `Until ${inquiry.end_date}`
          : "Not specified";

  const budgetLabel = inquiry.budget_range
    ? BUDGET_LABEL[inquiry.budget_range] ?? inquiry.budget_range
    : null;

  const subject = `New rental inquiry: ${inquiry.destination} — ${inquiry.name}`;

  const rows: Array<[string, string | null]> = [
    ["Name", inquiry.name],
    ["Email", inquiry.email],
    ["Phone", inquiry.phone],
    ["Destination", inquiry.destination],
    ["Dates", dateRange],
    ["Group size", inquiry.group_size !== null ? String(inquiry.group_size) : null],
    ["Budget", budgetLabel],
    ["Occasion", inquiry.occasion]
  ];

  const detailRows = rows
    .filter(([, v]) => Boolean(v))
    .map(
      ([label, value]) =>
        `<p style="margin:4px 0"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value))}</p>`
    )
    .join("");

  const messageBlock = inquiry.message
    ? `<p style="margin:16px 0 4px"><strong>Message:</strong></p>
       <p style="margin:0;white-space:pre-wrap">${escapeHtml(inquiry.message)}</p>`
    : "";

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px;">
      <h2 style="margin:0 0 16px">New BallerCribs rental inquiry</h2>
      ${detailRows}
      ${messageBlock}
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
      <p style="font-size:12px;color:#888">Rental inquiry #${inquiry.id} · ${new Date(inquiry.created_at).toLocaleString()}</p>
    </div>
  `;

  try {
    console.log("[rental-email] calling resend", { to, from, subject });
    const result = (await resend.emails.send({
      from,
      to,
      subject,
      html,
      replyTo: inquiry.email
    })) as ResendResult;
    console.log("[rental-email] resend returned", {
      error: result?.error ?? null,
      id: result?.data?.id ?? null
    });
    if (result?.error) {
      console.error("[rental-email] Resend returned error object", result.error);
      return;
    }
    console.log("[rental-email] email sent", { id: inquiry.id, to });
  } catch (err) {
    console.error("[rental-email] threw", err);
  }
}

export interface InviteEmailResult {
  ok: boolean;
  error?: string;
}

export async function sendInviteEmail(opts: {
  toEmail: string;
  toName: string;
  tempPassword: string;
  inviterEmail: string;
  inviterName: string;
  loginUrl: string;
}): Promise<InviteEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INQUIRY_FROM_EMAIL || "onboarding@resend.dev";

  if (!apiKey) {
    return { ok: false, error: "Email service not configured (RESEND_API_KEY missing)." };
  }

  const resend = new Resend(apiKey);
  const subject = "You've been invited to BallerCribs";

  // Plain-text password in the email body is the v1 compromise — we tell the user
  // to change it on first login. Long-term: send a one-time setup link instead.
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; color:#111;">
      <h2 style="margin:0 0 16px;font-weight:600">You've been invited to BallerCribs</h2>
      <p>${escapeHtml(opts.inviterName)} added you as a contributor on
        <a href="https://ballercribs.vercel.app" style="color:#000;text-decoration:underline">BallerCribs</a>.
      </p>
      <div style="background:#f5f5f5;border-left:3px solid #000;padding:14px 16px;margin:18px 0">
        <p style="margin:0 0 6px"><strong>Sign in:</strong> <a href="${opts.loginUrl}" style="color:#000">${opts.loginUrl}</a></p>
        <p style="margin:0 0 6px"><strong>Email:</strong> ${escapeHtml(opts.toEmail)}</p>
        <p style="margin:0"><strong>Temporary password:</strong>
          <code style="font-family:Menlo,Consolas,monospace;background:#fff;padding:2px 6px;border:1px solid #ddd">${escapeHtml(opts.tempPassword)}</code>
        </p>
      </div>
      <p>You'll be asked to choose a new password the first time you sign in.</p>
      <p style="color:#666;font-size:13px;margin-top:28px">
        Reply to this email if you have questions — it'll go straight to ${escapeHtml(opts.inviterName)}.
      </p>
    </div>
  `;

  try {
    const result = await resend.emails.send({
      from,
      to: opts.toEmail,
      subject,
      html,
      replyTo: opts.inviterEmail
    });
    if ((result as { error?: { message?: string } } | null)?.error) {
      const msg = (result as any).error?.message ?? "Unknown Resend error";
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Failed to send invite email:", err);
    return { ok: false, error: msg };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
