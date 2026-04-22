import type { Metadata } from "next";
import { RentalInquiryForm } from "@/components/RentalInquiryForm";

export const metadata: Metadata = {
  title: "Rent a Mega-Mansion",
  description:
    "Short-term luxury mansion rentals for weddings, family trips, and corporate retreats. Tell us where and when — we'll connect you with the right property.",
  openGraph: {
    title: "Rent a Mega-Mansion | BallerCribs",
    description:
      "Short-term luxury rentals — estates, architectural icons, and resort-scale homes. Tell us what you need; we'll connect you with the right agent."
  },
  alternates: {
    canonical: "/rentals"
  }
};

export default function RentalsPage() {
  return (
    <article>
      {/* Hero — dark surface to match /agents visual tone. */}
      <section className="bg-ink text-paper">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <p className="text-xs uppercase tracking-widest text-accent">
            BallerCribs Rentals
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05] mt-3">
            Looking to rent a mega-mansion?
          </h1>
          <p className="mt-6 text-lg text-paper/75 max-w-2xl leading-relaxed">
            We connect you with the right agent for short-term luxury rentals —
            private estates, architectural icons, and resort-scale homes you
            won&apos;t find on Airbnb. Tell us what you need.
          </p>
        </div>
      </section>

      <section className="bg-ink text-paper">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-24">
          <RentalInquiryForm />
        </div>
      </section>

      {/* What happens next — small editorial beat matching /agents page
          rhythm. Sets expectations without overselling. */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
        <p className="text-xs uppercase tracking-widest text-black/50">
          What happens next
        </p>
        <h2 className="font-display text-2xl sm:text-3xl mt-3">
          You tell us where. We find the property.
        </h2>
        <p className="mt-4 text-black/70 leading-relaxed max-w-xl mx-auto">
          A member of the BallerCribs team reads every inquiry and connects
          you with a licensed agent or rental specialist in the right market.
          Expect a reply within 48 business hours with options that match your
          budget, headcount, and timing.
        </p>
      </section>
    </article>
  );
}
