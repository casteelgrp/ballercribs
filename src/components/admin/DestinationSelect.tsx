"use client";

import type { Destination } from "@/lib/types";

/**
 * Shared destination dropdown for the listing + blog admin forms.
 *
 * Render contract:
 *   "— None —"  (always first; empty value)
 *   <destinations[]>  (caller-ordered; "(unpublished)" suffix when !published)
 *
 * Pinning is the caller's responsibility — same pattern the rental
 * partner dropdown uses in D9. The page that renders this component
 * fetches getPublishedDestinations() for the body of the list, then
 * prepends the existing row's destination via getDestinationById() if
 * it's a draft not already in the published set, so an edit can re-
 * save without dropping its tag.
 */
export function DestinationSelect({
  id,
  value,
  onChange,
  destinations,
  disabled = false,
  className = ""
}: {
  /** DOM id for the <select> — paired with an external <label htmlFor>. */
  id: string;
  /** Current destination_id as a string ("" = none). */
  value: string;
  onChange: (next: string) => void;
  destinations: Destination[];
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={className}
    >
      <option value="">— None —</option>
      {destinations.map((d) => (
        <option key={d.id} value={String(d.id)}>
          {d.name}
          {d.published ? "" : " (unpublished)"}
        </option>
      ))}
    </select>
  );
}
