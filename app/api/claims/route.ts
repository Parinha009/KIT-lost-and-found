import { NextResponse } from "next/server"
import { and, desc, eq, inArray } from "drizzle-orm"
import { getDbOrNull, dbSchema } from "@/lib/db"
import type { Claim, Listing, User, UserRole } from "@/lib/types"
import { createClaimSchema } from "@/lib/validators"

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

function isUserRole(value: string | null): value is UserRole {
  return value === "student" || value === "staff" || value === "admin"
}

function getActor(request: Request): { id: string; role: UserRole } | null {
  const id = request.headers.get("x-user-id") ?? null
  const role = request.headers.get("x-user-role") ?? null
  if (!id || !isUserRole(role)) return null
  return { id, role }
}

function mapListingStatus(status: string): Listing["status"] {
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

function mapListingType(type: string): Listing["type"] {
  return type === "found" ? "found" : "lost"
}

function mapUser(row: typeof dbSchema.users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone || undefined,
    role: row.role,
    avatar_url: row.avatarUrl || undefined,
    is_banned: row.isBanned,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}

function mapListing(
  row: typeof dbSchema.listings.$inferSelect,
  photos: Array<typeof dbSchema.photos.$inferSelect>,
  user?: typeof dbSchema.users.$inferSelect
): Listing {
  return {
    id: row.id,
    type: mapListingType(row.type),
    title: row.title,
    description: row.description,
    category: row.category as Listing["category"],
    location: row.location as Listing["location"],
    location_details: row.locationDetails || undefined,
    date_occurred: row.dateOccurred.toISOString(),
    status: mapListingStatus(row.status),
    storage_location: row.storageLocation || undefined,
    storage_details: row.storageDetails || undefined,
    matched_listing_id: row.matchedListingId || undefined,
    image_urls: Array.isArray(row.imageUrls)
      ? row.imageUrls.filter(
          (value: unknown): value is string => typeof value === "string" && value.length > 0
        )
      : [],
    user_id: row.userId,
    user: user ? mapUser(user) : undefined,
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

function normalizeClaimStatus(value: string | null): Claim["status"] | undefined {
  if (value === "pending" || value === "approved" || value === "rejected") return value
  return undefined
}

async function fetchClaimsByWhere(
  where:
    | ReturnType<typeof and>
    | ReturnType<typeof eq>
    | undefined
): Promise<Claim[]> {
  const db = getDbOrNull()
  if (!db) throw new Error("Database not configured")

  const rows = where
    ? await db.select().from(dbSchema.claims).where(where).orderBy(desc(dbSchema.claims.createdAt))
    : await db.select().from(dbSchema.claims).orderBy(desc(dbSchema.claims.createdAt))

  if (rows.length === 0) return []

  const listingIds = [...new Set(rows.map((row) => row.listingId))]
  const claimantIds = rows.map((row) => row.claimantId)
  const reviewerIds = rows.map((row) => row.reviewerId).filter(Boolean) as string[]

  const listingRows =
    listingIds.length > 0
      ? await db.select().from(dbSchema.listings).where(inArray(dbSchema.listings.id, listingIds))
      : []

  const photoRows =
    listingIds.length > 0
      ? await db
          .select()
          .from(dbSchema.photos)
          .where(inArray(dbSchema.photos.listingId, listingIds))
          .orderBy(desc(dbSchema.photos.createdAt))
      : []

  const userIds = [
    ...new Set([
      ...claimantIds,
      ...reviewerIds,
      ...listingRows.map((listing) => listing.userId),
    ]),
  ]

  const users =
    userIds.length > 0
      ? await db.select().from(dbSchema.users).where(inArray(dbSchema.users.id, userIds))
      : []

  const userMap = new Map(users.map((user) => [user.id, user]))
  const photosByListing = new Map<string, Array<typeof dbSchema.photos.$inferSelect>>()

  for (const photo of photoRows) {
    const list = photosByListing.get(photo.listingId) ?? []
    list.push(photo)
    photosByListing.set(photo.listingId, list)
  }

  const listingMap = new Map(
    listingRows.map((listing) => [
      listing.id,
      mapListing(listing, photosByListing.get(listing.id) ?? [], userMap.get(listing.userId)),
    ])
  )

  return rows.map((row) => {
    const listing = listingMap.get(row.listingId)
    const claimant = userMap.get(row.claimantId)
    const reviewer = row.reviewerId ? userMap.get(row.reviewerId) : undefined

    return {
      id: row.id,
      listing_id: row.listingId,
      listing,
      claimant_id: row.claimantId,
      claimant: claimant ? mapUser(claimant) : undefined,
      reviewer_id: row.reviewerId || undefined,
      reviewer: reviewer ? mapUser(reviewer) : undefined,
      status: row.status,
      proof_description: row.proofDescription,
      proof_photos: row.proofPhotos ?? undefined,
      rejection_reason: row.rejectionReason || undefined,
      handover_at: row.handoverAt ? row.handoverAt.toISOString() : undefined,
      handover_notes: row.handoverNotes || undefined,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    }
  })
}

export async function GET(request: Request) {
  const db = getDbOrNull()
  if (!db) return jsonError("Database not configured", 503)

  const url = new URL(request.url)
  const listingId = url.searchParams.get("listingId")
  const status = normalizeClaimStatus(url.searchParams.get("status"))

  const actor = getActor(request)
  if (!actor) return jsonError("Unauthorized", 401)

  const isStaffOrAdmin = actor.role === "staff" || actor.role === "admin"

  const conditions: Array<ReturnType<typeof eq>> = []
  if (listingId) conditions.push(eq(dbSchema.claims.listingId, listingId))
  if (status) conditions.push(eq(dbSchema.claims.status, status))

  if (!isStaffOrAdmin) {
    conditions.push(eq(dbSchema.claims.claimantId, actor.id))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  try {
    const claims = await fetchClaimsByWhere(where)
    return NextResponse.json({ ok: true, data: claims })
  } catch {
    return jsonError("Failed to load claims", 500)
  }
}

type CreateClaimRequestBody = {
  listing_id: string
  proof_description: string
  claimant?: Pick<User, "id" | "email" | "name" | "role" | "phone" | "avatar_url">
}

export async function POST(request: Request) {
  const db = getDbOrNull()
  if (!db) return jsonError("Database not configured", 503)

  const actor = getActor(request)
  if (!actor) return jsonError("Unauthorized", 401)
  if (actor.role !== "student") return jsonError("Only students can submit claims", 403)

  let body: CreateClaimRequestBody
  try {
    body = (await request.json()) as CreateClaimRequestBody
  } catch {
    return jsonError("Invalid JSON body")
  }

  const parsed = createClaimSchema.safeParse({
    listing_id: body.listing_id,
    proof_description: body.proof_description,
  })

  if (!parsed.success) {
    const first = parsed.error.errors[0]?.message ?? "Invalid claim payload"
    return jsonError(first, 422)
  }

  const claimantId = actor.id
  const claimant = body.claimant
  if (!claimant?.id || claimant.id !== actor.id) {
    return jsonError("claimant is required", 422)
  }

  try {
    const [listingRow] = await db
      .select()
      .from(dbSchema.listings)
      .where(eq(dbSchema.listings.id, parsed.data.listing_id))
      .limit(1)

    if (!listingRow) return jsonError("Listing not found", 404)

    if (listingRow.userId === claimantId) {
      return jsonError("You cannot claim your own listing", 422)
    }

    if (listingRow.status === "closed" || listingRow.status === "archived") {
      return jsonError("This listing is not accepting claims", 422)
    }

    const now = new Date()

    if (claimant?.id && claimant.email && claimant.name && claimant.role) {
      const existing = await db
        .select({ id: dbSchema.users.id })
        .from(dbSchema.users)
        .where(eq(dbSchema.users.id, claimant.id))
        .limit(1)

      if (existing.length === 0) {
        await db.insert(dbSchema.users).values({
          id: claimant.id,
          email: claimant.email,
          name: claimant.name,
          phone: claimant.phone ?? null,
          role: claimant.role,
          avatarUrl: claimant.avatar_url ?? null,
          isBanned: false,
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    const pending = await db
      .select({ id: dbSchema.claims.id })
      .from(dbSchema.claims)
      .where(
        and(
          eq(dbSchema.claims.listingId, parsed.data.listing_id),
          eq(dbSchema.claims.claimantId, claimantId),
          eq(dbSchema.claims.status, "pending")
        )
      )
      .limit(1)

    if (pending.length > 0) {
      return jsonError("You already have a pending claim for this item", 409)
    }

    const [created] = await db
      .insert(dbSchema.claims)
      .values({
        listingId: parsed.data.listing_id,
        claimantId,
        reviewerId: null,
        status: "pending",
        proofDescription: parsed.data.proof_description.trim(),
        proofPhotos: [],
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    const claimantName =
      typeof claimant?.name === "string" && claimant.name.trim() ? claimant.name.trim() : "A user"

    await db.insert(dbSchema.notifications).values({
      userId: listingRow.userId,
      type: "claim_submitted",
      title: `New claim for "${listingRow.title}"`,
      message: `${claimantName} submitted a claim for "${listingRow.title}".`,
      isRead: false,
      relatedListingId: listingRow.id,
      relatedClaimId: created.id,
      createdAt: now,
    })

    const claims = await fetchClaimsByWhere(eq(dbSchema.claims.id, created.id))
    return NextResponse.json({ ok: true, data: claims[0] })
  } catch {
    return jsonError("Failed to create claim", 500)
  }
}
