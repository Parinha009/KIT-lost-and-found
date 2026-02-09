import { NextResponse } from "next/server"
import { desc, eq } from "drizzle-orm"
import { getDbOrNull, dbSchema } from "@/lib/db"
import type { Listing, User } from "@/lib/types"

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

  let body: UpdateListingBody
  try {
    body = (await request.json()) as UpdateListingBody
  } catch {
    return jsonError("Invalid JSON body")
  }

  const now = new Date()
  const update: Record<string, unknown> = { updatedAt: now }

  if (typeof body.title === "string") update.title = body.title.trim()
  if (typeof body.description === "string") update.description = body.description.trim()
  if (typeof body.category === "string") update.category = body.category
  if (typeof body.location === "string") update.location = body.location
  if (typeof body.location_details === "string")
    update.locationDetails = body.location_details.trim() || null
  if (typeof body.storage_location === "string")
    update.storageLocation = body.storage_location.trim() || null
  if (typeof body.storage_details === "string")
    update.storageDetails = body.storage_details.trim() || null
  if (typeof body.date_occurred === "string") update.dateOccurred = new Date(body.date_occurred)
  if (typeof body.status === "string") update.status = body.status

  try {
    const [updated] = await db
      .update(dbSchema.listings)
      .set(update)
      .where(eq(dbSchema.listings.id, id))
      .returning()

    if (!updated) return jsonError("Listing not found", 404)

    if (Array.isArray(body.photoUrls)) {
      const urls = body.photoUrls.filter(
        (url): url is string => typeof url === "string" && url.trim().length > 0
      )

      await db.delete(dbSchema.photos).where(eq(dbSchema.photos.listingId, id))

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

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!id) return jsonError("Missing listing id", 422)

  const db = getDbOrNull()
  if (!db) return jsonError("Database not configured", 503)

  try {
    const existing = await db
      .select({ id: dbSchema.listings.id })
      .from(dbSchema.listings)
      .where(eq(dbSchema.listings.id, id))
      .limit(1)

    if (existing.length === 0) return jsonError("Listing not found", 404)

    await db.delete(dbSchema.listings).where(eq(dbSchema.listings.id, id))
    return NextResponse.json({ ok: true })
  } catch {
    return jsonError("Failed to delete listing", 500)
  }
}
