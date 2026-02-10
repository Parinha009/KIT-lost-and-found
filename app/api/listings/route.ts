import { NextResponse } from "next/server"
import { desc, inArray, eq } from "drizzle-orm"
import { getDbOrNull, dbSchema } from "@/lib/db"
import type { Listing, ListingFilters, User } from "@/lib/types"
import { createListingSchema } from "@/lib/validators"

function mapStatus(status: string): Listing["status"] {
  if (
    status === "active" ||
    status === "matched" ||
    status === "claimed" ||
    status === "closed" ||
    status === "archived"
  ) {
    return status
  }
  return "active"
}

function mapType(type: string): Listing["type"] {
  return type === "found" ? "found" : "lost"
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
    if (filters.status && listing.status !== filters.status) return false
    return true
  })
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
      { status: 503 }
    )
  }

  try {
    const where = userId ? eq(dbSchema.listings.userId, userId) : undefined

    const rows = await db.select().from(dbSchema.listings).where(where).orderBy(desc(dbSchema.listings.createdAt))

    const photoRows = await db.select().from(dbSchema.photos)
    const userIds = [...new Set(rows.map((row) => row.userId))]
    const users =
      userIds.length > 0
        ? await db.select().from(dbSchema.users).where(inArray(dbSchema.users.id, userIds))
        : []

    const userMap = new Map(users.map((user) => [user.id, user]))
    const photosByListing = new Map<string, typeof photoRows>()

    photoRows.forEach((photo) => {
      const list = photosByListing.get(photo.listingId) ?? []
      list.push(photo)
      photosByListing.set(photo.listingId, list)
    })

    const mapped: Listing[] = rows.map((row) => {
      const rowUser = userMap.get(row.userId)

      return {
        id: row.id,
        type: mapType(row.type),
        title: row.title,
        description: row.description,
        category: row.category as Listing["category"],
        location: row.location as Listing["location"],
        location_details: row.locationDetails || undefined,
        date_occurred: row.dateOccurred.toISOString(),
        status: mapStatus(row.status),
        storage_location: row.storageLocation || undefined,
        storage_details: row.storageDetails || undefined,
        matched_listing_id: row.matchedListingId || undefined,
        image_urls: Array.isArray(row.imageUrls)
          ? row.imageUrls.filter(
              (value: unknown): value is string => typeof value === "string" && value.length > 0
            )
          : [],
        user_id: row.userId,
        user: rowUser
          ? {
              id: rowUser.id,
              email: rowUser.email,
              name: rowUser.name,
              phone: rowUser.phone || undefined,
              role: rowUser.role,
              avatar_url: rowUser.avatarUrl || undefined,
              is_banned: rowUser.isBanned,
              created_at: rowUser.createdAt.toISOString(),
              updated_at: rowUser.updatedAt.toISOString(),
            }
          : undefined,
        photos: (photosByListing.get(row.id) ?? []).map((photo) => ({
          id: photo.id,
          url: photo.url,
          listing_id: photo.listingId,
          created_at: photo.createdAt.toISOString(),
        })),
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
      }
    })

    return NextResponse.json({
      ok: true,
      source: "supabase-postgres-drizzle",
      data: applySearchFilters(mapped, filters),
    })
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to load listings" }, { status: 500 })
  }
}

type CreateListingRequestBody = {
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

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export async function POST(request: Request) {
  let body: CreateListingRequestBody
  try {
    body = (await request.json()) as CreateListingRequestBody
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
    const first = parsed.error.errors[0]?.message ?? "Invalid listing payload"
    return jsonError(first, 422)
  }

  if (!body.user_id?.trim()) return jsonError("user_id is required", 422)

  const db = getDbOrNull()
  if (!db) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Database not configured. This endpoint requires SUPABASE_DB_URL/DATABASE_URL to be set.",
      },
      { status: 503 }
    )
  }

  try {
    const now = new Date()

    const user = body.user
    const role = user?.role

    if (parsed.data.type === "found" && role !== "staff" && role !== "admin") {
      return jsonError("Only staff can register found items", 403)
    }

    if (user?.id && user.email && user.name && user.role) {
      const existing = await db
        .select({ id: dbSchema.users.id })
        .from(dbSchema.users)
        .where(eq(dbSchema.users.id, user.id))
        .limit(1)

      if (existing.length === 0) {
        await db.insert(dbSchema.users).values({
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone ?? null,
          role: user.role,
          avatarUrl: user.avatar_url ?? null,
          isBanned: false,
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    const urls = Array.isArray(body.photoUrls)
      ? body.photoUrls.filter((url): url is string => typeof url === "string" && url.length > 0)
      : []

    const [created] = await db
      .insert(dbSchema.listings)
      .values({
        type: parsed.data.type,
        title: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category,
        location: parsed.data.location,
        locationDetails: parsed.data.location_details || null,
        dateOccurred: new Date(parsed.data.date_occurred),
        status: "active",
        storageLocation: parsed.data.storage_location || null,
        storageDetails: parsed.data.storage_details || null,
        userId: body.user_id,
        matchedListingId: null,
        imageUrls: urls,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    const createdPhotos =
      urls.length > 0
        ? await db
            .insert(dbSchema.photos)
            .values(
              urls.map((url) => ({
                url,
                listingId: created.id,
                createdAt: now,
              }))
            )
            .returning()
        : []

    const listingUser = user?.id === body.user_id ? user : undefined

    const responseListing: Listing = {
      id: created.id,
      type: mapType(created.type),
      title: created.title,
      description: created.description,
      category: created.category as Listing["category"],
      location: created.location as Listing["location"],
      location_details: created.locationDetails || undefined,
      date_occurred: created.dateOccurred.toISOString(),
      status: mapStatus(created.status),
      storage_location: created.storageLocation || undefined,
      storage_details: created.storageDetails || undefined,
      matched_listing_id: created.matchedListingId || undefined,
      image_urls: urls,
      user_id: created.userId,
      user: listingUser
        ? {
            id: listingUser.id,
            email: listingUser.email,
            name: listingUser.name,
            phone: listingUser.phone || undefined,
            role: listingUser.role,
            avatar_url: listingUser.avatar_url || undefined,
            is_banned: false,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
          }
        : undefined,
      photos: createdPhotos.map((photo) => ({
        id: photo.id,
        url: photo.url,
        listing_id: photo.listingId,
        created_at: photo.createdAt.toISOString(),
      })),
      created_at: created.createdAt.toISOString(),
      updated_at: created.updatedAt.toISOString(),
    }

    return NextResponse.json({
      ok: true,
      source: "supabase-postgres-drizzle",
      data: responseListing,
    })
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to create listing" }, { status: 500 })
  }
}
