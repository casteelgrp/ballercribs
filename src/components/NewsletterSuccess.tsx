import Link from "next/link";

type Size = "full" | "compact";

/**
 * Shared success state for every newsletter signup surface:
 *   - /newsletter page (size='full')
 *   - Homepage between-sections CTA (size='full')
 *   - Listing detail compact CTA (size='compact')
 *
 * Single component, single copy. The only thing that varies by `size` is
 * typography scale and whether the small accent rule between subtitle
 * and browse-listings link renders — it feels editorial on the full-page
 * /newsletter treatment but crowds the compact listing-page block.
 *
 * Fade-in keyframe lives in globals.css under `.animate-fadein` — a
 * light 300ms opacity bump so the form→success swap doesn't feel like
 * a hard DOM cut.
 */
export function NewsletterSuccess({ size = "full" }: { size?: Size }) {
  const isFull = size === "full";

  const headlineCls = isFull
    ? "font-display italic text-5xl sm:text-6xl leading-[1.05]"
    : "font-display italic text-3xl sm:text-4xl leading-[1.1]";

  const subCls = isFull
    ? "text-base sm:text-lg text-black/60 mt-6 max-w-md mx-auto leading-relaxed"
    : "text-sm text-black/60 mt-4 leading-relaxed";

  const paddingCls = isFull ? "py-8 sm:py-10" : "py-4";

  return (
    <div className={"text-center animate-fadein " + paddingCls}>
      <h3 className={headlineCls}>You&apos;re in.</h3>
      <p className={subCls}>
        First issue drops Sunday. Watch your inbox for a welcome note.
      </p>
      {isFull && (
        <span
          aria-hidden="true"
          className="block w-12 h-px bg-accent mx-auto mt-10 mb-8"
        />
      )}
      <Link
        href="/listings"
        className={
          "inline-block text-accent hover:text-ink transition-colors " +
          (isFull ? "mt-0 text-sm uppercase tracking-widest" : "mt-5 text-xs uppercase tracking-widest")
        }
      >
        Browse listings →
      </Link>
    </div>
  );
}
