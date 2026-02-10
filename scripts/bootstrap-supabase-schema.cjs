/* eslint-disable no-console */

const fs = require("node:fs")
const path = require("node:path")

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return

  const content = fs.readFileSync(filePath, "utf8")
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    const index = line.indexOf("=")
    if (index === -1) continue

    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()

    if (!key) continue
    if (value.startsWith("export ")) value = value.slice("export ".length).trim()

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) process.env[key] = value
  }
}

async function main() {
  const root = process.cwd()
  loadDotEnv(path.join(root, ".env.local"))
  loadDotEnv(path.join(root, ".env"))

  const connectionString =
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    ""

  if (!connectionString) {
    console.error(
      "Missing database connection string. Set SUPABASE_DB_URL, DATABASE_URL, or POSTGRES_URL in .env.local."
    )
    process.exitCode = 1
    return
  }

  // Lazy import so the script still loads even if dependencies are missing.
  // (postgres is already a runtime dependency of the app.)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const postgres = require("postgres")

  const sql = postgres(connectionString, {
    ssl: "require",
    max: 1,
    connect_timeout: 15,
    idle_timeout: 10,
    prepare: false,
    connection: {
      application_name: "kit-lost-and-found-bootstrap",
      statement_timeout: 30_000,
    },
  })

  console.log("Bootstrapping Supabase schema (public.*)...")

  try {
    await sql`create extension if not exists pgcrypto`

    // Enums
    await sql`
      do $$ begin
        create type user_role as enum ('student', 'staff', 'admin');
      exception
        when duplicate_object then null;
      end $$;
    `
    await sql`
      do $$ begin
        create type listing_type as enum ('lost', 'found');
      exception
        when duplicate_object then null;
      end $$;
    `
    await sql`
      do $$ begin
        create type listing_status as enum ('active', 'matched', 'claimed', 'closed', 'archived');
      exception
        when duplicate_object then null;
      end $$;
    `
    await sql`
      do $$ begin
        create type claim_status as enum ('pending', 'approved', 'rejected');
      exception
        when duplicate_object then null;
      end $$;
    `
    await sql`
      do $$ begin
        create type notification_type as enum ('match', 'claim_submitted', 'claim_approved', 'claim_rejected', 'system');
      exception
        when duplicate_object then null;
      end $$;
    `

    // Tables
    await sql`
      create table if not exists public.users (
        id uuid primary key default gen_random_uuid(),
        email text not null unique,
        name text not null,
        phone text,
        role user_role not null default 'student',
        avatar_url text,
        is_banned boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `

    await sql`
      create table if not exists public.listings (
        id uuid primary key default gen_random_uuid(),
        type listing_type not null,
        title text not null,
        description text not null,
        category text not null,
        location text not null,
        location_details text,
        date_occurred timestamptz not null,
        status listing_status not null default 'active',
        storage_location text,
        storage_details text,
        user_id uuid not null references public.users(id) on delete restrict,
        matched_listing_id uuid references public.listings(id) on delete set null,
        image_urls text[] not null default '{}'::text[],
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `

    // Keep schema forward-compatible if the table was created before these columns existed.
    await sql`
      alter table public.listings
        add column if not exists matched_listing_id uuid references public.listings(id) on delete set null
    `
    await sql`
      alter table public.listings
        add column if not exists image_urls text[] not null default '{}'::text[]
    `
    await sql`create index if not exists listings_user_id_idx on public.listings(user_id)`

    await sql`
      create table if not exists public.photos (
        id uuid primary key default gen_random_uuid(),
        url text not null,
        listing_id uuid not null references public.listings(id) on delete cascade,
        created_at timestamptz not null default now()
      )
    `
    await sql`create index if not exists photos_listing_id_idx on public.photos(listing_id)`

    await sql`
      create table if not exists public.claims (
        id uuid primary key default gen_random_uuid(),
        listing_id uuid not null references public.listings(id) on delete cascade,
        claimant_id uuid not null references public.users(id) on delete restrict,
        reviewer_id uuid references public.users(id) on delete set null,
        status claim_status not null default 'pending',
        proof_description text not null,
        proof_photos jsonb not null default '[]'::jsonb,
        rejection_reason text,
        handover_at timestamptz,
        handover_notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `
    await sql`create index if not exists claims_listing_id_idx on public.claims(listing_id)`
    await sql`create index if not exists claims_claimant_id_idx on public.claims(claimant_id)`

    await sql`
      create table if not exists public.notifications (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references public.users(id) on delete cascade,
        type notification_type not null,
        title text not null,
        message text not null,
        is_read boolean not null default false,
        related_listing_id uuid references public.listings(id) on delete set null,
        related_claim_id uuid references public.claims(id) on delete set null,
        created_at timestamptz not null default now()
      )
    `
    await sql`create index if not exists notifications_user_id_idx on public.notifications(user_id)`

    console.log("Done. Tables are ready: users, listings, photos, claims, notifications.")

    // Supabase Storage bucket (optional, but required for real image uploads).
    // This uses the Postgres connection, so it does not require the service role key.
    try {
      const bucketName = "listing-images"
      const [{ exists }] =
        await sql`select to_regclass('storage.buckets') is not null as exists`

      if (exists) {
        await sql`
          insert into storage.buckets (id, name, public)
          values (${bucketName}, ${bucketName}, true)
          on conflict (id) do update
          set name = excluded.name, public = excluded.public
        `
        console.log(`Done. Storage bucket is ready: storage.buckets("${bucketName}") (public).`)
      } else {
        console.log(
          'Storage bucket not created (storage.buckets table missing). Create bucket "listing-images" manually in Supabase Storage.'
        )
      }
    } catch (error) {
      console.log(
        'Storage bucket not created. Create bucket "listing-images" manually in Supabase Storage.'
      )
      console.log(String(error))
    }
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
