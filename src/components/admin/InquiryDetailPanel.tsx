"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { InquiryActions } from "../InquiryActions";
import { PaymentsSection } from "./PaymentsSection";
import type {
  AgentInquiry,
  Inquiry,
  InquiryStatus
} from "@/lib/types";
import type { Payment } from "@/lib/payments/types";

// Local structural type — keeps client-component files free of the db-layer
// InquiryWithListing import that drags @vercel/postgres adjacent types.
type BuyerInquiry = Inquiry & {
  listing_title: string | null;
  listing_slug: string | null;
};

export type InquiryKind = "buyer" | "agent";
export type AnyInquiry = BuyerInquiry | AgentInquiry;

const STATUS_OPTIONS: InquiryStatus[] = ["new", "working", "won", "dead"];
const STATUS_LABEL: Record<InquiryStatus, string> = {
  new: "New",
  working: "Working",
  won: "Won",
  dead: "Dead"
};

function formatShort(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

/**
 * Detail panel rendered inside the expanded row of the unified inquiry
 * inbox. Owns its own optimistic state for status / notes / last-contact
 * so edits feel snappy without waiting on router.refresh. Reused across
 * buyer and agent kinds; rental kind is added in commit 2.
 */
export function InquiryDetailPanel({
  inquiry,
  kind,
  isOwner = false,
  payments = []
}: {
  inquiry: AnyInquiry;
  kind: InquiryKind;
  isOwner?: boolean;
  payments?: Payment[];
}) {
  const router = useRouter();

  const [status, setStatus] = useState<InquiryStatus>(inquiry.status);
  const [notes, setNotes] = useState<string>(inquiry.notes ?? "");
  const [lastContactedAt, setLastContactedAt] = useState<string | null>(
    inquiry.last_contacted_at
  );
  const [notesSaved, setNotesSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, setPending] = useState(false);

  const basePath =
    kind === "buyer"
      ? `/api/admin/inquiries/${inquiry.id}`
      : `/api/admin/agent-inquiries/${inquiry.id}`;

  type PatchResult = {
    ok: true;
    inquiry: { status?: InquiryStatus; notes?: string | null; last_contacted_at?: string | null };
  };

  async function patch(payload: Record<string, unknown>): Promise<PatchResult | null> {
    setPending(true);
    try {
      const res = await fetch(basePath, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(data?.error || "Update failed.");
        return null;
      }
      return data as PatchResult;
    } finally {
      setPending(false);
    }
  }

  async function changeStatus(next: InquiryStatus) {
    if (next === status) return;
    const prev = status;
    setStatus(next);
    const result = await patch({ status: next });
    if (!result) {
      setStatus(prev);
      return;
    }
    if (result.inquiry.last_contacted_at !== undefined) {
      setLastContactedAt(result.inquiry.last_contacted_at);
    }
    router.refresh();
  }

  async function saveNotes() {
    if ((notes ?? "") === (inquiry.notes ?? "")) return;
    const ok = await patch({ notes: notes.trim() || null });
    if (!ok) return;
    setNotesSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setNotesSaved(false), 2000);
  }

  async function markContactedNow() {
    const nowIso = new Date().toISOString();
    const prev = lastContactedAt;
    setLastContactedAt(nowIso);
    const ok = await patch({ last_contacted_at: "now" });
    if (!ok) {
      setLastContactedAt(prev);
      return;
    }
  }

  const buyer = kind === "buyer" ? (inquiry as BuyerInquiry) : null;
  const agent = kind === "agent" ? (inquiry as AgentInquiry) : null;

  return (
    <div className="border-l-4 border-transparent px-4 pb-5 pt-3 space-y-5 text-sm bg-black/[0.015]">
      {/* Source summary — the fields unique to each inquiry kind that were
          previously baked into the collapsed card header. Keeps the detail
          panel self-contained: everything you need to act on the inquiry
          sits here without hunting across the row. */}
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-widest text-black/50">Contact</p>
        <p>
          <a href={`mailto:${inquiry.email}`} className="text-accent hover:underline">
            {inquiry.email}
          </a>
          {inquiry.phone && <span className="text-black/60 ml-2">· {inquiry.phone}</span>}
        </p>

        {buyer?.listing_id && (
          <p className="text-black/70">
            Re:{" "}
            {buyer.listing_slug && buyer.listing_title ? (
              <Link
                href={`/listings/${buyer.listing_slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent underline underline-offset-2 hover:text-ink"
              >
                {buyer.listing_title}
              </Link>
            ) : (
              <>
                <span className="font-medium">
                  {buyer.listing_title ?? "Unknown listing"}
                </span>
                <span className="text-black/40 italic ml-2">
                  (listing no longer available)
                </span>
              </>
            )}
          </p>
        )}

        {agent && (agent.brokerage || agent.city_state) && (
          <p className="text-xs text-black/60">
            {agent.brokerage}
            {agent.brokerage && agent.city_state ? " · " : ""}
            {agent.city_state}
          </p>
        )}

        {buyer && (buyer.timeline || buyer.pre_approved) && (
          <div className="flex flex-wrap gap-2 pt-1 text-xs">
            {buyer.timeline && (
              <span className="bg-black/5 px-2 py-1">
                Timeline: {buyer.timeline.replace(/_/g, " ")}
              </span>
            )}
            {buyer.pre_approved && (
              <span className="bg-accent/20 text-accent px-2 py-1">Pre-approved</span>
            )}
          </div>
        )}

        {inquiry.message && (
          <p className="mt-2 text-black/80 whitespace-pre-wrap">{inquiry.message}</p>
        )}
      </div>

      <div>
        <p className="text-xs uppercase tracking-widest text-black/50 mb-2">Status</p>
        <div className="flex rounded border border-black/20 overflow-hidden w-fit">
          {STATUS_OPTIONS.map((opt) => {
            const active = opt === status;
            return (
              <button
                key={opt}
                type="button"
                disabled={pending}
                onClick={() => changeStatus(opt)}
                className={
                  "px-3 py-1.5 text-xs uppercase tracking-widest border-r border-black/20 last:border-r-0 transition-colors " +
                  (active
                    ? "bg-ink text-paper"
                    : "bg-white text-black/60 hover:bg-black/5")
                }
                aria-pressed={active}
              >
                {STATUS_LABEL[opt]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label
          className="text-xs uppercase tracking-widest text-black/50 mb-2 block"
          htmlFor={`notes-${kind}-${inquiry.id}`}
        >
          Notes
          {notesSaved && (
            <span className="ml-2 text-green-700 normal-case tracking-normal text-[11px]">
              saved
            </span>
          )}
        </label>
        <textarea
          id={`notes-${kind}-${inquiry.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          rows={4}
          placeholder="Internal notes — call log, deal context, next steps…"
          className="w-full border border-black/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>

      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-black/50 mb-1">
            Last contacted
          </p>
          <p className="text-black/70">
            {lastContactedAt ? formatShort(lastContactedAt) : "Not yet contacted"}
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={markContactedNow}
          className="text-xs uppercase tracking-widest border border-black/20 px-3 py-1.5 hover:border-accent hover:text-accent disabled:opacity-40 transition-colors"
        >
          Log contact
        </button>
      </div>

      {kind === "agent" && (
        <PaymentsSection
          inquiryId={inquiry.id}
          inquiryName={inquiry.name}
          payments={payments}
          canGenerate={isOwner && status === "working"}
          canMarkPaid={isOwner}
          defaultDescription={
            agent?.brokerage
              ? `BallerCribs feature — ${agent.brokerage}`
              : `BallerCribs feature — ${inquiry.name}`
          }
        />
      )}

      <div className="flex items-baseline justify-between gap-4 flex-wrap pt-2 border-t border-black/10">
        <p className="text-xs text-black/40">
          Status changed to {STATUS_LABEL[inquiry.status].toLowerCase()}{" "}
          {inquiry.status_updated_by_name
            ? `by ${inquiry.status_updated_by_name} `
            : ""}
          on {new Date(inquiry.status_updated_at).toLocaleString()}
        </p>
        {/* Archive / delete actions stay here — the row summary doesn't
            expose destructive actions, you have to open the row first. */}
        <InquiryActions
          id={inquiry.id}
          kind={kind}
          archived={Boolean(inquiry.archived_at)}
        />
      </div>
    </div>
  );
}
