"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";
type TermPreference = "short_term" | "long_term" | "not_sure";

const BUDGET_OPTIONS = [
  { value: "under_25k", label: "Under $25K total" },
  { value: "25k_50k", label: "$25K–$50K" },
  { value: "50k_100k", label: "$50K–$100K" },
  { value: "100k_plus", label: "$100K+" },
  { value: "flexible", label: "Flexible" }
] as const;

const TERM_OPTIONS: { value: TermPreference; label: string; sub: string }[] = [
  { value: "short_term", label: "Short-term", sub: "Days or weeks" },
  { value: "long_term", label: "Long-term", sub: "Months or longer" },
  { value: "not_sure", label: "Not sure", sub: "Help me figure it out" }
];

/**
 * Public rental inquiry form on /rentals. Mirrors the submit-and-inline-
 * success pattern from AgentInquiryForm (honeypot, single-page success
 * swap, dark-surface styling). Email-only contact required, dates
 * optional with a "flexible" checkbox that collapses the pickers.
 *
 * When the form is landed on from a specific rental listing, the server
 * page passes destinationInitial + listing_id + listing_slug so the
 * inquiry record knows which property triggered it and the admin inbox
 * can render a backlink. termPreferenceInitial auto-selects the matching
 * term radio so someone inquiring from a Short-term rental detail page
 * doesn't have to pick it manually.
 */
export function RentalInquiryForm({
  destinationInitial = "",
  listingId = null,
  listingSlug = null,
  termPreferenceInitial = null
}: {
  destinationInitial?: string;
  listingId?: number | null;
  listingSlug?: string | null;
  termPreferenceInitial?: TermPreference | null;
} = {}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [flexibleDates, setFlexibleDates] = useState(false);
  const [destination, setDestination] = useState(destinationInitial);
  const [termPreference, setTermPreference] = useState<TermPreference | null>(
    termPreferenceInitial
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    if (termPreference === null) {
      setStatus("error");
      setErrorMsg("Please choose short-term, long-term, or not sure.");
      return;
    }

    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      destination: String(fd.get("destination") || "").trim(),
      listing_id: listingId,
      listing_slug: listingSlug,
      rental_term_preference: termPreference,
      start_date: flexibleDates ? "" : String(fd.get("start_date") || ""),
      end_date: flexibleDates ? "" : String(fd.get("end_date") || ""),
      flexible_dates: flexibleDates,
      group_size: String(fd.get("group_size") || "").trim(),
      budget_range: String(fd.get("budget_range") || "").trim(),
      occasion: String(fd.get("occasion") || "").trim(),
      message: String(fd.get("message") || "").trim(),
      // Honeypot — must be empty for real submits.
      website: String(fd.get("website") || "")
    };

    try {
      const res = await fetch("/api/rental-inquiries", {
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
        <h3 className="font-display italic text-4xl sm:text-5xl text-paper leading-tight">
          Thanks — we&apos;ve got it.
        </h3>
        <p className="text-paper/70 mt-4 max-w-md mx-auto leading-relaxed">
          Jay will be in touch within 48 hours with options. Watch your inbox.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full bg-transparent border border-paper/25 text-paper placeholder-paper/40 px-4 py-3 text-base focus:border-accent focus:outline-none disabled:opacity-50";
  const labelClass = "block text-xs uppercase tracking-widest text-paper/60 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot — positioned off-screen, hidden from users and assistive tech. */}
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
          <label htmlFor="rn-name" className={labelClass}>
            Name *
          </label>
          <input
            id="rn-name"
            name="name"
            type="text"
            required
            autoComplete="name"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="rn-email" className={labelClass}>
            Email *
          </label>
          <input
            id="rn-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="rn-phone" className={labelClass}>
            Phone
          </label>
          <input
            id="rn-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="rn-group" className={labelClass}>
            How many guests? *
          </label>
          <input
            id="rn-group"
            name="group_size"
            type="number"
            min={1}
            required
            className={inputClass}
            placeholder="e.g. 12"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="rn-destination" className={labelClass}>
            Where do you want to stay? *
          </label>
          <input
            id="rn-destination"
            name="destination"
            type="text"
            required
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Aspen · Lake Como · anywhere in the Caribbean"
            className={inputClass}
          />
        </div>
      </div>

      <fieldset>
        <legend className={labelClass}>Rental term *</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
          {TERM_OPTIONS.map((opt) => {
            const active = termPreference === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTermPreference(opt.value)}
                className={
                  "text-left px-4 py-3 border transition-colors " +
                  (active
                    ? "bg-paper text-ink border-accent"
                    : "bg-transparent text-paper border-paper/25 hover:border-paper/50")
                }
              >
                <span className="block text-sm font-medium uppercase tracking-wider">
                  {opt.label}
                </span>
                <span
                  className={
                    "block text-xs mt-1 " +
                    (active ? "text-ink/60" : "text-paper/55")
                  }
                >
                  {opt.sub}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label className={labelClass}>Dates</label>
        <label className="inline-flex items-center gap-2 text-paper text-sm cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={flexibleDates}
            onChange={(e) => setFlexibleDates(e.target.checked)}
            className="accent-accent"
          />
          <span>My dates are flexible</span>
        </label>
        {!flexibleDates && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rn-start" className={labelClass}>
                Start
              </label>
              <input
                id="rn-start"
                name="start_date"
                type="date"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="rn-end" className={labelClass}>
                End
              </label>
              <input
                id="rn-end"
                name="end_date"
                type="date"
                className={inputClass}
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="rn-budget" className={labelClass}>
            Budget *
          </label>
          <select
            id="rn-budget"
            name="budget_range"
            required
            defaultValue=""
            // Browsers ignore most styling on <option>, but `background`
            // and `color` do land in Chrome, Safari, and Firefox. Without
            // this, options inherit the dark parent styling and read as
            // near-invisible light-on-light until hover.
            className={inputClass + " [&>option]:bg-paper [&>option]:text-ink"}
          >
            <option value="" disabled>
              Select a range
            </option>
            {BUDGET_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-paper/55 mt-1">
            Total budget for your stay (not per month).
          </p>
        </div>
        <div>
          <label htmlFor="rn-occasion" className={labelClass}>
            Occasion (optional)
          </label>
          <input
            id="rn-occasion"
            name="occasion"
            type="text"
            placeholder="Wedding · reunion · birthday · retreat"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="rn-message" className={labelClass}>
          Anything else we should know?
        </label>
        <textarea
          id="rn-message"
          name="message"
          rows={4}
          placeholder="Must-have amenities, specific properties you've seen, flex on dates/group, etc."
          className={inputClass}
        />
      </div>

      {status === "error" && <p className="text-sm text-red-300">{errorMsg}</p>}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full sm:w-auto bg-accent text-ink px-8 py-3 text-sm uppercase tracking-widest hover:bg-paper transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "submitting" ? "Sending..." : "Request a rental"}
      </button>
      <p className="text-xs text-paper/50">
        We respond within 48 hours on business days.
      </p>
    </form>
  );
}
