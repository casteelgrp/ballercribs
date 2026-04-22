"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { AgentInquiry, Inquiry, InquiryStatus } from "@/lib/types";
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
export type UnifiedInquiryRow = UnifiedBuyerRow | UnifiedAgentRow;

// ─── Filter types ─────────────────────────────────────────────────────────

export type TypeFilter = "all" | InquiryKind;
export type StatusFilter = "all" | InquiryStatus;

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "buyer", label: "Buyer" },
  { value: "agent", label: "Agent" }
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "working", label: "Working" },
  { value: "won", label: "Won" },
  { value: "dead", label: "Dead" }
];

// ─── Styling tokens ───────────────────────────────────────────────────────

// Type badges use distinct neutral tones — NOT the status palette, which is
// reserved for the pipeline. Emerald slot is reserved for rentals (commit 2).
const TYPE_BADGE: Record<InquiryKind, string> = {
  buyer: "bg-slate-100 text-slate-700",
  agent: "bg-indigo-100 text-indigo-700"
};

const TYPE_LABEL: Record<InquiryKind, string> = {
  buyer: "Buyer",
  agent: "Agent"
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
  isOwner = false,
  paymentsByAgentInquiry = {}
}: {
  rows: UnifiedInquiryRow[];
  typeFilter: TypeFilter;
  statusFilter: StatusFilter;
  isOwner?: boolean;
  paymentsByAgentInquiry?: Record<number, Payment[]>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.kind !== typeFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, typeFilter, statusFilter]);

  function updateFilter(key: "type" | "status", value: string) {
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
                    payments={
                      row.kind === "agent"
                        ? paymentsByAgentInquiry[row.id] ?? []
                        : []
                    }
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
                  payments={
                    row.kind === "agent"
                      ? paymentsByAgentInquiry[row.id] ?? []
                      : []
                  }
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
  payments
}: {
  row: UnifiedInquiryRow;
  isOpen: boolean;
  onToggle: () => void;
  isOwner: boolean;
  payments: Payment[];
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
          <td colSpan={6} className="p-0">
            <InquiryDetailPanel
              inquiry={row}
              kind={row.kind}
              isOwner={isOwner}
              payments={payments}
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
  payments
}: {
  row: UnifiedInquiryRow;
  isOpen: boolean;
  onToggle: () => void;
  isOwner: boolean;
  payments: Payment[];
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
      </button>
      {isOpen && (
        <InquiryDetailPanel
          inquiry={row}
          kind={row.kind}
          isOwner={isOwner}
          payments={payments}
        />
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function rowKey(row: UnifiedInquiryRow): string {
  return `${row.kind}-${row.id}`;
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

