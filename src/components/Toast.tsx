"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Variant = "success" | "info" | "warning";

const VARIANT_STYLES: Record<Variant, string> = {
  success: "border-green-300 bg-green-50 text-green-900",
  info: "border-black/20 bg-black/5 text-black/80",
  warning: "border-amber-300 bg-amber-50 text-amber-900"
};

/**
 * Shows a one-shot banner driven by a search-param toast key. On dismiss
 * (or auto-fade after 6s) the toast param is stripped from the URL via
 * router.replace so a refresh doesn't re-show it.
 */
export function Toast({
  message,
  variant = "success"
}: {
  message: string;
  variant?: Variant;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      // Strip toast params from the URL so a refresh doesn't re-trigger it.
      const url = new URL(window.location.href);
      const toRemove = ["toast", "title", "who"];
      let mutated = false;
      for (const k of toRemove) {
        if (url.searchParams.has(k)) {
          url.searchParams.delete(k);
          mutated = true;
        }
      }
      if (mutated) router.replace(url.pathname + (url.search ? url.search : ""), { scroll: false });
    }, 6000);
    return () => clearTimeout(t);
  }, [router]);

  if (!visible) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`border ${VARIANT_STYLES[variant]} px-4 py-3 mb-6 flex items-center justify-between gap-4`}
    >
      <span className="text-sm">{message}</span>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        className="text-current opacity-60 hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
