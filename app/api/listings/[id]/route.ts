import { NextResponse } from "next/server"
import { and, desc, eq } from "drizzle-orm"
import { getDbOrNull, dbSchema } from "@/lib/db"
import type { Listing, User, UserRole } from "@/lib/types"

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

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

function isUserRole(value: string | null): value is UserRole {
  return value === "student" || value === "staff" || value === "admin"
}

function getActor(request: Request): { id: string; role: UserRole } | null {
  const id = request.headers.get("x-user-id")
  const role = request.headers.get("x-user-role")
  if (!id || !isUserRole(role)) return null
  return { id, role }
}

type UpdateListingBody = {
  title?: string
  description?: string
  category?: Listing["category"]
  location?: Listing["location"]
  location_details?: string
  date_occurred?: string
  status?: Listing["status"]
  storage_location?: string
  storage_details?: string
  photoUrls?: string[]
  matched_listing_id?: string
}

async function getListingById(id: string): Promise<Listing | null> {
  const db = getDbOrNull()
  if (!db) return null

  const [row] = await db
    .select()
    .from(dbSchema.listings)
    .where(eq(dbSchema.listings.id, id))
    .limit(1)

  if (!row) return null

  const [rowUser] = await db
    .select()
    .from(dbSchema.users)
    .where(eq(dbSchema.users.id, row.userId))
    .limit(1)

  const photos = await db
    .select()
    .from(dbSchema.photos)
    .where(eq(dbSchema.photos.listingId, row.id))
    .orderBy(desc(dbSchema.photos.createdAt))

  const user: User | undefined = rowUser
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
    : undefined

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
    user,
    photos: photos.map((photo) => ({
      id: photo.id,
      url: photo.url,
      listing_id: photo.listingId,
      created_at: photo.createdAt.toISOString(),
    })),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!id) return jsonError("Missing listing id", 422)

  const db = getDbOrNull()
  if (!db) {
    return jsonError("Database not configured", 503)
  }

  const listing = await getListingById(id)
  if (!listing) return jsonError("Listing not found", 404)

  return NextResponse.json({ ok: true, data: listing })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!id) return jsonError("Missing listing id", 422)

  const db = getDbOrNull()
  if (!db) return jsonError("Database not configured", 503)

  const actor = getActor(request)
  if (!actor) return jsonError("Unauthorized", 401)

  let body: UpdateListingBody
  try {
    body = (await request.json()) as UpdateListingBody
  } catch {
    return jsonError("Invalid JSON body")
  }

  const now = new Date()

  const [existing] = await db
    .select({
      id: dbSchema.listings.id,
      userId: dbSchema.listings.userId,
      status: dbSchema.listings.status,
    })
    .from(dbSchema.listings)
    .where(eq(dbSchema.listings.id, id))
    .limit(1)

  if (!existing) return jsonError("Listing not found", 404)

  const isOwner = existing.userId === actor.id
  const isStaffOrAdmin = actor.role === "staff" || actor.role === "admin"
  const canEditFields = (isOwner && existing.status === "active") || isStaffOrAdmin

  const update: Record<string, unknown> = { updatedAt: now }

  if (typeof body.title === "string") {
    if (!canEditFields) return jsonError("Forbidden", 403)
    update.title = body.title.trim()
  }
  if (typeof body.description === "string") {
    if (!canEditFields) return jsonError("Forbidden", 403)
    update.description = body.description.trim()
  }
  if (typeof body.category === "string") {
    if (!canEditFields) return jsonError("Forbidden", 403)
    update.category = body.category
  }
  if (typeof body.location === "string") {
    if (!canEditFields) return jsonError("Forbidden", 403)
    update.location = body.location
  }
  if (typeof body.location_details === "string") {
    if (!canEditFields) return jsonError("Forbidden", 403)
    update.locationDetails = body.location_details.trim() || null
  }
  if (typeof body.storage_location === "string") {
    if (!isStaffOrAdmin) return jsonError("Forbidden", 403)
    update.storageLocation = body.storage_location.trim() || null
  }
  if (typeof body.storage_details === "string") {
    if (!isStaffOrAdmin) return jsonError("Forbidden", 403)
    update.storageDetails = body.storage_details.trim() || null
  }
  if (typeof body.date_occurred === "string") {
    if (!canEditFields) return jsonError("Forbidden", 403)
    update.dateOccurred = new Date(body.date_occurred)
  }
  if (typeof body.status === "string") {
    if (!isStaffOrAdmin) return jsonError("Forbidden", 403)
    update.status = body.status
  }

  if (typeof body.matched_listing_id === "string") {
    if (!isStaffOrAdmin) return jsonError("Forbidden", 403)
    update.matchedListingId = body.matched_listing_id.trim() || null
  }

  try {
    // Special case: if staff marks this as matched, link the other listing too.
    if (
      body.status === "matched" &&
      typeof body.matched_listing_id === "string" &&
      body.matched_listing_id.trim()
    ) {
      const otherId = body.matched_listing_id.trim()
      const [other] = await db
        .select({ id: dbSchema.listings.id })
        .from(dbSchema.listings)
        .where(eq(dbSchema.listings.id, otherId))
        .limit(1)

      if (!other) return jsonError("Matched listing not found", 404)

      await db
        .update(dbSchema.listings)
        .set({ status: "matched", matchedListingId: otherId, updatedAt: now })
        .where(eq(dbSchema.listings.id, id))

      await db
        .update(dbSchema.listings)
        .set({ status: "matched", matchedListingId: id, updatedAt: now })
        .where(eq(dbSchema.listings.id, otherId))
    } else {
      const [updated] = await db
        .update(dbSchema.listings)
        .set(update)
        .where(eq(dbSchema.listings.id, id))
        .returning()

      if (!updated) return jsonError("Listing not found", 404)
    }

    if (Array.isArray(body.photoUrls)) {
      const urls = body.photoUrls.filter(
        (url): url is string => typeof url === "string" && url.trim().length > 0
      )

      await db.delete(dbSchema.photos).where(eq(dbSchema.photos.listingId, id))

      await db
        .update(dbSchema.listings)
        .set({ imageUrls: urls, updatedAt: now })
        .where(eq(dbSchema.listings.id, id))

      if (urls.length > 0) {
        await db.insert(dbSchema.photos).values(
          urls.map((url) => ({
            url,
            listingId: id,
            createdAt: now,
          }))
        )
      }
    }

    const listing = await getListingById(id)
    if (!listing) return jsonError("Listing not found", 404)

    return NextResponse.json({ ok: true, data: listing })
  } catch {
    return jsonError("Failed to update listing", 500)
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!id) return jsonError("Missing listing id", 422)

  const db = getDbOrNull()
  if (!db) return jsonError("Database not configured", 503)

  const actor = getActor(request)
  if (!actor) return jsonError("Unauthorized", 401)

  try {
    const existing = await db
      .select({ id: dbSchema.listings.id, userId: dbSchema.listings.userId, status: dbSchema.listings.status })
      .from(dbSchema.listings)
      .where(eq(dbSchema.listings.id, id))
      .limit(1)

    if (existing.length === 0) return jsonError("Listing not found", 404)

    const row = existing[0]
    const isStaffOrAdmin = actor.role === "staff" || actor.role === "admin"
    const isOwner = row.userId === actor.id

    if (!isStaffOrAdmin) {
      if (!isOwner) return jsonError("Forbidden", 403)
      if (row.status !== "active") {
        return jsonError("You can only delete active listings", 409)
      }

      const approved = await db
        .select({ id: dbSchema.claims.id })
        .from(dbSchema.claims)
        .where(and(eq(dbSchema.claims.listingId, id), eq(dbSchema.claims.status, "approved")))
        .limit(1)

      if (approved.length > 0) {
        return jsonError("You cannot delete a listing with an approved claim", 409)
      }
    }

    await db.delete(dbSchema.listings).where(eq(dbSchema.listings.id, id))
    return NextResponse.json({ ok: true })
  } catch {
    return jsonError("Failed to delete listing", 500)
  }
}
