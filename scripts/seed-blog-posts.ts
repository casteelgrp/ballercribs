/**
 * Seed 3 blog posts for hands-on verification of the public /blog
 * surface. Inserts directly via @vercel/postgres (not the API) because
 * the admin API requires an authenticated session and we want this to
 * run headless.
 *
 * Posts land in DRAFT status — you publish them from /admin/blog so the
 * publish flow gets exercised end-to-end. Re-running the script is safe:
 * slugs are unique and the insert bails on conflict, so existing rows
 * are left alone (use /admin/blog to edit them instead).
 */
import { sql } from "@vercel/postgres";
import { computeReadingTimeMinutes } from "../src/lib/blog-queries";
import { sanitizeBlogHtml } from "../src/lib/blog-sanitize";

type Seed = {
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  coverImageUrl: string | null;
  categorySlug: string;
  bodyJson: unknown;
  bodyHtml: string;
};

/**
 * Minimal helpers to build TipTap JSONContent by hand without pulling
 * in @tiptap/core on the Node side. The shape matches what the editor
 * produces on save — doc root with content array of block nodes.
 */
const p = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }]
});
const h2 = (text: string) => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }]
});
const list = (items: string[]) => ({
  type: "bulletList",
  content: items.map((t) => ({
    type: "listItem",
    content: [{ type: "paragraph", content: [{ type: "text", text: t }] }]
  }))
});
const img = (src: string, alt: string) => ({
  type: "image",
  attrs: { src, alt }
});
const card = (attrs: Record<string, string>) => ({
  type: "propertyCard",
  attrs: {
    name: attrs.name,
    location: attrs.location,
    photoUrl: attrs.photoUrl,
    blurb: attrs.blurb,
    url: attrs.url,
    ctaLabel: attrs.ctaLabel ?? "View property →"
  }
});

// Helper: build the HTML string from the same content tree. Kept
// hand-rolled so the seed doesn't need to run the full TipTap pipeline
// at build time. Real posts authored through the admin UI get their
// body_html from editor.getHTML() and then server-side DOMPurify —
// this path bypasses TipTap but hits the same sanitizer at the end.
function nodeToHtml(node: any): string {
  if (node.type === "paragraph") {
    return `<p>${(node.content ?? []).map(nodeToHtml).join("")}</p>`;
  }
  if (node.type === "heading") {
    const lvl = node.attrs?.level ?? 2;
    return `<h${lvl}>${(node.content ?? []).map(nodeToHtml).join("")}</h${lvl}>`;
  }
  if (node.type === "bulletList") {
    return `<ul>${(node.content ?? []).map(nodeToHtml).join("")}</ul>`;
  }
  if (node.type === "listItem") {
    return `<li>${(node.content ?? []).map(nodeToHtml).join("")}</li>`;
  }
  if (node.type === "text") {
    return escapeHtml(node.text ?? "");
  }
  if (node.type === "image") {
    const a = node.attrs ?? {};
    return `<img src="${escapeAttr(a.src)}" alt="${escapeAttr(a.alt)}" loading="lazy">`;
  }
  if (node.type === "propertyCard") {
    const a = node.attrs ?? {};
    return [
      `<div data-property-card="true" class="property-card">`,
      `<a href="${escapeAttr(a.url)}" target="_blank" rel="noopener noreferrer" class="property-card__link">`,
      `<div class="property-card__media"><img src="${escapeAttr(a.photoUrl)}" alt="${escapeAttr(a.name)}" loading="lazy"></div>`,
      `<div class="property-card__body">`,
      `<p class="property-card__eyebrow">Property</p>`,
      `<h3 class="property-card__name">${escapeHtml(a.name)}</h3>`,
      `<p class="property-card__location">${escapeHtml(a.location)}</p>`,
      `<p class="property-card__blurb">${escapeHtml(a.blurb)}</p>`,
      `<span class="property-card__cta">${escapeHtml(a.ctaLabel)}</span>`,
      `</div>`,
      `</a>`,
      `</div>`
    ].join("");
  }
  return "";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}

function buildBody(nodes: any[]): { bodyJson: unknown; bodyHtml: string } {
  const bodyJson = { type: "doc", content: nodes };
  const rawHtml = nodes.map(nodeToHtml).join("");
  const bodyHtml = sanitizeBlogHtml(rawHtml) ?? "";
  return { bodyJson, bodyHtml };
}

const POSTS: Seed[] = [
  (() => {
    const nodes = [
      p(
        "Every summer, the rental market at the far end of Long Island does a thing that looks, from the outside, a lot like mass delusion. Eight-figure deals for a month. Bidding wars for a week. Owners holding out for Memorial Day like it's a Broadway opening."
      ),
      p(
        "It's not delusion. It's the predictable collision of three forces that haven't let up since 2021 — low inventory, high liquidity, and a very particular kind of buyer who has decided that summer east of Southampton is non-negotiable. Here's what the numbers actually say."
      ),
      h2("The inventory isn't growing"),
      p(
        "New construction east of the canal is choked by zoning, wetlands, and three-year permitting timelines. The supply of estate-scale homes is effectively fixed. Every year, a handful drop off as families keep them off the rental market — and nothing replaces them."
      ),
      list([
        "East Hampton Village: 13 estates listed at $500K+ per month in 2024; 9 in 2025.",
        "Bridgehampton: 21 listings over $200K/month; most booked before May.",
        "Montauk: the inventory doubled post-pandemic, then compressed back as owners converted to full-time."
      ]),
      h2("Who's actually renting"),
      p(
        "The buyer pool split in half. One cohort — finance, tech exits, family offices — treats a summer rental like a corporate lease: signed by March, paid up front, staffed. The other cohort — celebrities, athletes, the top of the fashion and media world — shops late, pays more, and wants a month that happens to include a specific weekend."
      ),
      p(
        "Both cohorts are price-insensitive at the top end. Neither is bluffing."
      ),
      h2("What's rentable right now"),
      card({
        name: "Further Lane Compound",
        location: "East Hampton, NY",
        photoUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
        blurb:
          "Ten-bedroom estate with pool, pool house, and Har-Tru tennis court. Minimum 14-day terms; weekly rates land north of $85K in July.",
        url: "https://example.com/rentals/further-lane",
        ctaLabel: "Inquire →"
      }),
      p(
        "The short version: if you want a house for July, you are already late. If you want August, you have two weeks. And if you want next summer, the serious conversations start in November."
      )
    ];
    const body = buildBody(nodes);
    return {
      slug: "hamptons-rental-market-2026",
      title: "Why the Hamptons rental market is insane this year",
      subtitle: "Three forces, no end in sight, and the math that explains every $1M summer.",
      excerpt:
        "Low inventory, high liquidity, and a buyer pool that doesn't blink at the top end. A quick-read primer on why the numbers keep climbing.",
      coverImageUrl:
        "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=1800&q=80",
      categorySlug: "news",
      ...body
    };
  })(),

  (() => {
    const nodes = [
      p(
        "The Beverly Park estate at the top of this story changed hands in late 2025 for a number the listing agent will not, even now, say out loud. What's public is the architecture: 50,000 square feet behind a 12-foot hedge, a grotto-pool you could shoot a film in, a gym with a boxing ring that a three-time world champion used to train in. What's private is who bought it and what they paid. We walked the property, talked to the team who sold it, and reconstructed the arc."
      ),
      h2("The setup"),
      p(
        "Beverly Park is not a neighborhood so much as a permissioning system. Two gates, one guard booth, a CC&R that forbids realtor signs — the idea is that if you have to ask how to get in, you're not getting in. There are 64 parcels inside the hedge line. Roughly five of them change hands in any given year."
      ),
      p(
        "This property was not supposed to be one of them. The owner — a first-generation tech founder — listed it in 2023 at a number that raised eyebrows and pulled it three months later with no offers worth acknowledging. Then two things happened."
      ),
      h2("What changed"),
      list([
        "A comparable sale at the other end of the park closed at a 30% premium to listing — setting a new ceiling.",
        "The owner's primary business had a liquidity event, making the carrying cost a distraction rather than a hedge.",
        "An off-market buyer, sourced through a broker on retainer, signed an NDA and made a preemptive offer before the relist."
      ]),
      card({
        name: "Beverly Park Fortress",
        location: "Beverly Hills, CA",
        photoUrl: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80",
        blurb:
          "The comp that set the ceiling — eight bedrooms, twelve baths, a screening room, and a motor court with a turntable.",
        url: "https://example.com/listings/beverly-park-fortress",
        ctaLabel: "See the listing →"
      }),
      h2("Why it matters"),
      p(
        "Beverly Park pricing now has a new floor. Every broker working the enclave will quote this deal in their next pitch — and buyers who passed at 2023 numbers will be told, gently, that the window has closed. The only real inventory problem in ultra-prime LA was never supply. It was a shared story about what it was worth. That story just changed."
      )
    ];
    const body = buildBody(nodes);
    return {
      slug: "inside-beverly-park-fortress-sale",
      title: "Inside a $100M+ Beverly Park fortress sale",
      subtitle:
        "How an off-market deal in a 64-parcel enclave reset ultra-prime LA pricing overnight.",
      excerpt:
        "A Beverly Park estate changed hands at a number that's rewriting brokers' pitches. Here's the anatomy of the deal.",
      coverImageUrl:
        "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1800&q=80",
      categorySlug: "case-studies",
      ...body
    };
  })(),

  (() => {
    const nodes = [
      p(
        "Booking a mega-mansion for a week is nothing like booking a villa. The inventory is scarcer, the process is relationship-driven, and the price is almost never what's advertised. Here's how to do it without getting burned."
      ),
      h2("1. Lock the dates before you lock the house"),
      p(
        "The single most common mistake is shopping for a property first and then trying to bend the calendar around it. Inventory at this tier turns on two-week minimums in summer and often a one-month minimum over Christmas. Pick your window first; let the window filter the inventory."
      ),
      h2("2. Budget in three layers"),
      list([
        "Nightly or weekly rate (the headline number).",
        "Staffing — housekeeper, chef, driver, concierge. Not optional at estate scale.",
        "Damage deposit, taxes, service fees. Typically 15–25% on top of the headline."
      ]),
      p(
        "If you see a rate that looks suspiciously affordable, it's almost always missing layer 2 or 3."
      ),
      h2("3. Go through an agent who's actually rented these before"),
      p(
        "Online listings of estate-scale rentals are a small fraction of what's actually available. Properties change hands on a phone call. If you're serious about a specific market, find the broker who has represented five deals there in the last year and work through them. It costs nothing extra — the owner pays."
      ),
      h2("4. Read the house rules before you sign"),
      p(
        "Events are usually prohibited unless pre-approved. Pets are almost always negotiable. Filming — including drone footage for your own Instagram — is often explicitly restricted. Read the full rider. Ask for redlines."
      ),
      h2("5. Inventory worth knowing about"),
      card({
        name: "Villa Mandalay",
        location: "Mykonos, Greece",
        photoUrl: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80",
        blurb:
          "Eight bedrooms on the cliffs of Agios Lazaros. Infinity pool, private beach access, staffed.",
        url: "https://example.com/rentals/villa-mandalay",
        ctaLabel: "Inquire →"
      }),
      p(
        "The properties in this price range aren't about amenities — they're about privacy, staff, and the specific feeling of arriving somewhere that has been prepared for your family by people whose job is to anticipate. Shop for that, not for the marble."
      )
    ];
    const body = buildBody(nodes);
    return {
      slug: "mega-mansion-rentals-what-to-know",
      title: "How to book a mega-mansion rental without getting burned",
      subtitle:
        "Five rules for the top of the luxury rental market — what inventory looks like, what fees to expect, and why the best properties aren't listed anywhere.",
      excerpt:
        "A practical primer on renting at the estate tier — dates, budget layers, agent relationships, house rules, and what actually matters.",
      coverImageUrl:
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=80",
      categorySlug: "guides",
      ...body
    };
  })()
];

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Run via `npm run seed:blog` so .env.local is loaded."
    );
  }

  const { rows: ownerRows } = await sql`SELECT id FROM users WHERE role = 'owner' LIMIT 1;`;
  const authorId = ownerRows[0] ? Number(ownerRows[0].id) : null;
  if (!authorId) throw new Error("No owner user found to author the seed posts");

  let inserted = 0;
  let skipped = 0;

  for (const post of POSTS) {
    const reading = computeReadingTimeMinutes(post.bodyJson);
    const result = await sql`
      INSERT INTO blog_posts (
        slug, title, subtitle, excerpt,
        body_json, body_html,
        cover_image_url, category_slug,
        status, author_user_id, reading_time_minutes
      ) VALUES (
        ${post.slug},
        ${post.title},
        ${post.subtitle},
        ${post.excerpt},
        ${JSON.stringify(post.bodyJson)}::jsonb,
        ${post.bodyHtml},
        ${post.coverImageUrl},
        ${post.categorySlug},
        'draft',
        ${authorId},
        ${reading}
      )
      ON CONFLICT (slug) DO NOTHING;
    `;
    if ((result.rowCount ?? 0) > 0) {
      console.log(`  +  ${post.slug}  (${reading} min)`);
      inserted += 1;
    } else {
      console.log(`  ·  ${post.slug}  (exists, skipped)`);
      skipped += 1;
    }
  }

  console.log(`\nSeed complete: ${inserted} inserted, ${skipped} skipped.`);
  console.log(`Visit /admin/blog to review and publish.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
