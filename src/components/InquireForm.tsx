"use client";

import { useState } from "react";

interface Props {
  listingId: number;
  listingTitle: string;
}

export function InquireForm({ listingId, listingTitle }: Props) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const form = e.currentTarget;
    const formData = new FormData(form);
    const payload = {
      listing_id: listingId,
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      phone: String(formData.get("phone") || "").trim() || null,
      message: String(formData.get("message") || "").trim() || null,
      timeline: String(formData.get("timeline") || "").trim() || null,
      pre_approved: formData.get("pre_approved") === "on"
    };

    if (!payload.name || !payload.email) {
      setStatus("error");
      setErrorMsg("Name and email are required.");
      return;
    }

    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong.");
      }
      setStatus("success");
      form.reset();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "success") {
    return (
      <div className="border border-accent bg-accent/5 p-6">
        <h3 className="font-display text-xl">Thanks — we've got it.</h3>
        <p className="text-sm text-black/70 mt-2">
          We'll connect you with the listing agent for <strong>{listingTitle}</strong> shortly.
          Keep an eye on your inbox.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs uppercase tracking-widest text-black/60 mb-1">
          Name *
        </label>
        <input
          name="name"
          type="text"
          required
          className="w-full border border-black/20 bg-white px-3 py-2 focus:border-accent focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-widest text-black/60 mb-1">
          Email *
        </label>
        <input
          name="email"
          type="email"
          required
          className="w-full border border-black/20 bg-white px-3 py-2 focus:border-accent focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-widest text-black/60 mb-1">
          Phone
        </label>
        <input
          name="phone"
          type="tel"
          className="w-full border border-black/20 bg-white px-3 py-2 focus:border-accent focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-widest text-black/60 mb-1">
          Timeline
        </label>
        <select
          name="timeline"
          className="w-full border border-black/20 bg-white px-3 py-2 focus:border-accent focus:outline-none"
          defaultValue=""
        >
          <option value="">Select...</option>
          <option value="ready_now">Ready to buy now</option>
          <option value="3_months">Within 3 months</option>
          <option value="6_months">Within 6 months</option>
          <option value="just_looking">Just looking</option>
        </select>
      </div>
      <div>
        <label className="block text-xs uppercase tracking-widest text-black/60 mb-1">
          Message
        </label>
        <textarea
          name="message"
          rows={4}
          placeholder="Tell us what you're looking for..."
          className="w-full border border-black/20 bg-white px-3 py-2 focus:border-accent focus:outline-none resize-none"
        />
      </div>
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input
          name="pre_approved"
          type="checkbox"
          className="mt-1 accent-accent"
        />
        <span className="text-black/70">
          I'm pre-approved or have proof of funds ready.
        </span>
      </label>

      {status === "error" && (
        <p className="text-sm text-red-600">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full bg-ink text-paper px-6 py-3 text-sm uppercase tracking-widest hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "submitting" ? "Sending..." : "Inquire now"}
      </button>
      <p className="text-[11px] text-black/50 text-center">
        We'll share your info with the listing agent only.
      </p>
    </form>
  );
}
