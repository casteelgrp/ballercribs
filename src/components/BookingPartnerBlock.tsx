import Image from "next/image";
import Link from "next/link";
import type { Listing, Partner } from "@/lib/types";

/**
 * Sidebar booking block on rental detail pages. Shape depends on the
 * partner's cta_mode:
 *   - outbound_link: partner identity is up-front. Logo (centered) or
 *     name header at the top, tracking-URL CTA opens the partner site
 *     in a new tab with rel="noopener sponsored" per Google + FTC
 *     conventions, footnote names the fulfilling partner.
 *   - inquiry_form: partner identity is INTERNAL only. No logo, no
 *     name surfaced in body copy — users are inquiring with
 *     BallerCribs and we forward behind the scenes. Naming the
 *     internal placeholder "Direct" partner publicly creates wrong
 *     expectations + breaks down for any partner with a back-office
 *     name not meant for visitors.
 *
 * Per-partner disclosure_text (when present on the partner row)
 * renders as fine print below the CTA — smaller, italic, muted —
 * distinct from the informational footnote ("Bookings handled
 * directly by …" or "Typical reply within 48 hours") that sits
 * above it. Site-wide affiliate disclosure lives at /disclosures
 * (linked from the footer); per-partner copy here is for partner-
 * specific legal language, not duplicating the site disclosure.
 */
export function BookingPartnerBlock({
  listing,
  partner
}: {
  listing: Listing;
  partner: Partner;
}) {
  const ctaClass =
    "inline-block bg-ink text-paper px-5 py-3 text-xs uppercase tracking-widest hover:bg-accent hover:text-ink transition-colors w-full text-center";

  return (
    <div className="lg:sticky lg:top-24 border border-black/10 bg-white p-6">
      {partner.cta_mode === "outbound_link" ? (
        <OutboundCta listing={listing} partner={partner} ctaClass={ctaClass} />
      ) : (
        <InquiryCta listing={listing} ctaLabel={partner.cta_label} ctaClass={ctaClass} />
      )}

      {partner.disclosure_text && partner.disclosure_text.trim() && (
        // Fine print: smaller than the informational footnote above
        // (text-[11px]), muted further, italic for the disclosure
        // register. Both modes render this block when the partner
        // row has disclosure_text set.
        <p className="text-[10px] text-black/40 italic mt-4 leading-relaxed">
          {partner.disclosure_text}
        </p>
      )}
    </div>
  );
}

function OutboundCta({
  listing,
  partner,
  ctaClass
}: {
  listing: Listing;
  partner: Partner;
  ctaClass: string;
}) {
  // Form validation in commit 3 guarantees an outbound_link partner
  // attaches both URLs. If the row somehow lands here without a
  // tracking URL (admin manually nulled the column, legacy data,
  // etc.), we render the inquiry-form fallback — better than a
  // dead-link CTA. Falls through with a generic CTA label since
  // partner.cta_label may name the partner ("Book on Villanovo")
  // which doesn't fit the inquiry-form layout.
  if (!listing.partner_tracking_url) {
    return (
      <InquiryCta
        listing={listing}
        ctaLabel="Inquire about this rental"
        ctaClass={ctaClass}
      />
    );
  }

  return (
    <>
      {partner.logo_url ? (
        <div className="relative w-full h-12 mb-4">
          <Image
            src={partner.logo_url}
            alt={`${partner.name} logo`}
            fill
            sizes="(max-width: 1024px) 100vw, 320px"
            // Centered horizontally to match the rest of the
            // outbound-mode block (CTA + footnote both center-aligned).
            className="object-contain object-center"
          />
        </div>
      ) : (
        <p className="font-display text-2xl mb-4 text-center">{partner.name}</p>
      )}
      <p className="text-xs uppercase tracking-widest text-black/50 mb-3 text-center">
        Book this rental
      </p>
      <a
        href={listing.partner_tracking_url}
        target="_blank"
        // noopener: prevents the destination from accessing window.opener.
        // sponsored: Google's required attribute for affiliate links;
        // signals the relationship explicitly so Search treats the link
        // appropriately and the FTC disclosure is materially backed.
        rel="noopener sponsored"
        className={ctaClass}
      >
        {partner.cta_label} →
      </a>
      <p className="text-[11px] text-black/45 mt-4 text-center">
        Bookings handled directly by {partner.name}.
      </p>
    </>
  );
}

function InquiryCta({
  listing,
  ctaLabel,
  ctaClass
}: {
  listing: Listing;
  ctaLabel: string;
  ctaClass: string;
}) {
  // No partner name surfaced anywhere in this layout — neither logo
  // nor name header at the top, nor in body copy. The user is
  // inquiring with BallerCribs; we route to the right partner behind
  // the scenes. Body copy stays generic regardless of which partner
  // is attached so the "Direct" placeholder + any future partners
  // both read consistently.
  return (
    <>
      <h2 className="font-display text-2xl">Interested?</h2>
      <p className="text-sm text-black/60 mt-1 mb-6">
        Tell us when you&apos;re thinking + who&apos;s coming and we&apos;ll
        connect you with the right rental agent.
      </p>
      <Link
        href={`/rentals?property=${encodeURIComponent(listing.slug)}#inquire`}
        className={ctaClass}
      >
        {ctaLabel} →
      </Link>
      <p className="text-[11px] text-black/45 mt-4 text-center">
        Typical reply within 48 business hours.
      </p>
    </>
  );
}
