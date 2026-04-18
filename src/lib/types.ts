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
  submitted_at: string | null;
  published_at: string | null;
  reviewed_by_user_id: number | null;
  created_by_user_id: number | null;
  created_at: string;
  updated_at: string;
}

export type AgentInquiryType = "featured" | "referral" | "other";

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
}

export interface HeroPhoto {
  id: number;
  url: string;
  caption: string | null;
  display_order: number;
  active: boolean;
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
}
