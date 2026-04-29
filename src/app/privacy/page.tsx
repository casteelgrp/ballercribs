import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

const LAST_UPDATED = "2026-04-21";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How BallerCribs collects, uses, and protects your information when you browse listings, submit inquiries, or subscribe to the newsletter.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true }
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <p>
        BallerCribs, a brand of Casteel Group LLC (collectively, &ldquo;BallerCribs,&rdquo;
        &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), respects your privacy.
        This policy explains what we collect, how we use it, who we share it with,
        and the choices you have.
      </p>

      <h2>What we collect</h2>

      <h3>Information you give us</h3>
      <ul>
        <li>
          <strong>Buyer inquiries:</strong> name, email, phone (optional), the listing
          you&apos;re interested in, your timeline, financing status, and any message
          you include.
        </li>
        <li>
          <strong>Agent inquiries:</strong> name, email, phone, brokerage, city and
          state, inquiry type, and any details you provide about your listing or
          market.
        </li>
        <li>
          <strong>Newsletter signups:</strong> your email address, submitted through
          our newsletter provider (Beehiiv).
        </li>
        <li>
          <strong>Payments:</strong> when an agent purchases a featured placement,
          payment is processed by Square. We don&apos;t see or store card numbers —
          only a confirmation ID, the amount, and whether the payment succeeded.
        </li>
      </ul>

      <h3>Information collected automatically</h3>
      <ul>
        <li>
          <strong>Cookies:</strong> we use session cookies to keep admin users signed in.
          We don&apos;t currently set advertising cookies. If we add analytics cookies
          later, we&apos;ll update this policy.
        </li>
        <li>
          <strong>Server logs:</strong> our hosting provider (Vercel) records standard
          request information such as IP address, browser, and referring page. These
          logs help us diagnose issues and protect the site from abuse.
        </li>
        <li>
          <strong>Site analytics:</strong> privacy-friendly aggregate analytics may be
          added in the future. When they are, we&apos;ll describe them here.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>Respond to your inquiries about specific listings or our services.</li>
        <li>
          Route qualified buyer inquiries to partner real estate agents licensed in
          your market (see our{" "}
          <a href="/disclosures">Disclosures</a> for details).
        </li>
        <li>Send the BallerCribs newsletter and related editorial content you opted into.</li>
        <li>
          Process payments for agent feature purchases and keep records of those
          transactions.
        </li>
        <li>Operate, secure, and improve the site.</li>
        <li>Comply with legal obligations.</li>
      </ul>

      <h2>Who we share it with</h2>
      <ul>
        <li>
          <strong>Partner agents:</strong> when a buyer submits an inquiry, we may
          share the relevant details with a licensed partner agent in that market so
          they can follow up. Submitting an inquiry authorizes this referral.
        </li>
        <li>
          <strong>Service providers who help us operate the site:</strong>
          <ul>
            <li>Square — payment processing for agent features</li>
            <li>Resend — transactional email delivery</li>
            <li>Beehiiv — newsletter management</li>
            <li>Vercel — site hosting and infrastructure</li>
            <li>Neon — database hosting</li>
          </ul>
          These providers only process your information on our behalf to deliver their
          specific service.
        </li>
        <li>
          <strong>Law enforcement or regulators</strong> when required by a lawful
          request.
        </li>
      </ul>
      <p>
        We do not sell your personal information, and we do not share it with
        advertisers.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>
          <strong>Inquiries:</strong> retained indefinitely so we can reference them
          for future referrals or customer-service context, unless you request deletion.
        </li>
        <li>
          <strong>Payment records:</strong> retained for seven (7) years to satisfy
          tax and financial record-keeping requirements.
        </li>
        <li>
          <strong>Newsletter subscriptions:</strong> retained until you unsubscribe.
        </li>
      </ul>

      <h2>Your rights</h2>
      <p>Regardless of where you live, you can:</p>
      <ul>
        <li>Ask us what information we have about you.</li>
        <li>Ask us to correct or delete it.</li>
        <li>
          Unsubscribe from the newsletter at any time using the link at the bottom of
          any email.
        </li>
      </ul>

      <h3>California residents (CCPA / CPRA)</h3>
      <p>
        If you live in California, you have additional rights, including the right to
        know what personal information we&apos;ve collected about you in the past twelve
        months, the right to request deletion, and the right to not be discriminated
        against for exercising these rights. We don&apos;t sell personal information,
        so there&apos;s nothing to opt out of in that sense. To make a request, email
        us at the address below.
      </p>

      <h3>EU / UK / EEA residents (GDPR)</h3>
      <p>
        If you&apos;re in the European Union, United Kingdom, or European Economic Area,
        you have the right to access, correct, delete, restrict, or object to our
        processing of your personal data, and to data portability. Our legal bases
        for processing are your consent (newsletter, inquiries) and our legitimate
        interests in operating and securing the site. You also have the right to
        lodge a complaint with your local data protection authority.
      </p>

      <h2>Children&apos;s privacy</h2>
      <p>
        BallerCribs is not directed at children under 13, and we don&apos;t knowingly
        collect information from them. If you believe a child has submitted
        information to us, please contact us and we&apos;ll delete it.
      </p>

      <h2>Security</h2>
      <p>
        We use commercially reasonable measures to protect your information, including
        encrypted transport (HTTPS), hashed passwords for admin accounts, and
        restricted access to our database. No system is perfect — please use a strong,
        unique password if you have an admin account with us, and report any security
        concerns to the email below.
      </p>

      <h2>Updates to this policy</h2>
      <p>
        We may update this policy from time to time. Material changes will be
        highlighted on the site. The &ldquo;Last updated&rdquo; date at the top of
        this page reflects the most recent revision.
      </p>

      <h2>Contact us</h2>
      <p>
        For privacy questions, data requests, or to exercise any of the rights above,
        email us at <a href="mailto:info@ballercribs.com">info@ballercribs.com</a>.
      </p>
    </LegalPage>
  );
}
