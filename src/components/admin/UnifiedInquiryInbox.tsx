"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type {
  AgentInquiry,
  Inquiry,
  InquiryStatus,
  RentalInquiry
} from "@/lib/types";
import type { Payment } from "@/lib/payments/types";
import { formatRelativeShort } from "@/lib/format";
import { InquiryDetailPanel, type InquiryKind } from "./InquiryDetailPanel";

// ─── Row type (kind-discriminated) ────────────────────────────────────────

type BuyerInquiry = Inquiry & {
  listing_title: string | null;
  listing_slug: string | null;
};
type UnifiedBuyerRow = BuyerInquiry & { kind: "buyer" };
type UnifiedAgentRow = AgentInquiry & { kind: "agent" };
type UnifiedRentalRow = RentalInquiry & { kind: "rental" };
export type UnifiedInquiryRow =
  | UnifiedBuyerRow
  | UnifiedAgentRow
  | UnifiedRentalRow;

// ─── Filter types ─────────────────────────────────────────────────────────

export type TypeFilter = "all" | InquiryKind;
export type StatusFilter = "all" | InquiryStatus;
/**
 * Rental-only forwarding filter. "unforwarded" implicitly hides
 * non-rental rows since the forwarding concept doesn't apply to
 * buyer/agent inquiries — admin in queue mode wants the rentals.
 */
export type ForwardedFilter = "all" | "unforwarded";

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "buyer", label: "Buyer" },
  { value: "agent", label: "Agent" },
  { value: "rental", label: "Rental" }
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "working", label: "Working" },
  { value: "won", label: "Won" },
  { value: "dead", label: "Dead" }
];

const FORWARDED_OPTIONS: { value: ForwardedFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unforwarded", label: "Unforwarded only" }
];

// ─── Styling tokens ───────────────────────────────────────────────────────

// Type badges use distinct neutral tones — NOT the status palette, which is
// reserved for the pipeline.
const TYPE_BADGE: Record<InquiryKind, string> = {
  buyer: "bg-slate-100 text-slate-700",
  agent: "bg-indigo-100 text-indigo-700",
  rental: "bg-emerald-100 text-emerald-700"
};

const TYPE_LABEL: Record<InquiryKind, string> = {
  buyer: "Buyer",
  agent: "Agent",
  rental: "Rental"
};

const STATUS_BADGE: Record<InquiryStatus, string> = {
  new: "bg-accent/20 text-accent",
  working: "bg-blue-100 text-blue-800",
  won: "bg-green-100 text-green-800",
  dead: "bg-black/10 text-black/40"
};

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

// ─── Component ────────────────────────────────────────────────────────────

/**
 * Single-table inquiry inbox. Rows are the merged union of buyer + agent
 * inquiries (rentals added in a later commit). Filter pills are URL-driven
 * so selections are bookmarkable and survive reload; filtering happens on
 * the client against the already-fetched rows since volume is low
 * pre-launch. Click a row to expand an in-place detail panel — same
 * pattern as the old card layout, just embedded in a table.
 */
export function UnifiedInquiryInbox({
  rows,
  typeFilter,
  statusFilter,
  forwardedFilter = "all",
  partnerNameById = {},
  isOwner = false,
  paymentsByInquiry = { agent: {}, rental: {} }
}: {
  rows: UnifiedInquiryRow[];
  typeFilter: TypeFilter;
  statusFilter: StatusFilter;
  /** Defaults to "all" — page surfaces this from ?forwarded=… query param. */
  forwardedFilter?: ForwardedFilter;
  /** Resolves rental_inquiries.partner_id → partner.name for the column. */
  partnerNameById?: Record<string, string>;
  isOwner?: boolean;
  /** Pre-grouped per inquiry-type. Buyer payments aren't surfaced today —
   *  the buyer-lead payment flow isn't live yet. */
  paymentsByInquiry?: {
    agent?: Record<number, Payment[]>;
    rental?: Record<number, Payment[]>;
  };
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.kind !== typeFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      // Unforwarded filter is rental-scoped: hides every non-rental
      // row plus rental rows that already have a forwarded timestamp.
      // Spec: "implicitly scope to rental rows" — admin in queue mode
      // is working the rental backlog.
      if (forwardedFilter === "unforwarded") {
        if (r.kind !== "rental") return false;
        if (r.forwarded_to_partner_at !== null) return false;
      }
      return true;
    });
  }, [rows, typeFilter, statusFilter, forwardedFilter]);

  function updateFilter(key: "type" | "status" | "forwarded", value: string) {
    // Preserve any other query params; only mutate the one we clicked.
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="space-y-3 mb-6">
        <FilterPillRow
          label="Type"
          options={TYPE_OPTIONS}
          active={typeFilter}
          onSelect={(v) => updateFilter("type", v)}
        />
        <FilterPillRow
          label="Status"
          options={STATUS_OPTIONS}
          active={statusFilter}
          onSelect={(v) => updateFilter("status", v)}
        />
        <FilterPillRow
          label="Forward"
          options={FORWARDED_OPTIONS}
          active={forwardedFilter}
          onSelect={(v) => updateFilter("forwarded", v)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-black/50 text-sm py-8 text-center">
          {rows.length === 0
            ? "No inquiries yet."
            : "No inquiries match this filter."}
        </p>
      ) : (
        <div className="border border-black/10 bg-white overflow-hidden">
          {/* Desktop table */}
          <table className="w-full text-sm hidden sm:table">
            <thead className="bg-black/[0.02] text-xs uppercase tracking-widest text-black/50">
              <tr>
                <th className="text-left px-4 py-3 w-[88px]">Type</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Contact</th>
                <th className="text-left px-4 py-3 w-[120px]">Partner</th>
                <th className="text-left px-4 py-3 w-[108px]">Status</th>
                <th className="text-left px-4 py-3 w-[96px]">Received</th>
                <th className="text-left px-4 py-3 w-[120px]">Last contact</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const key = rowKey(row);
                const isOpen = expandedKey === key;
                return (
                  <DesktopRow
                    key={key}
                    row={row}
                    isOpen={isOpen}
                    onToggle={() => setExpandedKey(isOpen ? null : key)}
                    isOwner={isOwner}
                    payments={lookupPayments(row, paymentsByInquiry)}
                    partnerName={resolvePartnerName(row, partnerNameById)}
                  />
                );
              })}
            </tbody>
          </table>

          {/* Mobile: stacked "cards" that still support expand. No horizontal
              scroll, no squeezing the 6-column grid. */}
          <div className="sm:hidden divide-y divide-black/10">
            {filtered.map((row) => {
              const key = rowKey(row);
              const isOpen = expandedKey === key;
              return (
                <MobileRow
                  key={key}
                  row={row}
                  isOpen={isOpen}
                  onToggle={() => setExpandedKey(isOpen ? null : key)}
                  isOwner={isOwner}
                  payments={lookupPayments(row, paymentsByInquiry)}
                  partnerName={resolvePartnerName(row, partnerNameById)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Filter pill row ──────────────────────────────────────────────────────

function FilterPillRow<T extends string>({
  label,
  options,
  active,
  onSelect
}: {
  label: string;
  options: { value: T; label: string }[];
  active: T;
  onSelect: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-xs uppercase tracking-widest text-black/50 w-16 shrink-0">
        {label}
      </span>
      <div className="flex gap-1 flex-wrap">
        {options.map((opt) => {
          const on = opt.value === active;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelect(opt.value)}
              aria-pressed={on}
              className={
                "text-xs uppercase tracking-widest px-3 py-1.5 border transition-colors " +
                (on
                  ? "bg-ink text-paper border-ink"
                  : "bg-white text-black/60 border-black/20 hover:border-black/40")
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Row renderers ────────────────────────────────────────────────────────

function DesktopRow({
  row,
  isOpen,
  onToggle,
  isOwner,
  payments,
  partnerName
}: {
  row: UnifiedInquiryRow;
  isOpen: boolean;
  onToggle: () => void;
  isOwner: boolean;
  payments: Payment[];
  /** Resolved partner name for rentals with attribution; null otherwise. */
  partnerName: string | null;
}) {
  const borderCls = STATUS_BORDER[row.status];
  return (
    <>
      <tr
        onClick={onToggle}
        aria-expanded={isOpen}
        className={
          "cursor-pointer border-t border-black/10 hover:bg-black/[0.02] transition-colors border-l-4 " +
          borderCls
        }
      >
        <td className="px-4 py-3 align-top">
          <TypeBadge kind={row.kind} />
        </td>
        <td className="px-4 py-3 align-top font-medium">
          <span className="truncate inline-block max-w-[18ch]" title={row.name}>
            {row.name}
          </span>
        </td>
        <td className="px-4 py-3 align-top text-black/70">
          <span
            className="truncate inline-block max-w-[28ch] align-bottom"
            title={`${row.email}${row.phone ? " · " + row.phone : ""}`}
          >
            {row.email}
          </span>
        </td>
        <td className="px-4 py-3 align-top text-xs text-black/70">
          {partnerName ? (
            <span
              className="truncate inline-block max-w-[14ch]"
              title={partnerName}
            >
              {partnerName}
            </span>
          ) : (
            <span className="text-black/30" aria-label="No partner">
              —
            </span>
          )}
        </td>
        <td className="px-4 py-3 align-top">
          <StatusBadge status={row.status} />
        </td>
        <td className="px-4 py-3 align-top text-xs text-black/60 whitespace-nowrap">
          {formatRelativeShort(row.created_at)}
        </td>
        <td className="px-4 py-3 align-top text-xs text-black/60 whitespace-nowrap">
          {formatRelativeShort(row.last_contacted_at)}
        </td>
      </tr>
      {isOpen && (
        <tr className="border-t border-black/10">
          <td colSpan={7} className="p-0">
            <InquiryDetailPanel
              inquiry={row}
              kind={row.kind}
              isOwner={isOwner}
              payments={payments}
              partnerName={partnerName}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function MobileRow({
  row,
  isOpen,
  onToggle,
  isOwner,
  payments,
  partnerName
}: {
  row: UnifiedInquiryRow;
  isOpen: boolean;
  onToggle: () => void;
  isOwner: boolean;
  payments: Payment[];
  partnerName: string | null;
}) {
  return (
    <div className={"border-l-4 " + STATUS_BORDER[row.status]}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full text-left p-4 hover:bg-black/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <TypeBadge kind={row.kind} />
          <StatusBadge status={row.status} />
          <span className="text-xs text-black/50 ml-auto">
            {formatRelativeShort(row.created_at)}
          </span>
        </div>
        <p className="font-medium mt-2 truncate">{row.name}</p>
        <p className="text-xs text-black/60 truncate">{row.email}</p>
        {partnerName && (
          <p className="text-[11px] text-black/55 mt-1 truncate">
            Partner: <span className="text-black/75">{partnerName}</span>
          </p>
        )}
      </button>
      {isOpen && (
        <InquiryDetailPanel
          inquiry={row}
          kind={row.kind}
          isOwner={isOwner}
          payments={payments}
          partnerName={partnerName}
        />
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function rowKey(row: UnifiedInquiryRow): string {
  return `${row.kind}-${row.id}`;
}

function lookupPayments(
  row: UnifiedInquiryRow,
  byInquiry: {
    agent?: Record<number, Payment[]>;
    rental?: Record<number, Payment[]>;
  }
): Payment[] {
  if (row.kind === "agent") return byInquiry.agent?.[row.id] ?? [];
  if (row.kind === "rental") return byInquiry.rental?.[row.id] ?? [];
  return [];
}

/**
 * Partner name resolution for the Partner column. Only rental rows
 * with attribution have one — everything else (buyer/agent + organic
 * rentals where listing_id was null at submit) renders as em-dash.
 * Falls back to the partner_id literal if the name map doesn't have
 * an entry, so a deleted partner doesn't print a blank cell.
 */
function resolvePartnerName(
  row: UnifiedInquiryRow,
  byId: Record<string, string>
): string | null {
  if (row.kind !== "rental") return null;
  if (!row.partner_id) return null;
  return byId[row.partner_id] ?? row.partner_id;
}

function TypeBadge({ kind }: { kind: InquiryKind }) {
  return (
    <span
      className={
        "text-[10px] uppercase tracking-widest px-1.5 py-0.5 " + TYPE_BADGE[kind]
      }
    >
      {TYPE_LABEL[kind]}
    </span>
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

