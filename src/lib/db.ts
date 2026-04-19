import { sql } from "@vercel/postgres";
import type {
  AgentInquiry,
  AgentInquiryType,
  GalleryItem,
  HeroPhoto,
  Inquiry,
  Listing,
  ListingStatus,
  User,
  UserRole,
  UserWithHash
} from "./types";

function rowToListing(row: any): Listing {
  return {
    id: Number(row.id),
    slug: row.slug,
    title: row.title,
    location: row.location,
    price_usd: Number(row.price_usd),
    bedrooms: row.bedrooms !== null && row.bedrooms !== undefined ? Number(row.bedrooms) : null,
    bathrooms: row.bathrooms !== null && row.bathrooms !== undefined ? Number(row.bathrooms) : null,
    square_feet:
      row.square_feet !== null && row.square_feet !== undefined ? Number(row.square_feet) : null,
    description: row.description,
    hero_image_url: row.hero_image_url,
    gallery_image_urls: normalizeGallery(row.gallery_image_urls),
    social_cover_url: row.social_cover_url ?? null,
    agent_name: row.agent_name ?? null,
    agent_brokerage: row.agent_brokerage ?? null,
    featured: Boolean(row.featured),
    status: row.status as ListingStatus,
    submitted_at: row.submitted_at ?? null,
    published_at: row.published_at ?? null,
    reviewed_by_user_id:
      row.reviewed_by_user_id !== null && row.reviewed_by_user_id !== undefined
        ? Number(row.reviewed_by_user_id)
        : null,
    created_by_user_id:
      row.created_by_user_id !== null && row.created_by_user_id !== undefined
        ? Number(row.created_by_user_id)
        : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    sold_at: row.sold_at ?? null,
    sold_price_usd:
      row.sold_price_usd !== null && row.sold_price_usd !== undefined
        ? Number(row.sold_price_usd)
        : null,
    sale_notes: row.sale_notes ?? null,
    last_reviewed_at: row.last_reviewed_at ?? null
  };
}

// Defensive: rows in production DBs should already be {url, caption}[] post-migration,
// but if any legacy string slips through we coerce so the app never crashes on render.
function normalizeGallery(raw: unknown): GalleryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return { url: item, caption: null };
      if (item && typeof item === "object" && "url" in item && typeof (item as any).url === "string") {
        const cap = (item as any).caption;
        return { url: (item as any).url, caption: typeof cap === "string" ? cap : null };
      }
      return null;
    })
    .filter((x): x is GalleryItem => x !== null);
}

function rowToUser(row: any): User {
  return {
    id: Number(row.id),
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    is_active: Boolean(row.is_active),
    must_change_password: Boolean(row.must_change_password),
    created_at: row.created_at,
    last_login_at: row.last_login_at ?? null
  };
}

function rowToUserWithHash(row: any): UserWithHash {
  return { ...rowToUser(row), password_hash: row.password_hash };
}

// ─── Public listing reads ───────────────────────────────────────────────────

export async function getAllListings(): Promise<Listing[]> {
  // Active listings first (sold_at IS NULL → bucket 0), then sold (bucket 1).
  // Within active: featured first, then newest-published.
  // Within sold: most-recently-sold first. Sold rows stay `status='published'`
  // — the sold_at column is the "is this sold?" flag, orthogonal to status.
  const { rows } = await sql`
    SELECT * FROM listings
    WHERE status = 'published'
    ORDER BY
      CASE WHEN sold_at IS NULL THEN 0 ELSE 1 END,
      featured DESC,
      COALESCE(sold_at, published_at, created_at) DESC;
  `;
  return rows.map(rowToListing);
}

export async function getFeaturedListings(limit = 6): Promise<Listing[]> {
  const { rows } = await sql`
    SELECT * FROM listings
    WHERE status = 'published'
    ORDER BY
      CASE WHEN sold_at IS NULL THEN 0 ELSE 1 END,
      featured DESC,
      COALESCE(sold_at, published_at, created_at) DESC
    LIMIT ${limit};
  `;
  return rows.map(rowToListing);
}

/** Only sold listings, newest-sold first. Powers the /sold archive page. */
export async function getSoldListings(): Promise<Listing[]> {
  const { rows } = await sql`
    SELECT * FROM listings
    WHERE status = 'published' AND sold_at IS NOT NULL
    ORDER BY sold_at DESC;
  `;
  return rows.map(rowToListing);
}

export async function getListingBySlug(slug: string): Promise<Listing | null> {
  const { rows } = await sql`
    SELECT * FROM listings WHERE slug = ${slug} AND status = 'published' LIMIT 1;
  `;
  return rows[0] ? rowToListing(rows[0]) : null;
}

// ─── Admin listing reads ────────────────────────────────────────────────────

export async function getListingByIdAdmin(id: number): Promise<Listing | null> {
  const { rows } = await sql`SELECT * FROM listings WHERE id = ${id} LIMIT 1;`;
  return rows[0] ? rowToListing(rows[0]) : null;
}

export type AdminListingFilter = ListingStatus | "all";

/**
 * Pass `creatorUserId` to scope to one user's listings (regular-user dashboard).
 * Pass undefined to see everyone's (owner dashboard).
 */
export async function getAdminListingsWithCreators(
  filter: AdminListingFilter = "all",
  creatorUserId?: number
): Promise<(Listing & { creator_name: string | null })[]> {
  // 'all' tab hides archived (per product spec — archived is the out-of-sight state).
  // Four query variants because @vercel/postgres tagged template can't compose dynamic predicates.
  const { rows } =
    filter === "all"
      ? creatorUserId !== undefined
        ? await sql`
            SELECT l.*, u.name AS creator_name
            FROM listings l
            LEFT JOIN users u ON u.id = l.created_by_user_id
            WHERE l.status <> 'archived' AND l.created_by_user_id = ${creatorUserId}
            ORDER BY
              CASE l.status WHEN 'review' THEN 0 WHEN 'draft' THEN 1 WHEN 'published' THEN 2 ELSE 3 END,
              l.featured DESC,
              COALESCE(l.submitted_at, l.updated_at) DESC;
          `
        : await sql`
            SELECT l.*, u.name AS creator_name
            FROM listings l
            LEFT JOIN users u ON u.id = l.created_by_user_id
            WHERE l.status <> 'archived'
            ORDER BY
              CASE l.status WHEN 'review' THEN 0 WHEN 'draft' THEN 1 WHEN 'published' THEN 2 ELSE 3 END,
              l.featured DESC,
              COALESCE(l.submitted_at, l.updated_at) DESC;
          `
      : creatorUserId !== undefined
        ? await sql`
            SELECT l.*, u.name AS creator_name
            FROM listings l
            LEFT JOIN users u ON u.id = l.created_by_user_id
            WHERE l.status = ${filter} AND l.created_by_user_id = ${creatorUserId}
            ORDER BY
              CASE l.status
                WHEN 'review' THEN COALESCE(l.submitted_at, l.updated_at)
                WHEN 'published' THEN COALESCE(l.published_at, l.updated_at)
                ELSE l.updated_at
              END DESC;
          `
        : await sql`
            SELECT l.*, u.name AS creator_name
            FROM listings l
            LEFT JOIN users u ON u.id = l.created_by_user_id
            WHERE l.status = ${filter}
            ORDER BY
              CASE l.status
                WHEN 'review' THEN COALESCE(l.submitted_at, l.updated_at)
                WHEN 'published' THEN COALESCE(l.published_at, l.updated_at)
                ELSE l.updated_at
              END DESC;
          `;
  return rows.map((r: any) => ({ ...rowToListing(r), creator_name: r.creator_name ?? null }));
}

/** Counts by status, optionally scoped to one creator. */
export async function countListingsByStatus(
  creatorUserId?: number
): Promise<Record<ListingStatus, number>> {
  const { rows } =
    creatorUserId !== undefined
      ? await sql`
          SELECT status, COUNT(*)::int AS n
          FROM listings
          WHERE created_by_user_id = ${creatorUserId}
          GROUP BY status;
        `
      : await sql`
          SELECT status, COUNT(*)::int AS n
          FROM listings
          GROUP BY status;
        `;
  const out: Record<ListingStatus, number> = {
    draft: 0,
    review: 0,
    published: 0,
    archived: 0
  };
  for (const r of rows as Array<{ status: ListingStatus; n: number }>) {
    out[r.status] = Number(r.n);
  }
  return out;
}

// ─── Listing mutations ──────────────────────────────────────────────────────

export interface CreateListingInput {
  slug: string;
  title: string;
  location: string;
  price_usd: number;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  description: string;
  hero_image_url: string;
  gallery_image_urls: GalleryItem[];
  social_cover_url: string | null;
  agent_name: string | null;
  agent_brokerage: string | null;
  featured: boolean;
  status: ListingStatus;
  created_by_user_id: number | null;
}

export async function createListing(data: CreateListingInput): Promise<Listing> {
  const submittedAt = data.status === "review" ? new Date().toISOString() : null;
  const publishedAt = data.status === "published" ? new Date().toISOString() : null;
  const { rows } = await sql`
    INSERT INTO listings (
      slug, title, location, price_usd, bedrooms, bathrooms, square_feet,
      description, hero_image_url, gallery_image_urls, social_cover_url,
      agent_name, agent_brokerage, featured, status,
      submitted_at, published_at, created_by_user_id
    ) VALUES (
      ${data.slug}, ${data.title}, ${data.location}, ${data.price_usd},
      ${data.bedrooms}, ${data.bathrooms}, ${data.square_feet},
      ${data.description}, ${data.hero_image_url},
      ${JSON.stringify(data.gallery_image_urls)}::jsonb,
      ${data.social_cover_url},
      ${data.agent_name}, ${data.agent_brokerage}, ${data.featured}, ${data.status},
      ${submittedAt}, ${publishedAt}, ${data.created_by_user_id}
    )
    RETURNING *;
  `;
  return rowToListing(rows[0]);
}

export interface UpdateListingInput {
  slug?: string;
  title?: string;
  location?: string;
  price_usd?: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  square_feet?: number | null;
  description?: string;
  hero_image_url?: string;
  gallery_image_urls?: GalleryItem[];
  social_cover_url?: string | null;
  agent_name?: string | null;
  agent_brokerage?: string | null;
  featured?: boolean;
}

export async function updateListing(id: number, data: UpdateListingInput): Promise<Listing | null> {
  // sql template doesn't compose dynamic SET clauses cleanly, so we COALESCE to existing values.
  const { rows } = await sql`
    UPDATE listings
    SET
      slug              = COALESCE(${data.slug ?? null}, slug),
      title             = COALESCE(${data.title ?? null}, title),
      location          = COALESCE(${data.location ?? null}, location),
      price_usd         = COALESCE(${data.price_usd ?? null}, price_usd),
      bedrooms          = ${data.bedrooms === undefined ? null : data.bedrooms},
      bathrooms         = ${data.bathrooms === undefined ? null : data.bathrooms},
      square_feet       = ${data.square_feet === undefined ? null : data.square_feet},
      description       = COALESCE(${data.description ?? null}, description),
      hero_image_url    = COALESCE(${data.hero_image_url ?? null}, hero_image_url),
      gallery_image_urls = COALESCE(${
        data.gallery_image_urls !== undefined ? JSON.stringify(data.gallery_image_urls) : null
      }::jsonb, gallery_image_urls),
      social_cover_url  = ${data.social_cover_url === undefined ? null : data.social_cover_url},
      agent_name        = ${data.agent_name === undefined ? null : data.agent_name},
      agent_brokerage   = ${data.agent_brokerage === undefined ? null : data.agent_brokerage},
      featured          = COALESCE(${data.featured ?? null}, featured),
      updated_at        = NOW()
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows[0] ? rowToListing(rows[0]) : null;
}

/**
 * Apply a status transition. Sets `submitted_at`/`published_at`/`reviewed_by_user_id`
 * as appropriate. Caller is responsible for permission checks via `permissions.ts`.
 */
export async function transitionListingStatus(
  id: number,
  newStatus: ListingStatus,
  reviewerUserId: number | null
): Promise<Listing | null> {
  const now = new Date().toISOString();

  if (newStatus === "review") {
    const { rows } = await sql`
      UPDATE listings
      SET status = 'review', submitted_at = ${now}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *;
    `;
    return rows[0] ? rowToListing(rows[0]) : null;
  }

  if (newStatus === "published") {
    const { rows } = await sql`
      UPDATE listings
      SET status = 'published',
          published_at = ${now},
          reviewed_by_user_id = ${reviewerUserId},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *;
    `;
    return rows[0] ? rowToListing(rows[0]) : null;
  }

  if (newStatus === "draft") {
    // Sending back to draft: clear submitted_at so the queue reflects fresh state on next submission.
    const { rows } = await sql`
      UPDATE listings
      SET status = 'draft', submitted_at = NULL, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *;
    `;
    return rows[0] ? rowToListing(rows[0]) : null;
  }

  // archived
  const { rows } = await sql`
    UPDATE listings
    SET status = 'archived', updated_at = NOW()
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows[0] ? rowToListing(rows[0]) : null;
}

export async function deleteListing(id: number): Promise<void> {
  await sql`DELETE FROM listings WHERE id = ${id};`;
}

// ─── Sold workflow ──────────────────────────────────────────────────────────

export interface MarkSoldInput {
  /** ISO date string — validated by caller; must be <= today. */
  sold_at: string;
  /** Nullable — undisclosed / NDA sales are allowed. */
  sold_price_usd: number | null;
  sale_notes: string | null;
}

export async function markListingSold(id: number, input: MarkSoldInput): Promise<Listing | null> {
  const { rows } = await sql`
    UPDATE listings
    SET sold_at = ${input.sold_at},
        sold_price_usd = ${input.sold_price_usd},
        sale_notes = ${input.sale_notes},
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows[0] ? rowToListing(rows[0]) : null;
}

export async function unmarkListingSold(id: number): Promise<Listing | null> {
  const { rows } = await sql`
    UPDATE listings
    SET sold_at = NULL,
        sold_price_usd = NULL,
        sale_notes = NULL,
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows[0] ? rowToListing(rows[0]) : null;
}

/** Bumps last_reviewed_at = NOW() — removes the listing from the stale queue for 90 days. */
export async function markListingReviewed(id: number): Promise<boolean> {
  const { rowCount } = await sql`
    UPDATE listings SET last_reviewed_at = NOW(), updated_at = NOW() WHERE id = ${id};
  `;
  return (rowCount ?? 0) > 0;
}

/**
 * Listings that have been published >90 days, aren't sold, and either haven't
 * been reviewed yet or were last reviewed >90 days ago. Oldest-published first
 * so the admin chews through the backlog in age order.
 */
export async function getStaleListings(): Promise<Listing[]> {
  const { rows } = await sql`
    SELECT * FROM listings
    WHERE status = 'published'
      AND sold_at IS NULL
      AND published_at < NOW() - INTERVAL '90 days'
      AND (last_reviewed_at IS NULL OR last_reviewed_at < NOW() - INTERVAL '90 days')
    ORDER BY published_at ASC;
  `;
  return rows.map(rowToListing);
}

/**
 * Insert with auto-dedupe: if data.slug collides with an existing row, retries
 * with `${slug}-2`, `${slug}-3`, … up to 50 attempts. Race-safe because we
 * catch the actual unique-violation error from the DB rather than pre-checking.
 */
export async function createListingWithUniqueSlug(data: CreateListingInput): Promise<Listing> {
  const baseSlug = data.slug;
  let attempt = 0;
  // 50 attempts is way more than realistic; protects against an unbounded loop.
  while (attempt < 50) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    try {
      return await createListing({ ...data, slug: candidate });
    } catch (err: unknown) {
      const e = err as { code?: string; constraint?: string } | null;
      // 23505 = unique_violation. The listings table has only one unique
      // constraint (slug) so we don't need to inspect `constraint`, but
      // checking it makes the intent obvious and future-proofs against
      // adding another unique column later.
      if (e?.code === "23505" && (!e.constraint || e.constraint.includes("slug"))) {
        attempt++;
        continue;
      }
      throw err;
    }
  }
  throw new Error("Could not generate a unique slug after 50 attempts.");
}

// ─── Inquiries ──────────────────────────────────────────────────────────────

export interface CreateInquiryInput {
  listing_id: number | null;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  pre_approved: boolean;
  timeline: string | null;
}

export async function createInquiry(data: CreateInquiryInput): Promise<Inquiry> {
  const { rows } = await sql`
    INSERT INTO inquiries (listing_id, name, email, phone, message, pre_approved, timeline)
    VALUES (${data.listing_id}, ${data.name}, ${data.email}, ${data.phone},
            ${data.message}, ${data.pre_approved}, ${data.timeline})
    RETURNING *;
  `;
  return rows[0] as Inquiry;
}

/**
 * Fetch inquiries filtered by archive status. Active view sorts newest-created
 * first; archived view sorts newest-archived first so the most recently
 * archived items are at the top.
 */
export type InquiryWithListing = Inquiry & {
  listing_title: string | null;
  listing_slug: string | null;
};

export async function getRecentInquiries(
  opts: { archived?: boolean; limit?: number } = {}
): Promise<InquiryWithListing[]> {
  const limit = opts.limit ?? 50;
  // LEFT JOIN so an inquiry whose listing was deleted still shows up in admin
  // (with listing_title/slug = null → the UI renders a 'no longer available'
  // note instead of a broken link).
  const { rows } = opts.archived
    ? await sql`
        SELECT i.*, l.title AS listing_title, l.slug AS listing_slug
        FROM inquiries i
        LEFT JOIN listings l ON l.id = i.listing_id
        WHERE i.archived_at IS NOT NULL
        ORDER BY i.archived_at DESC
        LIMIT ${limit};
      `
    : await sql`
        SELECT i.*, l.title AS listing_title, l.slug AS listing_slug
        FROM inquiries i
        LEFT JOIN listings l ON l.id = i.listing_id
        WHERE i.archived_at IS NULL
        ORDER BY i.created_at DESC
        LIMIT ${limit};
      `;
  return rows as InquiryWithListing[];
}

export async function countInquiriesByArchiveStatus(): Promise<{ active: number; archived: number }> {
  const { rows } = await sql`
    SELECT
      SUM(CASE WHEN archived_at IS NULL THEN 1 ELSE 0 END)::int AS active,
      SUM(CASE WHEN archived_at IS NOT NULL THEN 1 ELSE 0 END)::int AS archived
    FROM inquiries;
  `;
  const row = rows[0] ?? { active: 0, archived: 0 };
  return { active: Number(row.active ?? 0), archived: Number(row.archived ?? 0) };
}

export async function archiveInquiry(id: number): Promise<boolean> {
  const { rowCount } = await sql`UPDATE inquiries SET archived_at = NOW() WHERE id = ${id};`;
  return (rowCount ?? 0) > 0;
}

export async function unarchiveInquiry(id: number): Promise<boolean> {
  const { rowCount } = await sql`UPDATE inquiries SET archived_at = NULL WHERE id = ${id};`;
  return (rowCount ?? 0) > 0;
}

export async function deleteInquiry(id: number): Promise<boolean> {
  const { rowCount } = await sql`DELETE FROM inquiries WHERE id = ${id};`;
  return (rowCount ?? 0) > 0;
}

// ─── Users ──────────────────────────────────────────────────────────────────

export async function countUsers(): Promise<number> {
  const { rows } = await sql`SELECT COUNT(*)::int AS n FROM users;`;
  return Number(rows[0]?.n ?? 0);
}

export async function getUserById(id: number): Promise<User | null> {
  const { rows } = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1;`;
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function getUserByEmailWithHash(email: string): Promise<UserWithHash | null> {
  const { rows } = await sql`
    SELECT * FROM users WHERE email = ${email.trim().toLowerCase()} LIMIT 1;
  `;
  return rows[0] ? rowToUserWithHash(rows[0]) : null;
}

export async function getUserByIdWithHash(id: number): Promise<UserWithHash | null> {
  const { rows } = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1;`;
  return rows[0] ? rowToUserWithHash(rows[0]) : null;
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: UserRole;
  password_hash: string;
  must_change_password: boolean;
}

export async function createUser(data: CreateUserInput): Promise<User> {
  const { rows } = await sql`
    INSERT INTO users (email, name, role, password_hash, must_change_password)
    VALUES (${data.email.trim().toLowerCase()}, ${data.name.trim()},
            ${data.role}, ${data.password_hash}, ${data.must_change_password})
    RETURNING *;
  `;
  return rowToUser(rows[0]);
}

export async function updateUserPassword(
  userId: number,
  passwordHash: string,
  mustChange: boolean
): Promise<void> {
  await sql`
    UPDATE users
    SET password_hash = ${passwordHash},
        must_change_password = ${mustChange}
    WHERE id = ${userId};
  `;
}

export async function setUserActive(userId: number, active: boolean): Promise<void> {
  await sql`UPDATE users SET is_active = ${active} WHERE id = ${userId};`;
}

export async function updateLastLogin(userId: number): Promise<void> {
  await sql`UPDATE users SET last_login_at = NOW() WHERE id = ${userId};`;
}

export async function listUsers(): Promise<User[]> {
  const { rows } = await sql`
    SELECT * FROM users ORDER BY role DESC, created_at ASC;
  `;
  return rows.map(rowToUser);
}

// ─── Hero photos ────────────────────────────────────────────────────────────

function rowToHeroPhoto(row: any): HeroPhoto {
  return {
    id: Number(row.id),
    url: row.url,
    caption: row.caption ?? null,
    display_order: Number(row.display_order),
    active: Boolean(row.active),
    created_at: row.created_at
  };
}

/** Public homepage query: only the active photos, in their display order. */
export async function getActiveHeroPhotos(): Promise<HeroPhoto[]> {
  const { rows } = await sql`
    SELECT * FROM hero_photos
    WHERE active = TRUE
    ORDER BY display_order ASC, id ASC;
  `;
  return rows.map(rowToHeroPhoto);
}

/** Admin query: every row, active or not. */
export async function listAllHeroPhotos(): Promise<HeroPhoto[]> {
  const { rows } = await sql`
    SELECT * FROM hero_photos
    ORDER BY display_order ASC, id ASC;
  `;
  return rows.map(rowToHeroPhoto);
}

export async function createHeroPhoto(url: string, caption: string | null = null): Promise<HeroPhoto> {
  // New photos go to the end of the order. COALESCE handles the empty-table case.
  const { rows } = await sql`
    INSERT INTO hero_photos (url, caption, display_order, active)
    VALUES (
      ${url},
      ${caption},
      COALESCE((SELECT MAX(display_order) + 1 FROM hero_photos), 0),
      TRUE
    )
    RETURNING *;
  `;
  return rowToHeroPhoto(rows[0]);
}

export async function setHeroPhotoActive(id: number, active: boolean): Promise<void> {
  await sql`UPDATE hero_photos SET active = ${active} WHERE id = ${id};`;
}

/**
 * Bulk-update display_order from an array of {id, order} pairs.
 * Used after the admin drags-to-reorder. Single round-trip via UPDATE FROM VALUES.
 */
export async function setHeroPhotoOrders(orders: Array<{ id: number; order: number }>): Promise<void> {
  if (orders.length === 0) return;
  // Build a VALUES clause: (id, order), (id, order), ...
  // Using sql.unsafe-style construction is awkward with @vercel/postgres tagged
  // template, so we just do N UPDATEs in parallel — N is at most ~10 hero photos,
  // not worth a single-statement optimisation.
  await Promise.all(
    orders.map(({ id, order }) => sql`UPDATE hero_photos SET display_order = ${order} WHERE id = ${id};`)
  );
}

export async function deleteHeroPhoto(id: number): Promise<void> {
  await sql`DELETE FROM hero_photos WHERE id = ${id};`;
}

// ─── Agent inquiries ────────────────────────────────────────────────────────

function rowToAgentInquiry(row: any): AgentInquiry {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    phone: row.phone ?? null,
    brokerage: row.brokerage ?? null,
    city_state: row.city_state ?? null,
    inquiry_type: row.inquiry_type as AgentInquiryType,
    message: row.message ?? null,
    created_at: row.created_at,
    archived_at: row.archived_at ?? null
  };
}

export interface CreateAgentInquiryInput {
  name: string;
  email: string;
  phone: string | null;
  brokerage: string | null;
  city_state: string | null;
  inquiry_type: AgentInquiryType;
  message: string | null;
}

export async function createAgentInquiry(data: CreateAgentInquiryInput): Promise<AgentInquiry> {
  const { rows } = await sql`
    INSERT INTO agent_inquiries (name, email, phone, brokerage, city_state, inquiry_type, message)
    VALUES (${data.name}, ${data.email}, ${data.phone}, ${data.brokerage},
            ${data.city_state}, ${data.inquiry_type}, ${data.message})
    RETURNING *;
  `;
  return rowToAgentInquiry(rows[0]);
}

export async function getRecentAgentInquiries(
  opts: { archived?: boolean; limit?: number } = {}
): Promise<AgentInquiry[]> {
  const limit = opts.limit ?? 50;
  const { rows } = opts.archived
    ? await sql`
        SELECT * FROM agent_inquiries
        WHERE archived_at IS NOT NULL
        ORDER BY archived_at DESC
        LIMIT ${limit};
      `
    : await sql`
        SELECT * FROM agent_inquiries
        WHERE archived_at IS NULL
        ORDER BY created_at DESC
        LIMIT ${limit};
      `;
  return rows.map(rowToAgentInquiry);
}

export async function countAgentInquiriesByArchiveStatus(): Promise<{
  active: number;
  archived: number;
}> {
  const { rows } = await sql`
    SELECT
      SUM(CASE WHEN archived_at IS NULL THEN 1 ELSE 0 END)::int AS active,
      SUM(CASE WHEN archived_at IS NOT NULL THEN 1 ELSE 0 END)::int AS archived
    FROM agent_inquiries;
  `;
  const row = rows[0] ?? { active: 0, archived: 0 };
  return { active: Number(row.active ?? 0), archived: Number(row.archived ?? 0) };
}

export async function archiveAgentInquiry(id: number): Promise<boolean> {
  const { rowCount } = await sql`UPDATE agent_inquiries SET archived_at = NOW() WHERE id = ${id};`;
  return (rowCount ?? 0) > 0;
}

export async function unarchiveAgentInquiry(id: number): Promise<boolean> {
  const { rowCount } = await sql`UPDATE agent_inquiries SET archived_at = NULL WHERE id = ${id};`;
  return (rowCount ?? 0) > 0;
}

export async function deleteAgentInquiry(id: number): Promise<boolean> {
  const { rowCount } = await sql`DELETE FROM agent_inquiries WHERE id = ${id};`;
  return (rowCount ?? 0) > 0;
}
