import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

const LAST_UPDATED = "2026-04-21";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The rules for using BallerCribs — what the site is, how listings and referrals work, payment terms for agents, and the legal fine print.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true }
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated={LAST_UPDATED}>
      <p>
        These terms govern your use of ballercribs.com and any related services
        operated by BallerCribs, a brand of Casteel Group LLC (collectively,
        &ldquo;BallerCribs,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
        &ldquo;our&rdquo;). By using the site you agree to these terms. If you
        don&apos;t agree, please don&apos;t use the site.
      </p>

      <h2>What BallerCribs is</h2>
      <p>
        BallerCribs is an editorial platform that features luxury real estate
        listings across the United States and internationally. We publish listing
        features, newsletters, and social content, and we operate a referral
        network connecting interested buyers with licensed real estate agents.
      </p>
      <p>
        BallerCribs is not itself a real estate brokerage. We do not represent
        buyers or sellers directly. Any real estate transaction resulting from an
        inquiry on our site is conducted by licensed real estate professionals and
        is subject to the laws of the applicable jurisdiction.
      </p>

      <h2>Listings and accuracy</h2>
      <ul>
        <li>
          Listings are based on information provided by third parties — listing
          agents, brokerages, MLS data, and publicly available sources.
        </li>
        <li>
          Prices, availability, square footage, bed/bath counts, and property
          details are subject to change without notice.
        </li>
        <li>
          BallerCribs does not independently verify every data point on every
          listing and makes no guarantee of accuracy, completeness, or currency.
        </li>
        <li>
          Always confirm listing details and property condition directly with the
          listing agent and, when appropriate, through your own due diligence
          before making an offer or financial decision.
        </li>
      </ul>

      <h2>Buyer inquiries and the referral network</h2>
      <p>
        When you submit a buyer inquiry through the site, you authorize us to
        share your contact information and inquiry details with a partner real
        estate agent licensed in the relevant market. The partner agent, not
        BallerCribs, will follow up with you directly.
      </p>
      <p>
        Partner agents pay BallerCribs a referral fee if a transaction results
        from the introduction. Referral fees are typically 25%–35% of the partner
        agent&apos;s earned commission. Buyers never pay BallerCribs directly.
        See our <a href="/disclosures">Disclosures</a> for additional detail.
      </p>

      <h2>Paid features for agents</h2>
      <p>
        Licensed real estate agents and brokerages may purchase featured
        placements for their listings. Pricing and options are communicated
        directly; payment is processed by Square.
      </p>

      <h3>What a feature includes</h3>
      <p>
        Deliverables vary by the package selected and are described at the time
        of purchase. They may include social media posts, a dedicated listing
        page on ballercribs.com, cross-posting to our other channels, or
        inclusion in our newsletter.
      </p>

      <h3>Refunds</h3>
      <p>
        Refunds are available within 30 days of purchase <strong>if the paid
        feature has not yet been published or delivered</strong>. Once a feature
        goes live — posted on Instagram, featured on the site, included in a
        newsletter, or otherwise delivered — the sale is final. Disputes and
        edge cases are reviewed case-by-case. To request a refund or raise a
        dispute, email <a href="mailto:info@ballercribs.com">info@ballercribs.com</a>.
      </p>

      <h3>No performance guarantees</h3>
      <p>
        Featured placements are marketing services. We cannot and do not guarantee
        any specific outcome — number of views, inquiries, leads, showings, or a
        resulting sale. We publish what we agree to publish; results depend on the
        property, the market, and many factors outside our control.
      </p>

      <h2>User conduct</h2>
      <p>By using the site, you agree not to:</p>
      <ul>
        <li>Submit false, misleading, or impersonating inquiries.</li>
        <li>
          Scrape, crawl, reverse-engineer, or attempt to access non-public areas
          of the site by any automated or manual means not provided by the normal
          user interface.
        </li>
        <li>
          Spam our forms, abuse our referral network, or attempt to circumvent
          the referral arrangement with partner agents.
        </li>
        <li>
          Upload or transmit malicious code, viruses, or material designed to
          interfere with the site&apos;s operation.
        </li>
        <li>
          Use the site for any unlawful purpose or in violation of any applicable
          law.
        </li>
      </ul>

      <h2>Intellectual property</h2>
      <p>
        The site&apos;s editorial content, design, branding, BallerCribs name
        and marks, and underlying code are owned by Casteel Group LLC and
        protected by applicable intellectual-property laws.
      </p>
      <p>
        Listing photos and descriptions are used with permission from the
        listing agent or brokerage, or under fair-use principles for editorial
        coverage. If you believe content on the site infringes your rights,
        contact us at the email below and we&apos;ll investigate.
      </p>
      <p>
        When you submit content to us (for example, the text of an inquiry or a
        testimonial), you grant BallerCribs a non-exclusive, worldwide,
        royalty-free license to use it for the purpose of operating the site and
        fulfilling the service you requested. You retain ownership of your
        content.
      </p>

      <h2>Disclaimers</h2>
      <p>
        The site is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo;
        To the fullest extent permitted by law, we disclaim all warranties —
        express, implied, or statutory — including warranties of accuracy,
        availability, merchantability, fitness for a particular purpose, and
        non-infringement.
      </p>
      <p>
        We are not responsible for the actions, omissions, representations, or
        performance of third parties, including listing agents, partner referral
        agents, brokerages, or any party with whom you transact as a result of
        using the site.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, BallerCribs, Casteel Group LLC,
        and their respective members, officers, and employees will not be liable
        for any indirect, incidental, special, consequential, or punitive
        damages arising out of or related to your use of the site.
      </p>
      <p>
        Our total cumulative liability for any claim arising out of or related to
        the site or these terms is capped at the greater of (a) the total amount
        you paid to us in the twelve (12) months preceding the claim, or (b)
        USD $100.
      </p>

      <h2>Indemnification</h2>
      <p>
        You agree to indemnify, defend, and hold harmless BallerCribs, Casteel
        Group LLC, and their members, officers, and employees from any claims,
        losses, damages, or expenses (including reasonable attorneys&apos; fees)
        arising out of your use of the site, your violation of these terms, or
        your violation of any rights of another party.
      </p>

      <h2>Governing law and venue</h2>
      <p>
        These terms are governed by the laws of the State of Texas, without
        regard to its conflict-of-laws rules. Any dispute arising out of or
        related to the site or these terms must be brought exclusively in the
        state or federal courts located in Tarrant County, Texas, and you
        consent to the personal jurisdiction of those courts.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms from time to time. Material changes will be
        reflected on this page and, when appropriate, announced on the site.
        Your continued use after an update means you accept the revised terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Email{" "}
        <a href="mailto:info@ballercribs.com">info@ballercribs.com</a>.
      </p>
    </LegalPage>
  );
}
