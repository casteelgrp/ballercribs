import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

const LAST_UPDATED = "2026-04-28";

export const metadata: Metadata = {
  title: "Disclosures",
  description:
    "Referral, affiliate, and editorial disclosures for BallerCribs.",
  alternates: { canonical: "/disclosures" },
  robots: { index: true, follow: true }
};

export default function DisclosuresPage() {
  return (
    <LegalPage title="Disclosures" lastUpdated={LAST_UPDATED}>
      <h2>Referral disclosure</h2>
      <p>
        Transparency about how BallerCribs, a brand of Casteel Group LLC
        (collectively, &ldquo;BallerCribs,&rdquo; &ldquo;we,&rdquo;
        &ldquo;us,&rdquo; or &ldquo;our&rdquo;), earns money from the buyer
        referrals it originates. This section is a summary — see our{" "}
        <a href="/terms">Terms of Service</a> and{" "}
        <a href="/privacy">Privacy Policy</a> for the full picture.
      </p>

      <h3>Current status</h3>
      <p>
        BallerCribs is in the process of establishing a formal referral
        brokerage arrangement. Once licensed, all buyer referrals will be
        handled through a licensed Limited Function Referral Office (LFRO) in
        compliance with Texas Real Estate Commission (TREC) requirements. Until
        that arrangement is in place, inquiries are routed through our network
        of licensed partner agents on a relationship basis, and referral fees
        are invoiced at close.
      </p>

      <h3>How referrals work</h3>
      <ul>
        <li>
          When a buyer submits an inquiry through the site, we match them with a
          licensed partner agent in the relevant market.
        </li>
        <li>The partner agent follows up with the buyer directly.</li>
        <li>
          BallerCribs does not represent the buyer or the seller. All
          representation is provided by the licensed real estate professional.
        </li>
      </ul>

      <h3>Referral fees</h3>
      <ul>
        <li>
          BallerCribs receives a referral fee from the partner agent when a
          transaction closes with a buyer we introduced.
        </li>
        <li>
          Referral fees are typically 25%–35% of the partner agent&apos;s earned
          commission on the transaction, with the exact percentage agreed to in
          advance between BallerCribs and the partner agent.
        </li>
        <li>
          <strong>Buyers never pay referral fees directly.</strong> The fee is
          paid out of the partner agent&apos;s commission, not from the
          buyer&apos;s pocket.
        </li>
        <li>
          This disclosure is provided because most jurisdictions require
          referral relationships between real estate parties to be disclosed in
          writing. If you have questions about the specific disclosure rules in
          your state, ask your partner agent.
        </li>
      </ul>

      <h3>No guarantee of endorsement</h3>
      <p>
        A listing&apos;s presence on BallerCribs does not constitute
        endorsement of the property, the seller, or the listing agent. Editorial
        features are curated based on what we believe our audience will find
        interesting; paid featured placements are disclosed as such.
      </p>

      <h3>Featured placements vs. editorial coverage</h3>
      <p>
        Some listings on the site are paid featured placements purchased by the
        listing agent or brokerage. These are marketing services — we receive
        payment in exchange for producing and distributing content about the
        listing across our channels. Paid placements and editorial features
        both appear on the site; neither format changes how referrals work or
        how referral fees are earned.
      </p>

      <h2>Affiliate disclosure</h2>
      <p>
        Some rentals on BallerCribs are booked through partner sites. When you
        book through one of these partners, we may earn a commission at no
        extra cost to you. We only feature rentals we&apos;d recommend
        regardless of compensation — partner relationships don&apos;t influence
        editorial selection.
      </p>
      <p>
        Per-partner disclosures, when applicable, appear on individual rental
        pages.
      </p>

      <h2>Questions</h2>
      <p>
        For questions about referral arrangements, partner eligibility, or any
        of these disclosures, email{" "}
        <a href="mailto:info@ballercribs.com">info@ballercribs.com</a>.
      </p>
    </LegalPage>
  );
}
