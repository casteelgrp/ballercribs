export type UserRole = "owner" | "user";

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface UserWithHash extends User {
  password_hash: string;
}

export type ListingStatus = "draft" | "review" | "published" | "archived";

/**
 * Sale vs short-term rental. Sale listings use the existing price_usd /
 * sold_* fields; rentals use the rental_* fields instead. Long-term rentals
 * are out of scope for the product — migration 015 flipped historical
 * long_term rows to short_term and tightened the price-unit CHECK. The
 * rental_term column retains both CHECK values at the DB layer so the
 * decision is reversible without a schema migration.
 */
export type ListingType = "sale" | "rental";

/**
 * Kept as a two-value union for defensive typing on historical reads —
 * migration 015 flipped every extant long_term row, but the DB CHECK
 * still admits both values so the product can re-enable long-term later
 * without a schema change.
 */
export type RentalTerm = "short_term" | "long_term";

/** Short-term rentals price by the night or by the week. */
export type RentalPriceUnit = "night" | "week";

export interface GalleryItem {
  url: string;
  caption: string | null;
}

export interface Listing {
  id: number;
  slug: string;
  title: string;
  location: string;
  // price is stored as an integer in the listing's native currency units
  // (whole dollars / euros / dirhams — not cents). The column name is kept
  // as `price_usd` for historical reasons; the actual currency lives in
  // the `currency` column below and the display layer reads both.
  price_usd: number;
  currency: string;
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
  submitted_at: string | null;
  published_at: string | null;
  reviewed_by_user_id: number | null;
  created_by_user_id: number | null;
  created_at: string;
  updated_at: string;
  // Sold workflow. sold_at NULL = active; any timestamp = sold.
  // sold_price_usd nullable so NDA / undisclosed sales are representable
  // ("SOLD · Price undisclosed" on the public page).
  sold_at: string | null;
  sold_price_usd: number | null;
  sale_notes: string | null;
  // Bumped by the "Still active" button in the admin stale-listing queue;
  // a listing only reappears in the queue 90 days after the last review.
  last_reviewed_at: string | null;
  // Per-listing SEO overrides — null means fall back to auto-generated
  // metadata. Only affect the <title> + <meta name="description"> tags;
  // OG / Twitter / JSON-LD keep using the listing's natural fields.
  seo_title: string | null;
  seo_description: string | null;
  // Rental fields — populated only when listing_type === 'rental'.
  listing_type: ListingType;
  rental_term: RentalTerm | null;
  /** Cents of the listing's native currency (matches the currency column). */
  rental_price_cents: number | null;
  rental_price_unit: RentalPriceUnit | null;
  // Booking-partner linkage — required on rentals, NULL on sales.
  // partner_property_url + partner_tracking_url are populated only
  // when the linked partner's cta_mode is 'outbound_link'; both are
  // NULL for inquiry_form rentals. App-layer enforcement; the DB
  // schema is permissive so existing sale rows don't fail validation.
  partner_id: string | null;
  partner_property_url: string | null;
  partner_tracking_url: string | null;
}

// ─── Booking partners (D9) ──────────────────────────────────────────────
//
// Affiliate partners (Villanovo, Top Villas) bounce users to a tracking
// URL on the partner's site. Direct partners (boutique agencies) accept
// inquiries via our universal /rentals form, which an admin manually
// forwards. The cta_mode column drives the public booking-block render
// shape on rental detail pages independently of the type column —
// partners can in principle change cta_mode without changing type
// (e.g., a direct partner that later signs an affiliate program).

export type PartnerType = "affiliate" | "direct";
export type PartnerCtaMode = "outbound_link" | "inquiry_form";

export interface Partner {
  id: string;
  name: string;
  slug: string;
  type: PartnerType;
  cta_mode: PartnerCtaMode;
  cta_label: string;
  logo_url: string | null;
  disclosure_text: string | null;
  /** Required when cta_mode === 'inquiry_form'; admin-set placeholder otherwise. */
  forward_inquiries_to: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type AgentInquiryType = "featured" | "referral" | "other";

/**
 * Pipeline stage for inquiries. Independent of archived_at — an inquiry can
 * be won + archived simultaneously. Default for new submissions is 'new'.
 */
export type InquiryStatus = "new" | "working" | "won" | "dead";

export interface AgentInquiry {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  brokerage: string | null;
  city_state: string | null;
  inquiry_type: AgentInquiryType;
  message: string | null;
  created_at: string;
  archived_at: string | null;
  status: InquiryStatus;
  notes: string | null;
  last_contacted_at: string | null;
  status_updated_at: string;
  status_updated_by: number | null;
  // Populated via JOIN in admin queries so the UI can render "changed by X".
  status_updated_by_name: string | null;
  // Package tier selected at checkout — nullable until the Square flow
  // captures it. Canonical values: '1500' | '3750' | '5000' | 'custom'.
  tier: string | null;
}

export interface HeroPhoto {
  id: number;
  url: string;
  caption: string | null;
  display_order: number;
  active: boolean;
  created_at: string;
}

/**
 * Budget bucket the rental form collects on /rentals. Stored as TEXT at the
 * DB layer so new buckets can land without a schema migration; the public
 * form + admin UI both reference this union for option rendering.
 */
export type RentalBudgetRange =
  | "under_25k"
  | "25k_50k"
  | "50k_100k"
  | "100k_plus"
  | "flexible";

export interface RentalInquiry {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  flexible_dates: boolean;
  group_size: number | null;
  budget_range: string | null;
  occasion: string | null;
  message: string | null;
  status: InquiryStatus;
  notes: string | null;
  last_contacted_at: string | null;
  status_updated_at: string;
  status_updated_by: number | null;
  status_updated_by_name: string | null;
  archived_at: string | null;
  created_at: string;
  // Optional link back to the rental listing the inquiry was triggered
  // from. listing_id tracks the FK (nulled on listing delete);
  // listing_slug is cached alongside so the admin row still renders a
  // meaningful label when the row referenced has been taken down.
  // listing_title is joined via the admin SELECTs for display only.
  listing_id: number | null;
  listing_slug: string | null;
  listing_title: string | null;
  /**
   * Stated term intent on the public /rentals form. Null on rows that
   * predate the field (migration 014) or any future organic path that
   * doesn't surface the picker.
   */
  rental_term_preference: RentalTermPreference | null;
  // Partner attribution + manual-forwarding stamp (D9). partner_id is
  // derived server-side from the linked listing's partner_id when the
  // inquiry references a specific listing; NULL for organic
  // destination requests submitted via the global /rentals form
  // without a ?property= context. forwarded_to_partner_at is set by
  // the inbox's "Mark forwarded" admin action.
  partner_id: string | null;
  forwarded_to_partner_at: string | null;
}

/**
 * Tri-state term preference captured from /rentals. 'not_sure' is a
 * real answer — the form surfaces it explicitly so admins get signal
 * on inquiries where the renter hasn't decided yet.
 */
export type RentalTermPreference = "short_term" | "long_term" | "not_sure";

export interface Inquiry {
  id: number;
  listing_id: number | null;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  pre_approved: boolean;
  timeline: string | null;
  created_at: string;
  archived_at: string | null;
  status: InquiryStatus;
  notes: string | null;
  last_contacted_at: string | null;
  status_updated_at: string;
  status_updated_by: number | null;
  // Populated via JOIN in admin queries so the UI can render "changed by X".
  status_updated_by_name: string | null;
}
