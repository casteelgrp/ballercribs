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
  gallery_image_urls: string[];
  agent_name: string | null;
  agent_brokerage: string | null;
  featured: boolean;
  published: boolean;
  created_at: string;
  updated_at: string;
  created_by_user_id: number | null;
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
}
