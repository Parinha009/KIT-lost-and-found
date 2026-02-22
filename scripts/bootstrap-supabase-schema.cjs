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

  const connectionString = process.env.SUPABASE_DB_URL || ""

  if (!connectionString) {
    console.error(
      "Missing database connection string. Set SUPABASE_DB_URL in .env.local."
    )
    process.exitCode = 1
    return
  }

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
      statement_timeout: 120_000,
    },
  })

  console.log("Bootstrapping Supabase schema (public.*)...")

  try {
    await sql`create extension if not exists pgcrypto`

    // Enums used by legacy/public tables.
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

    // Keep legacy tables available while we cut over to public.items.
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

    // Profiles table (owner identity + role source for items).
    await sql`
      create table if not exists public.profiles (
        user_id uuid not null,
        full_name text not null,
        campus_email text not null,
        phone text null,
        role text not null default 'student',
        created_at timestamptz not null default now(),
        constraint profiles_pkey primary key (user_id),
        constraint profiles_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
        constraint profiles_role_check check (role = any (array['student'::text, 'staff'::text, 'admin'::text])),
        constraint profiles_campus_email_kit_check check (campus_email ~* '^[A-Z0-9._%+-]+@kit\\.edu\\.kh$')
      )
    `
    await sql`create unique index if not exists profiles_campus_email_lower_key on public.profiles using btree (lower(campus_email))`

    // New canonical items table.
    await sql`
      create table if not exists public.items (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        type text not null check (type in ('lost', 'found')),
        description text not null,
        category text not null,
        location text not null,
        location_details text null,
        date_occurred timestamptz not null,
        storage_location text null,
        storage_details text null,
        image_urls text[] not null default '{}'::text[],
        created_by uuid not null references public.profiles(user_id) on delete restrict,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `
    await sql`create index if not exists items_created_by_idx on public.items(created_by)`
    await sql`create index if not exists items_type_idx on public.items(type)`
    await sql`create index if not exists items_created_at_idx on public.items(created_at desc)`

    // Security hardening: public.items is exposed via PostgREST; enforce RLS and block direct anon/auth access.
    await sql`alter table public.items enable row level security`
    await sql`
      do $$
      begin
        if exists (select 1 from pg_roles where rolname = 'anon') then
          execute 'revoke all on table public.items from anon';
        end if;
        if exists (select 1 from pg_roles where rolname = 'authenticated') then
          execute 'revoke all on table public.items from authenticated';
        end if;
      end $$;
    `

    // Backfill profiles from legacy users table (idempotent).
    await sql`
      insert into public.profiles (user_id, full_name, campus_email, phone, role, created_at)
      select
        u.id,
        coalesce(nullif(trim(u.name), ''), split_part(lower(u.email), '@', 1)) as full_name,
        lower(u.email) as campus_email,
        u.phone,
        case
          when u.role::text in ('student', 'staff', 'admin') then u.role::text
          else 'student'
        end as role,
        coalesce(u.created_at, now()) as created_at
      from public.users u
      inner join auth.users au on au.id = u.id
      where lower(u.email) ~ '^[a-z0-9._%+-]+@kit\\.edu\\.kh$'
      on conflict (user_id) do nothing
    `

    // Copy listings data into items (preserve ids for claims/notifications migration).
    await sql`
      insert into public.items (
        id,
        name,
        type,
        description,
        category,
        location,
        location_details,
        date_occurred,
        storage_location,
        storage_details,
        image_urls,
        created_by,
        created_at,
        updated_at
      )
      select
        l.id,
        l.title,
        l.type::text,
        l.description,
        l.category,
        l.location,
        l.location_details,
        l.date_occurred,
        l.storage_location,
        l.storage_details,
        coalesce(l.image_urls, '{}'::text[]),
        l.user_id,
        coalesce(l.created_at, now()),
        coalesce(l.updated_at, now())
      from public.listings l
      inner join public.profiles p on p.user_id = l.user_id
      on conflict (id) do update
      set
        name = excluded.name,
        type = excluded.type,
        description = excluded.description,
        category = excluded.category,
        location = excluded.location,
        location_details = excluded.location_details,
        date_occurred = excluded.date_occurred,
        storage_location = excluded.storage_location,
        storage_details = excluded.storage_details,
        image_urls = excluded.image_urls,
        created_by = excluded.created_by,
        updated_at = excluded.updated_at
    `

    await sql`
      delete from public.claims c
      where not exists (
        select 1 from public.items i where i.id = c.listing_id
      )
    `

    // Re-link claims.listing_id foreign key to public.items(id).
    await sql`
      do $$
      declare
        listing_attnum int;
        fk record;
      begin
        select a.attnum into listing_attnum
        from pg_attribute a
        where a.attrelid = 'public.claims'::regclass
          and a.attname = 'listing_id'
          and not a.attisdropped;

        if listing_attnum is not null then
          for fk in
            select conname
            from pg_constraint
            where conrelid = 'public.claims'::regclass
              and contype = 'f'
              and array_position(conkey, listing_attnum) is not null
          loop
            execute format('alter table public.claims drop constraint %I', fk.conname);
          end loop;

          alter table public.claims
            add constraint claims_listing_id_items_fkey
            foreign key (listing_id) references public.items(id) on delete cascade;
        end if;
      end $$;
    `

    // Re-link notifications.related_listing_id to public.items(id).
    await sql`
      do $$
      declare
        related_attnum int;
        fk record;
      begin
        select a.attnum into related_attnum
        from pg_attribute a
        where a.attrelid = 'public.notifications'::regclass
          and a.attname = 'related_listing_id'
          and not a.attisdropped;

        if related_attnum is not null then
          update public.notifications n
          set related_listing_id = null
          where related_listing_id is not null
            and not exists (
              select 1 from public.items i where i.id = n.related_listing_id
            );

          for fk in
            select conname
            from pg_constraint
            where conrelid = 'public.notifications'::regclass
              and contype = 'f'
              and array_position(conkey, related_attnum) is not null
          loop
            execute format('alter table public.notifications drop constraint %I', fk.conname);
          end loop;

          alter table public.notifications
            add constraint notifications_related_listing_id_items_fkey
            foreign key (related_listing_id) references public.items(id) on delete set null;
        end if;
      end $$;
    `

    console.log(
      "Done. Tables are ready: users, profiles, items, claims, notifications (listings kept for compatibility)."
    )

    // Supabase Storage bucket (optional, but required for real image uploads).
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
