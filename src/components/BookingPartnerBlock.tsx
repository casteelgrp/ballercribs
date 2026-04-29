import Image from "next/image";
import Link from "next/link";
import type { Listing, Partner } from "@/lib/types";

/**
 * Sidebar booking block on rental detail pages. Shape depends on the
 * partner's cta_mode:
 *   - outbound_link: tracking-URL CTA opens the partner's site in a new
 *     tab. rel="noopener sponsored" per Google's affiliate-link norms +
 *     FTC disclosure conventions.
 *   - inquiry_form: routes to the universal /rentals?property=slug
 *     flow that pre-fills + scrolls to the form anchor (existing behavior).
 *
 * Logo renders via next/image when partner.logo_url is set; otherwise
 * the partner name appears in heading style. Auto-derived alt text
 * `${partner.name} logo` — admin form deliberately doesn't expose an
 * alt field because the partner's own name is the only honest
 * description for a brand mark. Container is fixed-height +
 * object-contain so logos at any aspect ratio don't stretch.
 *
 * Per-partner disclosure_text renders in small muted text below the
 * CTA when present. Site-wide affiliate disclosure lives at
 * /disclosures (linked from the footer); the per-partner copy here
 * is for partner-specific legal language, not duplicating the site
 * disclosure.
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
      {partner.logo_url ? (
        <div className="relative w-full h-12 mb-4">
          <Image
            src={partner.logo_url}
            alt={`${partner.name} logo`}
            fill
            sizes="(max-width: 1024px) 100vw, 320px"
            className="object-contain object-left"
          />
        </div>
      ) : (
        <p className="font-display text-2xl mb-4">{partner.name}</p>
      )}

      {partner.cta_mode === "outbound_link" ? (
        <OutboundCta listing={listing} partner={partner} ctaClass={ctaClass} />
      ) : (
        <InquiryCta listing={listing} partner={partner} ctaClass={ctaClass} />
      )}

      {partner.disclosure_text && partner.disclosure_text.trim() && (
        <p className="text-[11px] text-black/55 mt-4 leading-relaxed">
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
  // dead-link CTA.
  if (!listing.partner_tracking_url) {
    return <InquiryCta listing={listing} partner={partner} ctaClass={ctaClass} />;
  }

  return (
    <>
      <p className="text-xs uppercase tracking-widest text-black/50 mb-3">
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
  partner,
  ctaClass
}: {
  listing: Listing;
  partner: Partner;
  ctaClass: string;
}) {
  return (
    <>
      <h2 className="font-display text-2xl">Interested?</h2>
      <p className="text-sm text-black/60 mt-1 mb-6">
        Tell us when you&apos;re thinking + who&apos;s coming and we&apos;ll
        connect you with {partner.name}.
      </p>
      <Link
        href={`/rentals?property=${encodeURIComponent(listing.slug)}#inquire`}
        className={ctaClass}
      >
        {partner.cta_label} →
      </Link>
      <p className="text-[11px] text-black/45 mt-4 text-center">
        Typical reply within 48 business hours.
      </p>
    </>
  );
}
