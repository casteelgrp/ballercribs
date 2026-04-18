import { Resend } from "resend";
import type { Inquiry, Listing } from "./types";

export async function sendInquiryNotification(
  inquiry: Inquiry,
  listing: Listing | null
) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.INQUIRY_NOTIFICATION_EMAIL;
  const from = process.env.INQUIRY_FROM_EMAIL || "onboarding@resend.dev";

  if (!apiKey || !to) {
    console.warn("Resend not configured - skipping email notification.");
    return;
  }

  const resend = new Resend(apiKey);

  const subject = listing
    ? `New inquiry: ${listing.title}`
    : `New inquiry from ${inquiry.name}`;

  const listingLine = listing
    ? `<p><strong>Property:</strong> ${escapeHtml(listing.title)} — ${escapeHtml(listing.location)}<br/>
       <strong>Price:</strong> $${Number(listing.price_usd).toLocaleString()}</p>`
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
    await resend.emails.send({ from, to, subject, html, replyTo: inquiry.email });
  } catch (err) {
    console.error("Failed to send inquiry email:", err);
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
