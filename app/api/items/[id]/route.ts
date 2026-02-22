import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDbOrNull, dbSchema } from "@/lib/db"
import type { Listing, User, UserRole } from "@/lib/types"

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

type UpdateItemBody = {
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

async function getItemById(id: string): Promise<Listing | null> {
  const db = getDbOrNull()
  if (!db) return null

  const [row] = await db
    .select()
    .from(dbSchema.items)
    .where(eq(dbSchema.items.id, id))
    .limit(1)

  if (!row) return null

  const [profile] = await db
    .select()
    .from(dbSchema.profiles)
    .where(eq(dbSchema.profiles.userId, row.createdBy))
    .limit(1)

  return mapItemToListing(row, profile)
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!id) return jsonError("Missing item id", 422)

  const db = getDbOrNull()
  if (!db) {
    return jsonError("Database not configured", 503)
  }

  const listing = await getItemById(id)
  if (!listing) return jsonError("Item not found", 404)

  return NextResponse.json({ ok: true, data: listing })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!id) return jsonError("Missing item id", 422)

  const db = getDbOrNull()
  if (!db) return jsonError("Database not configured", 503)

  const actor = getActor(request)
  if (!actor) return jsonError("Unauthorized", 401)

  let body: UpdateItemBody
  try {
    body = (await request.json()) as UpdateItemBody
  } catch {
    return jsonError("Invalid JSON body")
  }

  const now = new Date()

  const [existing] = await db
    .select({
      id: dbSchema.items.id,
      createdBy: dbSchema.items.createdBy,
    })
    .from(dbSchema.items)
    .where(eq(dbSchema.items.id, id))
    .limit(1)

  if (!existing) return jsonError("Item not found", 404)

  const isOwner = existing.createdBy === actor.id
  const isStaffOrAdmin = actor.role === "staff" || actor.role === "admin"
  const canEditFields = isOwner || isStaffOrAdmin

  const update: Record<string, unknown> = { updatedAt: now }

  if (typeof body.title === "string") {
    if (!canEditFields) return jsonError("Forbidden", 403)
    update.name = body.title.trim()
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
    return jsonError("Lifecycle status updates are not enabled for items", 422)
  }

  if (typeof body.matched_listing_id === "string") {
    if (!isStaffOrAdmin) return jsonError("Forbidden", 403)
    return jsonError("Item matching links are not enabled for items", 422)
  }

  if (Array.isArray(body.photoUrls)) {
    const urls = body.photoUrls.filter(
      (url): url is string => typeof url === "string" && url.trim().length > 0
    )
    update.imageUrls = urls
  }

  try {
    const [updated] = await db
      .update(dbSchema.items)
      .set(update)
      .where(eq(dbSchema.items.id, id))
      .returning()

    if (!updated) return jsonError("Item not found", 404)

    const [profile] = await db
      .select()
      .from(dbSchema.profiles)
      .where(eq(dbSchema.profiles.userId, updated.createdBy))
      .limit(1)

    return NextResponse.json({ ok: true, data: mapItemToListing(updated, profile) })
  } catch (error) {
    console.error("[api/items/:id][PATCH] failed", error)
    return jsonError("Failed to update item", 500)
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!id) return jsonError("Missing item id", 422)

  const db = getDbOrNull()
  if (!db) return jsonError("Database not configured", 503)

  const actor = getActor(request)
  if (!actor) return jsonError("Unauthorized", 401)

  try {
    const existing = await db
      .select({ id: dbSchema.items.id, createdBy: dbSchema.items.createdBy })
      .from(dbSchema.items)
      .where(eq(dbSchema.items.id, id))
      .limit(1)

    if (existing.length === 0) return jsonError("Item not found", 404)

    const row = existing[0]
    const isStaffOrAdmin = actor.role === "staff" || actor.role === "admin"
    const isOwner = row.createdBy === actor.id

    if (!isStaffOrAdmin) {
      if (!isOwner) return jsonError("Forbidden", 403)

      const approved = await db
        .select({ id: dbSchema.claims.id })
        .from(dbSchema.claims)
        .where(and(eq(dbSchema.claims.listingId, id), eq(dbSchema.claims.status, "approved")))
        .limit(1)

      if (approved.length > 0) {
        return jsonError("You cannot delete an item with an approved claim", 409)
      }
    }

    await db.delete(dbSchema.items).where(eq(dbSchema.items.id, id))
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[api/items/:id][DELETE] failed", error)
    return jsonError("Failed to delete item", 500)
  }
}
