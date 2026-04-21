"use client";

import { useState } from "react";

/**
 * Full-page newsletter form on /newsletter. Email-only — matches the inline
 * CTAs on homepage and listing pages so every signup surface submits the
 * same payload shape. If we ever want names again, Beehiiv workflows can
 * collect them post-confirmation without re-adding friction at signup.
 */
export function NewsletterForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

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
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "success") {
    return (
      <div className="text-center py-4">
        <h3 className="font-display text-2xl text-ink">You&apos;re in.</h3>
        <p className="text-sm text-black/70 mt-2">
          First issue drops this Sunday. Check your inbox for a welcome note.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" data-cta="newsletter-page">
      <div>
        <label htmlFor="newsletter-email" className="sr-only">
          Email
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="your@email.com"
          disabled={status === "submitting"}
          className="w-full border border-black/20 bg-white px-4 py-3 text-base focus:border-accent focus:outline-none disabled:opacity-60"
        />
      </div>
      {status === "error" && <p className="text-sm text-red-600">{errorMsg}</p>}
      <button
        type="submit"
        disabled={status === "submitting"}
        data-cta="newsletter-page"
        className="w-full bg-ink text-paper px-6 py-3 text-sm uppercase tracking-widest hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "submitting" ? "Subscribing..." : "Subscribe"}
      </button>
      <p className="text-[11px] text-black/50 text-center">Free forever. Unsubscribe anytime.</p>
    </form>
  );
}
