"use client";

import { useState } from "react";
import { InquiryCard } from "./InquiryCard";
import type { AgentInquiry, Inquiry } from "@/lib/types";

type BuyerInquiry = Inquiry & {
  listing_title: string | null;
  listing_slug: string | null;
};

/**
 * Owns the "only one expanded at a time" state for a set of inquiry cards.
 * Passing each card its own `expanded` + `onToggle` keeps the InquiryCard
 * component stateless about its siblings.
 */
export function InquiryList({
  inquiries,
  kind
}: {
  inquiries: (BuyerInquiry | AgentInquiry)[];
  kind: "buyer" | "agent";
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="border border-black/10 bg-white divide-y divide-black/10">
      {inquiries.map((inq) => (
        <InquiryCard
          key={inq.id}
          inquiry={inq}
          kind={kind}
          expanded={expandedId === inq.id}
          onToggle={() => setExpandedId((cur) => (cur === inq.id ? null : inq.id))}
        />
      ))}
    </div>
  );
}
