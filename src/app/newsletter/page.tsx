import type { Metadata } from "next";
import { NewsletterForm } from "@/components/NewsletterForm";

export const metadata: Metadata = {
  // Absolute title — bypasses the `%s | BallerCribs` template since the
  // headline already contains the brand ("Newsletter — BallerCribs Weekly").
  title: { absolute: "Newsletter — BallerCribs Weekly" },
  description: "The wildest luxury homes on the internet, delivered weekly. Free.",
  openGraph: {
    title: "Newsletter — BallerCribs Weekly",
    description: "The wildest luxury homes on the internet, delivered weekly. Free."
  },
  alternates: {
    canonical: "/newsletter"
  }
};

export default function NewsletterPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
      <section className="text-center max-w-3xl mx-auto">
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight">
          The wildest homes on the internet,{" "}
          <span className="text-accent">in your inbox every Sunday.</span>
        </h1>
        <p className="mt-6 text-lg text-black/70 max-w-2xl mx-auto">
          Mega-mansions, architectural icons, and estates you won't find on Zillow. Curated,
          delivered weekly, free.
        </p>
      </section>

      <section className="mt-12 sm:mt-16">
        <div className="max-w-md mx-auto">
          <NewsletterForm />
        </div>
      </section>

      <section className="mt-16 sm:mt-20 text-center">
        <p className="text-sm text-black/60">
          234K Instagram · 72K Facebook · Tens of millions of monthly views
        </p>
      </section>
    </div>
  );
}
