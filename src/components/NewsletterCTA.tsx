"use client";

import { useState } from "react";
import Link from "next/link";
import { NewsletterSuccess } from "./NewsletterSuccess";

type Variant = "full" | "compact";
type Status = "idle" | "submitting" | "success" | "error";

/**
 * Context for the compact headline copy:
 *   - "item"    (default) — listings + rentals details. Prepends
 *                "Like this one? " referring to the property the reader
 *                is viewing.
 *   - "article" — blog post details. Omits the prefix since it reads
 *                awkwardly as "Like this article?".
 */
type CompactContext = "item" | "article";

/**
 * Contextual newsletter signup rendered inline on the homepage and detail
 * pages. The standalone /newsletter page keeps its own richer form
 * (name + email); these CTAs ask for email only so they disappear into the
 * editorial flow without adding friction.
 *
 * Variants:
 *  - 'full'    : homepage between-sections band (cream tint, full-width,
 *                centered headline + sub). Feels like a magazine section
 *                break, not a marketing pop-up.
 *  - 'compact' : detail-page conversion ask. Full-bleed dark band
 *                (bg-ink text-paper) that reads as a deliberate stop,
 *                not a thin strip. Pairs visually with the For Agents
 *                band + homepage Featured rentals as the site's
 *                dark-anchor rhythm.
 *
 * Both hit the existing /api/newsletter/subscribe endpoint. `data-cta`
 * attributes on the submit button + form let us wire up click tracking
 * later without hunting — 'newsletter-homepage' and 'newsletter-listing'.
 */
export function NewsletterCTA({
  variant,
  context = "item"
}: {
  variant: Variant;
  context?: CompactContext;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const dataCta = variant === "full" ? "newsletter-homepage" : "newsletter-listing";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim();
    if (!email) {
      setStatus("error");
      setErrorMsg("Email is required.");
      return;
    }

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong.");
      }
      setStatus("success");
    } catch {
      setStatus("error");
      // Keep the surfaced error generic — the Beehiiv endpoint already
      // returns a short message on real failures; fallback text points
      // users to the full page where they can retry with name + email.
      setErrorMsg("Something went wrong. Try again or visit /newsletter.");
    }
  }

  // ─── Success state — shared by both variants ─────────────────────────────
  //
  // Both variants render the same <NewsletterSuccess>; the `full`/`compact`
  // size controls typography scale and whether the thin accent divider
  // renders. Keeping it inside the shell so the cream-tint band stays
  // behind the success message on the homepage instead of stripping back
  // to the page background.
  if (status === "success") {
    const successBody = <NewsletterSuccess size={variant} />;
    return variant === "full" ? (
      <FullShell>{successBody}</FullShell>
    ) : (
      <CompactShell>{successBody}</CompactShell>
    );
  }

  // ─── Form body — shared input group, variant-aware classes ────────────────
  //
  // Light variant (full): cream-bg input, ink button. Dark variant (compact):
  // paper-bg input (still clearly reads "type here" on ink), accent-gold
  // button. Same JSX shape; only the color classes flip.
  const emailId = `newsletter-cta-${variant}-email`;
  const isCompact = variant === "compact";
  const inputClass = isCompact
    ? "flex-1 min-w-0 bg-paper text-ink placeholder-ink/40 border border-transparent px-4 py-3 text-base focus:border-accent focus:outline-none disabled:opacity-60"
    : "flex-1 min-w-0 border border-black/20 bg-white px-4 py-3 text-base focus:border-accent focus:outline-none disabled:opacity-60";
  const buttonClass = isCompact
    ? "bg-accent text-ink px-6 py-3 text-sm uppercase tracking-widest hover:bg-paper transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
    : "bg-ink text-paper px-6 py-3 text-sm uppercase tracking-widest hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

  const formInner = (
    <>
      <label htmlFor={emailId} className="sr-only">
        Email address
      </label>
      <input
        id={emailId}
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="your@email.com"
        disabled={status === "submitting"}
        className={inputClass}
      />
      <button
        type="submit"
        disabled={status === "submitting"}
        data-cta={dataCta}
        className={buttonClass}
      >
        {status === "submitting" ? "Subscribing…" : "Subscribe"}
      </button>
    </>
  );

  // Error text color tracks the band: red-300 reads cleanly on ink,
  // red-600 reads cleanly on the cream full-variant tint.
  const errorNode =
    status === "error" ? (
      <p
        className={
          "text-sm mt-2 " + (isCompact ? "text-red-300" : "text-red-600")
        }
      >
        {errorMsg.includes("/newsletter") ? (
          <>
            Something went wrong. Try again or visit{" "}
            <Link href="/newsletter" className="underline underline-offset-2 hover:text-accent">
              /newsletter
            </Link>
            .
          </>
        ) : (
          errorMsg
        )}
      </p>
    ) : null;

  if (variant === "full") {
    return (
      <FullShell>
        <div className="text-center max-w-xl mx-auto">
          <p className="text-xs uppercase tracking-widest text-black/50">BallerCribs Weekly</p>
          <h2 className="font-display text-3xl sm:text-4xl mt-3">Get the weekly drop.</h2>
          <p className="mt-3 text-black/70">
            The wildest luxury homes on the internet, delivered to your inbox. Free.
          </p>
          <form
            onSubmit={handleSubmit}
            data-cta={dataCta}
            className="mt-8 flex flex-col sm:flex-row gap-2 sm:gap-0 items-stretch max-w-md mx-auto"
          >
            {formInner}
          </form>
          {errorNode && <div className="max-w-md mx-auto">{errorNode}</div>}
          <p className="text-[11px] text-black/45 mt-4">Free forever. Unsubscribe anytime.</p>
        </div>
      </FullShell>
    );
  }

  // Compact — full-bleed dark band on detail pages. Headline copy flips
  // between "Like this one? …" (item context — listings, rentals) and the
  // plain version ("Like this article?" would read awkwardly on blog).
  const compactHeadline =
    context === "article"
      ? "Get the wildest luxury homes every week — free."
      : "Like this one? Get the wildest luxury homes every week — free.";

  return (
    <CompactShell>
      <p className="text-xs uppercase tracking-widest text-accent">
        BallerCribs Weekly
      </p>
      <h2 className="font-display text-3xl sm:text-4xl mt-3 text-paper">
        {compactHeadline}
      </h2>
      <form
        onSubmit={handleSubmit}
        data-cta={dataCta}
        className="mt-8 flex flex-col sm:flex-row gap-2 sm:gap-0 items-stretch max-w-md mx-auto"
      >
        {formInner}
      </form>
      {errorNode && <div className="max-w-md mx-auto">{errorNode}</div>}
      <p className="text-[11px] text-paper/55 mt-4">
        Free forever. Unsubscribe anytime.
      </p>
    </CompactShell>
  );
}

// ─── Shell layouts — kept local so the success + form paths share framing ──

function FullShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-black/[0.03] border-y border-black/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">{children}</div>
    </section>
  );
}

function CompactShell({ children }: { children: React.ReactNode }) {
  // Full-bleed dark band, matching For Agents + the homepage Featured
  // rentals section as the site's dark anchors. Callers must render
  // this OUTSIDE their article/reading column div so the ink stretches
  // edge-to-edge — if wrapped inside a max-w content column the band
  // degrades to a narrow strip and loses its visual weight.
  //
  // text-center cascades to the eyebrow, headline, success message,
  // and disclaimer; the form itself overrides centering via its own
  // flex layout.
  return (
    <section className="bg-ink text-paper">
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
        {children}
      </div>
    </section>
  );
}
