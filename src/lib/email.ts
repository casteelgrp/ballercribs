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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
