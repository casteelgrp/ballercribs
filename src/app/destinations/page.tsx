import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getPublicDestinationCountsMap, getPublishedDestinations } from "@/lib/db";
import { JsonLd, breadcrumbListSchema } from "@/lib/jsonld";
import type { Destination, DestinationCounts } from "@/lib/types";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Destinations",
  description:
    "Browse luxury listings and rentals by destination — Malibu, The Hamptons, Aspen, and more.",
  alternates: { canonical: "/destinations" },
  openGraph: {
    type: "website",
    url: "/destinations",
    title: "Destinations | BallerCribs",
    description:
      "Browse luxury listings and rentals by destination — Malibu, The Hamptons, Aspen, and more.",
    images: ["/opengraph-image"]
  },
  twitter: {
    card: "summary_large_image",
    title: "Destinations | BallerCribs",
    description:
      "Browse luxury listings and rentals by destination.",
    images: ["/opengraph-image"]
  }
};

const BLURB_MAX = 120;

function truncateBlurb(s: string | null): string | null {
  if (!s) return null;
  const t = s.trim();
  if (t.length <= BLURB_MAX) return t;
  return t.slice(0, BLURB_MAX - 1).trimEnd() + "…";
}

/**
 * Group destinations by region, preserving alphabetical order within
 * each group. region === null collects into a trailing "Other" bucket
 * so admins who haven't filled the field don't get a phantom group
 * with an empty heading. Group keys themselves are sorted A→Z; the
 * null bucket sorts to the end.
 */
function groupByRegion(
  destinations: Destination[]
): { region: string | null; items: Destination[] }[] {
  const buckets = new Map<string | null, Destination[]>();
  for (const d of destinations) {
    const key = d.region ?? null;
    const arr = buckets.get(key);
    if (arr) arr.push(d);
    else buckets.set(key, [d]);
  }
  const named = [...buckets.entries()]
    .filter(([k]) => k !== null)
    .sort(([a], [b]) => (a as string).localeCompare(b as string));
  const unnamed = buckets.get(null);
  const out: { region: string | null; items: Destination[] }[] = named.map(
    ([region, items]) => ({ region, items })
  );
  if (unnamed && unnamed.length > 0) {
    out.push({ region: null, items: unnamed });
  }
  return out;
}

export default async function DestinationsIndexPage() {
  const [destinations, counts] = await Promise.all([
    getPublishedDestinations().catch(() => []),
    getPublicDestinationCountsMap().catch(
      () => ({} as Record<number, DestinationCounts>)
    )
  ]);

  // Hide destinations with zero public-visible content. Admin sees
  // all (drafts included); public sees only the populated subset.
  const populated = destinations.filter((d) => {
    const c = counts[d.id] ?? { listings: 0, rentals: 0, blog_posts: 0 };
    return c.listings + c.rentals + c.blog_posts > 0;
  });

  const grouped = groupByRegion(populated);

  return (
    <article>
      <JsonLd
        data={breadcrumbListSchema([
          { name: "Home", url: "/" },
          { name: "Destinations", url: "/destinations" }
        ])}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Hero — stays small, matching /listings header rhythm. */}
        <div className="mb-12">
          <p className="text-xs uppercase tracking-widest text-black/50">By place</p>
          <h1 className="font-display text-4xl sm:text-5xl mt-2">Destinations.</h1>
          <p className="text-black/60 mt-3 max-w-2xl">
            Where the wildest homes are.
          </p>
        </div>

        {grouped.length === 0 ? (
          <div className="border border-dashed border-black/15 py-20 text-center text-black/50">
            <p>Destination pages are on the way. Check back soon.</p>
          </div>
        ) : (
          <div className="space-y-14">
            {grouped.map((group) => (
              <section key={group.region ?? "__other__"}>
                {group.region && (
                  <h2 className="font-display text-2xl sm:text-3xl mb-6">
                    {group.region}
                  </h2>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {group.items.map((d) => (
                    <DestinationCard
                      key={d.id}
                      destination={d}
                      counts={counts[d.id] ?? { listings: 0, rentals: 0, blog_posts: 0 }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function DestinationCard({
  destination,
  counts
}: {
  destination: Destination;
  counts: DestinationCounts;
}) {
  const blurb = truncateBlurb(destination.blurb);
  // Counts string — only mention the kinds that have inventory.
  // Blog count isn't surfaced on the card per spec (badges are
  // listings + rentals only).
  const badges: string[] = [];
  if (counts.listings > 0) {
    badges.push(`${counts.listings} listing${counts.listings === 1 ? "" : "s"}`);
  }
  if (counts.rentals > 0) {
    badges.push(`${counts.rentals} rental${counts.rentals === 1 ? "" : "s"}`);
  }

  return (
    <Link
      href={`/destinations/${destination.slug}`}
      className="group block"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-black/5">
        {destination.hero_image_url ? (
          <Image
            src={destination.hero_image_url}
            alt={destination.hero_image_alt || destination.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-widest text-black/30">
            {destination.name}
          </div>
        )}
      </div>
      <div className="mt-4">
        <h3 className="font-display text-xl group-hover:text-accent transition-colors">
          {destination.name}
        </h3>
        {badges.length > 0 && (
          <p className="text-xs uppercase tracking-widest text-black/50 mt-1.5">
            {badges.join(" · ")}
          </p>
        )}
        {blurb && (
          <p className="text-sm text-black/70 mt-2 leading-relaxed">{blurb}</p>
        )}
      </div>
    </Link>
  );
}
