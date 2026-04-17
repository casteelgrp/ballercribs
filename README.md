# BallerCribs

Editorial luxury real estate listings platform. Next.js 15 + Vercel Postgres + Tailwind.

## MVP scope

- Homepage with hero + featured listings grid
- `/listings` full grid
- `/listings/[slug]` individual listing pages with photo gallery + inquire form
- `/admin` password-gated dashboard to add listings and view inquiries
- Inquiries saved to Postgres + real-time email via Resend

Out of scope for v1 (add later): agent self-serve uploads, payments, user accounts, saved searches, map view.

## Setup

### 1. Local dev

```bash
npm install
cp .env.example .env.local
# Fill in values (see below)
npm run dev
```

### 2. Vercel setup

1. Push repo to GitHub, import into Vercel.
2. In the Vercel dashboard → **Storage**, create a **Postgres** database and attach it to the project. This auto-populates all `POSTGRES_*` env vars.
3. (Optional, for image uploads later) Create a **Blob** store and attach it. This auto-populates `BLOB_READ_WRITE_TOKEN`.
4. In **Settings → Environment Variables**, set:
   - `ADMIN_PASSWORD` — pick something strong
   - `ADMIN_SESSION_SECRET` — random 32+ char string (run `openssl rand -hex 32`)
   - `RESEND_API_KEY` — from resend.com
   - `INQUIRY_NOTIFICATION_EMAIL` — where inquiry alerts go (your inbox)
   - `INQUIRY_FROM_EMAIL` — must be a verified domain in Resend, or `onboarding@resend.dev` to start
   - `NEXT_PUBLIC_SITE_URL` — your production URL

### 3. Initialize the database

After the Postgres DB is attached and env vars are pulled locally:

```bash
vercel env pull .env.local   # pulls Vercel env into local .env.local
npm run db:init              # creates listings + inquiries tables
```

You only run this once (or again if you need to recreate tables).

### 4. Add your first listing

Deploy, then visit `https://your-domain.vercel.app/admin/login`, enter `ADMIN_PASSWORD`, and add a listing.

For images, paste URLs from anywhere — agent sites, Unsplash, or upload to Vercel Blob and paste the public URL. (v2 will add an upload button in the admin.)

## Project structure

```
src/
  app/
    page.tsx                        # homepage
    layout.tsx                      # shell with nav + footer
    listings/
      page.tsx                      # all listings grid
      [slug]/page.tsx               # individual listing
    admin/
      page.tsx                      # dashboard (auth-gated)
      login/page.tsx                # password login form
    api/
      inquiries/route.ts            # public POST endpoint
      listings/route.ts             # admin-only POST endpoint
      admin/login/route.ts
      admin/logout/route.ts
  components/
    ListingCard.tsx
    InquireForm.tsx                 # client
    NewListingForm.tsx              # client (admin)
  lib/
    db.ts                           # Postgres queries
    types.ts
    auth.ts                         # HMAC-signed cookie sessions
    email.ts                        # Resend notifications
    format.ts                       # price/slug helpers
scripts/
  init-db.ts                        # run once to create tables
```

## Things to do after launch

- Hook up custom domain (monitoring ballercribs.com — if acquired, add via Vercel domains)
- Replace placeholder `jay@example.com` on homepage + `layout.tsx` with real contact email
- Update `NEXT_PUBLIC_SITE_URL` and newsletter link in `layout.tsx`
- Verify a sending domain in Resend so emails don't come from `onboarding@resend.dev`
- Add Plausible or Vercel Analytics

## Driving traffic from Instagram

- The homepage CTA is tuned for a cold visitor from a carousel — it explains what this is and where they've seen it.
- Individual listing pages are share-friendly (OG tags set in `generateMetadata`). Put the direct listing URL in your Instagram bio link (via Beacons) when a specific property is viral.
- Add a UTM param like `?utm_source=ig&utm_medium=bio&utm_campaign=bel_air_estate` for attribution.

## Adding agent self-serve later (v2)

When you're ready: add a `users` table, Stripe for featured-listing payments, and an `/agents/submit` flow that creates an unpublished listing which you review from the admin before flipping `published = TRUE`.
