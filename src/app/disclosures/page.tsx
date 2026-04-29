import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

const LAST_UPDATED = "2026-04-28";

export const metadata: Metadata = {
  title: "Disclosures",
  description:
    "Affiliate, sponsorship, and editorial disclosures for BallerCribs.",
  alternates: { canonical: "/disclosures" },
  robots: { index: true, follow: true }
};

export default function DisclosuresPage() {
  return (
    <LegalPage title="Disclosures" lastUpdated={LAST_UPDATED}>
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
    </LegalPage>
  );
}
