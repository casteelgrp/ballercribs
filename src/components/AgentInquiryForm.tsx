"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AgentInquiryType } from "@/lib/types";

type Status = "idle" | "submitting" | "success" | "error";

export function AgentInquiryForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [inquiryType, setInquiryType] = useState<AgentInquiryType>("featured");

  // Pre-select via URL: /agents?type=referral#inquire. useSearchParams reads
  // the current params — once they're available we sync the radio group.
  const params = useSearchParams();
  useEffect(() => {
    const t = params.get("type");
    if (t === "referral" || t === "other" || t === "featured") {
      setInquiryType(t);
    }
  }, [params]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      brokerage: String(fd.get("brokerage") || "").trim(),
      city_state: String(fd.get("city_state") || "").trim(),
      inquiry_type: inquiryType,
      message: String(fd.get("message") || "").trim(),
      // Honeypot — must be empty for real submits.
      website: String(fd.get("website") || "")
    };

    try {
      const res = await fetch("/api/agents/inquire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
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
      <div className="border border-accent/60 bg-accent/5 px-8 py-10 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 border border-accent rounded-full mb-4">
          <svg
            className="w-6 h-6 text-accent"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="font-display text-3xl text-paper">Got it.</h3>
        <p className="text-paper/70 mt-3 max-w-md mx-auto">
          We'll be back to you within 24 hours. Check the inbox you used for the reply.
        </p>
      </div>
    );
  }

  // Styling helpers — this form lives on a dark (bg-ink) section.
  const inputClass =
    "w-full bg-transparent border border-paper/25 text-paper placeholder-paper/40 px-4 py-3 text-base focus:border-accent focus:outline-none disabled:opacity-50";
  const labelClass = "block text-xs uppercase tracking-widest text-paper/60 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot — positioned off-screen, hidden from users and assistive tech
          via aria-hidden + tabIndex=-1. Bots still see it in the DOM and fill it. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          top: "auto",
          width: "1px",
          height: "1px",
          overflow: "hidden"
        }}
      >
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="ai-name" className={labelClass}>
            Name *
          </label>
          <input
            id="ai-name"
            name="name"
            type="text"
            required
            autoComplete="name"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="ai-email" className={labelClass}>
            Email *
          </label>
          <input
            id="ai-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="ai-phone" className={labelClass}>
            Phone
          </label>
          <input
            id="ai-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="ai-brokerage" className={labelClass}>
            Brokerage
          </label>
          <input
            id="ai-brokerage"
            name="brokerage"
            type="text"
            autoComplete="organization"
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="ai-city" className={labelClass}>
            City / State *
          </label>
          <input
            id="ai-city"
            name="city_state"
            type="text"
            required
            placeholder="e.g. Beverly Hills, CA"
            className={inputClass}
          />
        </div>
      </div>

      <fieldset>
        <legend className={labelClass}>Inquiry type</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-1">
          {(
            [
              { value: "featured" as const, label: "Featured listing" },
              { value: "referral" as const, label: "Referral partnership" },
              { value: "other" as const, label: "Something else" }
            ]
          ).map((opt) => (
            <label key={opt.value} className="inline-flex items-center gap-2 cursor-pointer text-paper">
              <input
                type="radio"
                name="inquiry_type"
                value={opt.value}
                checked={inquiryType === opt.value}
                onChange={() => setInquiryType(opt.value)}
                className="accent-accent"
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="ai-message" className={labelClass}>
          Property details / message
        </label>
        <textarea
          id="ai-message"
          name="message"
          rows={5}
          placeholder="Address, price, what makes it special, or details about your market"
          className={inputClass}
        />
      </div>

      {status === "error" && <p className="text-sm text-red-300">{errorMsg}</p>}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full sm:w-auto bg-accent text-ink px-8 py-3 text-sm uppercase tracking-widest hover:bg-paper transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "submitting" ? "Sending..." : "Send inquiry"}
      </button>
      <p className="text-xs text-paper/50">
        We respond within 24 hours on business days.
      </p>
    </form>
  );
}
