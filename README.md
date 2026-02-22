# KIT Lost and Found System

Frontend UI for the KIT Lost and Found web application.
Built with Next.js + Tailwind CSS + shadcn/ui.

## Technology Stack Alignment (SRS)

- Frontend + Backend framework: Next.js (App Router)
- Database/Auth provider target: Supabase (PostgreSQL + Auth)
- Image storage target: Supabase Storage (`listing-images` bucket)

### Current status

- Frontend is active and stable.
- `lib/upload-adapter.ts` uploads listing images to Supabase Storage (`listing-images` bucket).
- Supabase environment contract is defined in `.env.example` and `lib/services/supabase-config.ts`.

## Supabase + Drizzle Setup

This project now includes server-side database connectivity scaffolding using Drizzle ORM.

- Drizzle schema: `lib/db/schema.ts`
- Drizzle client: `lib/db/client.ts`
- DB health endpoint: `app/api/health/db/route.ts`
- Items API endpoint (DB-backed): `app/api/items/route.ts`
- Drizzle config: `drizzle.config.ts`

### Required environment variables

- `SUPABASE_DB_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Commands

- `pnpm db:generate`
- `pnpm db:push`
- `pnpm db:studio`

## Seed Demo Items (Run Once)

To pre-populate the database with the 6 demo items (AirPods, iPhone, Student ID, etc.) and store their images in Supabase Storage:

1. Ensure your env vars are set in `.env.local`:
   - `SUPABASE_DB_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (required for Storage uploads)
2. Bootstrap schema and bucket (idempotent):
   - `pnpm db:bootstrap`
3. Seed demo data (idempotent):
   - `pnpm db:seed`

After seeding, refresh the app and the demo items should appear in Browse and My Listings with images.

