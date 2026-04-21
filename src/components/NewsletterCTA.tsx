"use client";

import { useState } from "react";
import Link from "next/link";
import { NewsletterSuccess } from "./NewsletterSuccess";

type Variant = "full" | "compact";
type Status = "idle" | "submitting" | "success" | "error";

/**
 * Contextual newsletter signup rendered inline on the homepage and listing
 * detail pages. The standalone /newsletter page keeps its own richer form
 * (name + email); these CTAs ask for email only so they disappear into the
 * editorial flow without adding friction.
 *
 * Variants:
 *  - 'full'    : homepage between-sections band (cream tint, full-width,
 *                centered headline + sub). Feels like a magazine section
 *                break, not a marketing pop-up.
 *  - 'compact' : listing detail post-content prompt. Narrow, thin top
 *                divider, single-line copy.
 *
 * Both hit the existing /api/newsletter/subscribe endpoint. `data-cta`
 * attributes on the submit button + form let us wire up click tracking
 * later without hunting — 'newsletter-homepage' and 'newsletter-listing'.
 */
export function NewsletterCTA({ variant }: { variant: Variant }) {
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

  // ─── Form body — shared input group, variant-specific layout wrapper ─────
  const emailId = `newsletter-cta-${variant}-email`;
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
        className="flex-1 min-w-0 border border-black/20 bg-white px-4 py-3 text-base focus:border-accent focus:outline-none disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={status === "submitting"}
        data-cta={dataCta}
        className="bg-ink text-paper px-6 py-3 text-sm uppercase tracking-widest hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {status === "submitting" ? "Subscribing…" : "Subscribe"}
      </button>
    </>
  );

  const errorNode =
    status === "error" ? (
      <p className="text-sm text-red-600 mt-2">
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

  // Compact (listing detail page)
  return (
    <CompactShell>
      <p className="text-sm text-black/70 mb-3">
        Like this one? Get the wildest luxury homes every week — free.
      </p>
      <form
        onSubmit={handleSubmit}
        data-cta={dataCta}
        className="flex flex-col sm:flex-row gap-2 sm:gap-0 items-stretch"
      >
        {formInner}
      </form>
      {errorNode}
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
  // Spans the article width at every breakpoint; the form itself caps at
  // max-w-md so the input+button row doesn't stretch to absurd widths on
  // wide desktops while the surrounding copy still reads as full-width.
  return (
    <div className="pt-8 border-t border-black/10">
      <div className="max-w-xl">{children}</div>
    </div>
  );
}
