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
