"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { InquiryActions } from "./InquiryActions";
import type {
  AgentInquiry,
  InquiryStatus,
  Inquiry
} from "@/lib/types";

// InquiryWithListing (from db.ts) extends Inquiry with listing_title/slug.
// Importing the concrete interface would pull in @vercel/postgres-adjacent
// types into a client component; the structural type is all we need.
type BuyerInquiry = Inquiry & {
  listing_title: string | null;
  listing_slug: string | null;
};

type Kind = "buyer" | "agent";

const STATUS_BADGE: Record<InquiryStatus, string> = {
  new: "bg-accent/20 text-accent",
  working: "bg-blue-100 text-blue-800",
  won: "bg-green-100 text-green-800",
  dead: "bg-black/10 text-black/40"
};

// Left border accent so you can scan the pipeline vertically without reading
// every badge. Matching the pill colors.
const STATUS_BORDER: Record<InquiryStatus, string> = {
  new: "border-l-accent",
  working: "border-l-blue-400",
  won: "border-l-green-500",
  dead: "border-l-black/20"
};

const STATUS_LABEL: Record<InquiryStatus, string> = {
  new: "New",
  working: "Working",
  won: "Won",
  dead: "Dead"
};

const STATUS_OPTIONS: InquiryStatus[] = ["new", "working", "won", "dead"];

// Canonical tier values the Square flow will write. Anything unexpected just
// renders the raw value uppercase so we can still see weird data in admin.
const TIER_LABEL: Record<string, string> = {
  "1500": "$1.5K",
  "3750": "$3.75K",
  "5000": "$5K",
  custom: "CUSTOM"
};

function tierLabel(tier: string | null): string | null {
  if (!tier) return null;
  return TIER_LABEL[tier] ?? tier.toUpperCase();
}

function formatShort(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function InquiryCard({
  inquiry,
  kind,
  expanded,
  onToggle
}: {
  inquiry: BuyerInquiry | AgentInquiry;
  kind: Kind;
  expanded: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();

  // Optimistic local state so the badge + notes + last-contacted line update
  // instantly; server is still authoritative via router.refresh on the next
  // tick. If the PATCH fails we roll back and show an alert.
  const [status, setStatus] = useState<InquiryStatus>(inquiry.status);
  const [notes, setNotes] = useState<string>(inquiry.notes ?? "");
  const [lastContactedAt, setLastContactedAt] = useState<string | null>(
    inquiry.last_contacted_at
  );
  const [notesSaved, setNotesSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, setPending] = useState(false);

  const basePath =
    kind === "buyer" ? `/api/admin/inquiries/${inquiry.id}` : `/api/admin/agent-inquiries/${inquiry.id}`;

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
    setStatus(next); // optimistic
    const result = await patch({ status: next });
    if (!result) {
      setStatus(prev);
      return;
    }
    // Server auto-stamps last_contacted_at on first move to 'working'. Pick
    // up whatever the server returned so the "Last contacted" line updates
    // without waiting for the router.refresh round-trip.
    if (result.inquiry.last_contacted_at !== undefined) {
      setLastContactedAt(result.inquiry.last_contacted_at);
    }
    // Refresh so the server-rendered status-history line and any future
    // status-derived counts catch up.
    router.refresh();
  }

  async function saveNotes() {
    if ((notes ?? "") === (inquiry.notes ?? "")) return;
    const ok = await patch({ notes: notes.trim() || null });
    if (!ok) return;
    setNotesSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setNotesSaved(false), 2000);
    // Don't router.refresh here — notes don't affect any other surface, and
    // the in-place saved flash is cheaper than a full page re-render.
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

  // Keyboard accessibility for the click-to-toggle card body. Enter/Space
  // matches native button behavior; interactive descendants call
  // stopPropagation on their own clicks so the card doesn't collapse/expand
  // when users click email links, action buttons, or the expanded form.
  function onCardKeyDown(e: React.KeyboardEvent) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  }

  const buyer = kind === "buyer" ? (inquiry as BuyerInquiry) : null;
  const agent = kind === "agent" ? (inquiry as AgentInquiry) : null;

  const agentTypeBadge =
    agent?.inquiry_type === "featured"
      ? "bg-accent/20 text-accent"
      : agent?.inquiry_type === "referral"
        ? "bg-green-100 text-green-800"
        : "bg-black/10 text-black/70";

  const tier = agent ? tierLabel(agent.tier) : null;

  return (
    <article className={"relative border-l-4 " + STATUS_BORDER[status]}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={onCardKeyDown}
        className="p-4 cursor-pointer hover:bg-black/[0.02] transition-colors focus:outline-none focus-visible:bg-black/[0.03]"
      >
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <p className="font-medium truncate">{inquiry.name}</p>
            <StatusBadge status={status} />
            {agent && (
              <span
                className={
                  "text-[10px] uppercase tracking-widest px-1.5 py-0.5 " + agentTypeBadge
                }
              >
                {agent.inquiry_type}
              </span>
            )}
            {tier && (
              <span className="text-[10px] uppercase tracking-widest border border-black/20 text-black/60 px-1.5 py-0.5">
                {tier}
              </span>
            )}
            {inquiry.archived_at && (
              <span className="text-[10px] uppercase tracking-widest bg-black/5 text-black/50 px-1.5 py-0.5">
                Archived {new Date(inquiry.archived_at).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <p className="text-xs text-black/50">
              {new Date(inquiry.created_at).toLocaleString()}
            </p>
            <div onClick={(e) => e.stopPropagation()}>
              <InquiryActions
                id={inquiry.id}
                kind={kind}
                archived={Boolean(inquiry.archived_at)}
              />
            </div>
          </div>
        </div>

        {/* Email + phone — clickable, must not toggle the card */}
        <p className="text-sm mt-1" onClick={(e) => e.stopPropagation()}>
          <a href={`mailto:${inquiry.email}`} className="text-accent hover:underline">
            {inquiry.email}
          </a>
          {inquiry.phone && <span className="text-black/60 ml-2">· {inquiry.phone}</span>}
        </p>

        {buyer?.listing_id && (
          <p
            className="text-sm text-black/70 mt-2"
            onClick={(e) => e.stopPropagation()}
          >
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
          <p className="text-xs text-black/60 mt-1">
            {agent.brokerage}
            {agent.brokerage && agent.city_state ? " · " : ""}
            {agent.city_state}
          </p>
        )}

        {buyer && (
          <div className="flex flex-wrap gap-2 mt-2 text-xs">
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
          <p className="text-sm text-black/80 mt-3 whitespace-pre-wrap">
            {inquiry.message}
          </p>
        )}
      </div>

      {/* Expanded pipeline controls. `grid-template-rows` 0fr/1fr trick gives
          a smooth height-animated reveal without needing to measure content. */}
      <div
        className={
          "grid transition-[grid-template-rows] duration-150 ease-out " +
          (expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")
        }
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-4 border-t border-black/10 space-y-5 text-sm">
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
                      onClick={(e) => {
                        e.stopPropagation();
                        changeStatus(opt);
                      }}
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
                onClick={(e) => e.stopPropagation()}
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
                  {lastContactedAt
                    ? `${formatShort(lastContactedAt)}`
                    : "Not yet contacted"}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={(e) => {
                  e.stopPropagation();
                  markContactedNow();
                }}
                className="text-xs uppercase tracking-widest border border-black/20 px-3 py-1.5 hover:border-accent hover:text-accent disabled:opacity-40 transition-colors"
              >
                Mark contacted now
              </button>
            </div>

            <p className="text-xs text-black/40">
              Status changed to {STATUS_LABEL[inquiry.status].toLowerCase()}{" "}
              {inquiry.status_updated_by_name
                ? `by ${inquiry.status_updated_by_name} `
                : ""}
              on {new Date(inquiry.status_updated_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: InquiryStatus }) {
  return (
    <span
      className={
        "text-[10px] uppercase tracking-widest px-1.5 py-0.5 " + STATUS_BADGE[status]
      }
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
