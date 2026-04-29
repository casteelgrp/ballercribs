// Shared chrome for /privacy, /terms, /disclosures. Keeps their
// typography consistent without pulling in @tailwindcss/typography — the
// set of rendered elements is small (h1/h2/h3/p/ul/li/strong/em/a) so
// hand-styling each keeps the editorial aesthetic aligned with the rest
// of the site.

export function LegalPage({
  title,
  lastUpdated,
  children
}: {
  title: string;
  /** ISO date string rendered as a human-readable "Last updated" line. */
  lastUpdated: string;
  children: React.ReactNode;
}) {
  const date = new Date(lastUpdated);
  const formatted = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <header className="mb-10 border-b border-black/10 pb-6">
        <h1 className="font-display text-4xl sm:text-5xl leading-tight">{title}</h1>
        <p className="text-sm text-black/50 mt-3">Last updated: {formatted}</p>
      </header>
      <div className="legal-prose">{children}</div>
    </article>
  );
}
