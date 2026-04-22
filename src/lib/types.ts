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
}

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
