import { NextResponse } from "next/server"
import { desc, eq, inArray } from "drizzle-orm"
import { getDbOrNull, dbSchema } from "@/lib/db"
import type { Listing, ListingFilters, User, UserRole } from "@/lib/types"
import { createListingSchema } from "@/lib/validators"

function mapType(type: string): Listing["type"] {
  return type === "found" ? "found" : "lost"
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  return new Date(0).toISOString()
}

function mapProfileToUser(profile: typeof dbSchema.profiles.$inferSelect | undefined): User | undefined {
  if (!profile) return undefined

  return {
    id: profile.userId,
    email: profile.campusEmail,
    name: profile.fullName,
    phone: profile.phone || undefined,
    role: profile.role,
    avatar_url: undefined,
    is_banned: false,
    created_at: toIsoString(profile.createdAt),
    updated_at: toIsoString(profile.createdAt),
  }
}

function mapItemToListing(
  row: typeof dbSchema.items.$inferSelect,
  profile?: typeof dbSchema.profiles.$inferSelect
): Listing {
  const imageUrls = Array.isArray(row.imageUrls)
    ? row.imageUrls.filter(
        (value: unknown): value is string => typeof value === "string" && value.length > 0
      )
    : []

  return {
    id: row.id,
    type: mapType(row.type),
    title: row.name,
    description: row.description,
    category: row.category as Listing["category"],
    location: row.location as Listing["location"],
    location_details: row.locationDetails || undefined,
    date_occurred: toIsoString(row.dateOccurred),
    status: "active",
    storage_location: row.storageLocation || undefined,
    storage_details: row.storageDetails || undefined,
    image_urls: imageUrls,
    user_id: row.createdBy,
    user: mapProfileToUser(profile),
    photos: imageUrls.map((url, index) => ({
      id: `${row.id}-photo-${index + 1}`,
      url,
      listing_id: row.id,
      created_at: toIsoString(row.createdAt),
    })),
    created_at: toIsoString(row.createdAt),
    updated_at: toIsoString(row.updatedAt),
  }
}

function applySearchFilters(listings: Listing[], filters: ListingFilters): Listing[] {
  return listings.filter((listing) => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      const hit =
        listing.title.toLowerCase().includes(q) ||
        listing.description.toLowerCase().includes(q) ||
        listing.category.toLowerCase().includes(q)
      if (!hit) return false
    }

    if (filters.type && listing.type !== filters.type) return false
    if (filters.category && listing.category !== filters.category) return false
    if (filters.location && listing.location !== filters.location) return false
    if (filters.status && filters.status !== "active") return false
    return true
  })
}

function getItemsCacheControl(userId?: string): string {
  return userId
    ? "private, max-age=10, stale-while-revalidate=30"
    : "public, max-age=30, stale-while-revalidate=120"
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

type Actor = {
  id: string
  role: UserRole
}

async function getActorFromProfile(
  db: NonNullable<ReturnType<typeof getDbOrNull>>,
  request: Request
): Promise<Actor | null> {
  const headerUserId = request.headers.get("x-user-id")?.trim()
  if (!headerUserId) return null

  const [profile] = await db
    .select({
      userId: dbSchema.profiles.userId,
      role: dbSchema.profiles.role,
    })
    .from(dbSchema.profiles)
    .where(eq(dbSchema.profiles.userId, headerUserId))
    .limit(1)

  if (!profile) return null
  return { id: profile.userId, role: profile.role }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const userId = url.searchParams.get("userId") || undefined
  const filters: ListingFilters = {
    search: url.searchParams.get("search") || undefined,
    type: (url.searchParams.get("type") as ListingFilters["type"]) || undefined,
    category: (url.searchParams.get("category") as ListingFilters["category"]) || undefined,
    location: (url.searchParams.get("location") as ListingFilters["location"]) || undefined,
    status: (url.searchParams.get("status") as ListingFilters["status"]) || undefined,
  }

  const db = getDbOrNull()
  if (!db) {
    return NextResponse.json(
      { ok: false, error: "Database not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }

  try {
    const rows = userId
      ? await db
          .select()
          .from(dbSchema.items)
          .where(eq(dbSchema.items.createdBy, userId))
          .orderBy(desc(dbSchema.items.createdAt))
      : await db.select().from(dbSchema.items).orderBy(desc(dbSchema.items.createdAt))

    const profileIds = [...new Set(rows.map((row) => row.createdBy))]
    const profiles =
      profileIds.length > 0
        ? await db
            .select()
            .from(dbSchema.profiles)
            .where(inArray(dbSchema.profiles.userId, profileIds))
        : []

    const profileMap = new Map(profiles.map((profile) => [profile.userId, profile]))

    const mapped = rows.map((row) => mapItemToListing(row, profileMap.get(row.createdBy)))

    return NextResponse.json(
      {
        ok: true,
        source: "supabase-postgres-drizzle",
        data: applySearchFilters(mapped, filters),
      },
      { headers: { "Cache-Control": getItemsCacheControl(userId) } }
    )
  } catch (error) {
    console.error("[api/items][GET] failed", error)
    return NextResponse.json(
      { ok: false, error: "Failed to load items" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}

type CreateItemRequestBody = {
  type: Listing["type"]
  title: string
  description: string
  category: Listing["category"]
  location: Listing["location"]
  location_details?: string
  date_occurred: string
  storage_location?: string
  storage_details?: string
  user_id: string
  user?: Pick<User, "id" | "email" | "name" | "role" | "phone" | "avatar_url">
  photoUrls?: string[]
}

export async function POST(request: Request) {
  let body: CreateItemRequestBody
  try {
    body = (await request.json()) as CreateItemRequestBody
  } catch {
    return jsonError("Invalid JSON body")
  }

  const parsed = createListingSchema.safeParse({
    type: body.type,
    title: body.title,
    description: body.description,
    category: body.category,
    location: body.location,
    location_details: body.location_details ?? "",
    date_occurred: body.date_occurred,
    storage_location: body.storage_location ?? "",
    storage_details: body.storage_details ?? "",
  })

  if (!parsed.success) {
    const first = parsed.error.errors[0]?.message ?? "Invalid item payload"
    return jsonError(first, 422)
  }

  if (!body.user_id?.trim()) return jsonError("user_id is required", 422)
  const requestUserId = body.user_id.trim()

  const db = getDbOrNull()
  if (!db) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Database not configured. This endpoint requires SUPABASE_DB_URL to be set.",
      },
      { status: 503 }
    )
  }

  try {
    const actor = await getActorFromProfile(db, request)
    if (!actor) return jsonError("Unauthorized", 401)
    if (actor.id !== requestUserId) return jsonError("Forbidden", 403)
    const enableFoundReportForStudents =
      process.env.NEXT_PUBLIC_ENABLE_FOUND_REPORT === "true"

    const now = new Date()

    const [creatorProfile] = await db
      .select()
      .from(dbSchema.profiles)
      .where(eq(dbSchema.profiles.userId, actor.id))
      .limit(1)

    if (!creatorProfile) {
      return jsonError("Profile not found for this user. Complete registration first.", 422)
    }

    if (
      parsed.data.type === "found" &&
      actor.role === "student" &&
      !enableFoundReportForStudents
    ) {
      return jsonError("Found-item reporting is currently unavailable for students", 403)
    }

    const urls = Array.isArray(body.photoUrls)
      ? body.photoUrls.filter((url): url is string => typeof url === "string" && url.length > 0)
      : []

    const [created] = await db
      .insert(dbSchema.items)
      .values({
        type: parsed.data.type,
        name: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category,
        location: parsed.data.location,
        locationDetails: parsed.data.location_details || null,
        dateOccurred: new Date(parsed.data.date_occurred),
        storageLocation: parsed.data.storage_location || null,
        storageDetails: parsed.data.storage_details || null,
        imageUrls: urls,
        createdBy: actor.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    const responseItem = mapItemToListing(created, creatorProfile)

    return NextResponse.json({
      ok: true,
      source: "supabase-postgres-drizzle",
      data: responseItem,
    })
  } catch (error) {
    console.error("[api/items][POST] failed", error)
    return NextResponse.json({ ok: false, error: "Failed to create item" }, { status: 500 })
  }
}
