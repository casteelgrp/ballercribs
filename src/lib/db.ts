import { sql } from "@vercel/postgres";
import type { Listing, Inquiry } from "./types";

function rowToListing(row: any): Listing {
  return {
    ...row,
    price_usd: Number(row.price_usd),
    bathrooms: row.bathrooms !== null ? Number(row.bathrooms) : null,
    gallery_image_urls: Array.isArray(row.gallery_image_urls) ? row.gallery_image_urls : []
  };
}

export async function getAllListings(): Promise<Listing[]> {
  const { rows } = await sql`
    SELECT * FROM listings
    WHERE published = TRUE
    ORDER BY featured DESC, created_at DESC;
  `;
  return rows.map(rowToListing);
}

export async function getFeaturedListings(limit = 6): Promise<Listing[]> {
  const { rows } = await sql`
    SELECT * FROM listings
    WHERE published = TRUE
    ORDER BY featured DESC, created_at DESC
    LIMIT ${limit};
  `;
  return rows.map(rowToListing);
}

export async function getListingBySlug(slug: string): Promise<Listing | null> {
  const { rows } = await sql`
    SELECT * FROM listings WHERE slug = ${slug} AND published = TRUE LIMIT 1;
  `;
  return rows[0] ? rowToListing(rows[0]) : null;
}

export async function getListingById(id: number): Promise<Listing | null> {
  const { rows } = await sql`SELECT * FROM listings WHERE id = ${id} LIMIT 1;`;
  return rows[0] ? rowToListing(rows[0]) : null;
}

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
  gallery_image_urls: string[];
  agent_name: string | null;
  agent_brokerage: string | null;
  featured: boolean;
}

export async function createListing(data: CreateListingInput): Promise<Listing> {
  const { rows } = await sql`
    INSERT INTO listings (
      slug, title, location, price_usd, bedrooms, bathrooms, square_feet,
      description, hero_image_url, gallery_image_urls, agent_name,
      agent_brokerage, featured
    ) VALUES (
      ${data.slug}, ${data.title}, ${data.location}, ${data.price_usd},
      ${data.bedrooms}, ${data.bathrooms}, ${data.square_feet},
      ${data.description}, ${data.hero_image_url},
      ${JSON.stringify(data.gallery_image_urls)}::jsonb,
      ${data.agent_name}, ${data.agent_brokerage}, ${data.featured}
    )
    RETURNING *;
  `;
  return rowToListing(rows[0]);
}

export async function deleteListing(id: number): Promise<void> {
  await sql`DELETE FROM listings WHERE id = ${id};`;
}

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

export async function getRecentInquiries(limit = 50): Promise<(Inquiry & { listing_title: string | null })[]> {
  const { rows } = await sql`
    SELECT i.*, l.title AS listing_title
    FROM inquiries i
    LEFT JOIN listings l ON l.id = i.listing_id
    ORDER BY i.created_at DESC
    LIMIT ${limit};
  `;
  return rows as (Inquiry & { listing_title: string | null })[];
}
