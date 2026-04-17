import { sql } from "@vercel/postgres";
import type { Listing, Inquiry, User, UserWithHash, UserRole } from "./types";

function rowToListing(row: any): Listing {
  return {
    ...row,
    price_usd: Number(row.price_usd),
    bathrooms: row.bathrooms !== null ? Number(row.bathrooms) : null,
    gallery_image_urls: Array.isArray(row.gallery_image_urls) ? row.gallery_image_urls : [],
    created_by_user_id:
      row.created_by_user_id !== null && row.created_by_user_id !== undefined
        ? Number(row.created_by_user_id)
        : null
  };
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

export async function getAdminListingsWithCreators(): Promise<
  (Listing & { creator_name: string | null })[]
> {
  const { rows } = await sql`
    SELECT l.*, u.name AS creator_name
    FROM listings l
    LEFT JOIN users u ON u.id = l.created_by_user_id
    ORDER BY l.featured DESC, l.created_at DESC;
  `;
  return rows.map((r: any) => ({ ...rowToListing(r), creator_name: r.creator_name ?? null }));
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
  created_by_user_id: number | null;
}

export async function createListing(data: CreateListingInput): Promise<Listing> {
  const { rows } = await sql`
    INSERT INTO listings (
      slug, title, location, price_usd, bedrooms, bathrooms, square_feet,
      description, hero_image_url, gallery_image_urls, agent_name,
      agent_brokerage, featured, created_by_user_id
    ) VALUES (
      ${data.slug}, ${data.title}, ${data.location}, ${data.price_usd},
      ${data.bedrooms}, ${data.bathrooms}, ${data.square_feet},
      ${data.description}, ${data.hero_image_url},
      ${JSON.stringify(data.gallery_image_urls)}::jsonb,
      ${data.agent_name}, ${data.agent_brokerage}, ${data.featured},
      ${data.created_by_user_id}
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

export async function getRecentInquiries(
  limit = 50
): Promise<(Inquiry & { listing_title: string | null })[]> {
  const { rows } = await sql`
    SELECT i.*, l.title AS listing_title
    FROM inquiries i
    LEFT JOIN listings l ON l.id = i.listing_id
    ORDER BY i.created_at DESC
    LIMIT ${limit};
  `;
  return rows as (Inquiry & { listing_title: string | null })[];
}

// ─── Users ─────────────────────────────────────────────────────────────────

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
