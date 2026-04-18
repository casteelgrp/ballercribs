import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Subscribe — BallerCribs",
  description: "The wildest luxury homes on the internet, delivered every Sunday. Free.",
  openGraph: {
    title: "BallerCribs Weekly",
    description: "The wildest luxury homes on the internet, delivered every Sunday. Free."
  }
};

export default function NewsletterPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
      <section className="text-center max-w-3xl mx-auto">
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight">
          The wildest homes on the internet,
          <br />
          <span className="text-accent">in your inbox every Sunday.</span>
        </h1>
        <p className="mt-6 text-lg text-black/70 max-w-2xl mx-auto">
          Mega-mansions, architectural icons, and estates you won't find on Zillow. Curated,
          delivered weekly, free.
        </p>
      </section>

      <section className="max-w-xl mx-auto mt-12 sm:mt-16">
        {/* Beacons mounts the form into this div by id. */}
        <div id="f2f955d1-9cde-4cfb-82e1-2234aff74674" />
        <Script id="beacons-newsletter-embed" strategy="afterInteractive">
          {`
            (function () {
              var s = document.createElement("script");
              var t = Math.floor(new Date().getTime() / 120000);
              s.type = "module";
              s.async = 1;
              s.src = "https://beacons.ai/embeds/emailForm.js?v=" + t + "&b=ballercribs&f=f2f955d1-9cde-4cfb-82e1-2234aff74674";
              document.body.appendChild(s);
            })();
          `}
        </Script>
      </section>

      <section className="mt-12 sm:mt-16 text-center">
        <p className="text-sm text-black/60">
          234,000+ Instagram followers · Featured listings from top agents · Tens of millions of
          monthly views
        </p>
      </section>
    </div>
  );
}
