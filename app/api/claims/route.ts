import { NextResponse } from "next/server"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
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

function mapListingType(type: string): Listing["type"] {
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

function mapUser(row: typeof dbSchema.users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone || undefined,
    role: row.role,
    avatar_url: row.avatarUrl || undefined,
    is_banned: row.isBanned,
    created_at: toIsoString(row.createdAt),
    updated_at: toIsoString(row.updatedAt),
  }
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

function mapListing(row: typeof dbSchema.items.$inferSelect, profile?: typeof dbSchema.profiles.$inferSelect): Listing {
  const imageUrls = Array.isArray(row.imageUrls)
    ? row.imageUrls.filter(
        (value: unknown): value is string => typeof value === "string" && value.length > 0
      )
    : []

  return {
    id: row.id,
    type: mapListingType(row.type),
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
      ? await db.select().from(dbSchema.items).where(inArray(dbSchema.items.id, listingIds))
      : []

  const profileIds = [...new Set(listingRows.map((listing) => listing.createdBy))]
  const profiles =
    profileIds.length > 0
      ? await db.select().from(dbSchema.profiles).where(inArray(dbSchema.profiles.userId, profileIds))
      : []

  const userIds = [...new Set([...claimantIds, ...reviewerIds])]
  const users =
    userIds.length > 0
      ? await db.select().from(dbSchema.users).where(inArray(dbSchema.users.id, userIds))
      : []

  const userMap = new Map(users.map((user) => [user.id, user]))
  const profileMap = new Map(profiles.map((profile) => [profile.userId, profile]))
  const listingMap = new Map(
    listingRows.map((listing) => [listing.id, mapListing(listing, profileMap.get(listing.createdBy))])
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
      handover_at: row.handoverAt ? toIsoString(row.handoverAt) : undefined,
      handover_notes: row.handoverNotes || undefined,
      created_at: toIsoString(row.createdAt),
      updated_at: toIsoString(row.updatedAt),
    }
  })
}

export async function GET(request: Request) {
  const db = getDbOrNull()
  if (!db) return jsonError("Database not configured", 503)

  const url = new URL(request.url)
  const listingId = url.searchParams.get("listingId")
  const status = normalizeClaimStatus(url.searchParams.get("status"))
  const countOnly = url.searchParams.get("countOnly") === "1"

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
    if (countOnly) {
      const rows = where
        ? await db
            .select({ count: sql<number>`count(*)` })
            .from(dbSchema.claims)
            .where(where)
        : await db.select({ count: sql<number>`count(*)` }).from(dbSchema.claims)

      const rawCount = rows[0]?.count
      const count = typeof rawCount === "number" ? rawCount : Number(rawCount) || 0

      return NextResponse.json({ ok: true, count })
    }

    const claims = await fetchClaimsByWhere(where)
    return NextResponse.json({ ok: true, data: claims })
  } catch (error) {
    console.error("[api/claims][GET] failed", error)
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
      .from(dbSchema.items)
      .where(eq(dbSchema.items.id, parsed.data.listing_id))
      .limit(1)

    if (!listingRow) return jsonError("Listing not found", 404)
    if (listingRow.type !== "found") {
      return jsonError("Only found listings can be claimed", 422)
    }

    if (listingRow.createdBy === claimantId) {
      return jsonError("You cannot claim your own listing", 422)
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

    const existingApproved = await db
      .select({ id: dbSchema.claims.id })
      .from(dbSchema.claims)
      .where(
        and(
          eq(dbSchema.claims.listingId, parsed.data.listing_id),
          eq(dbSchema.claims.status, "approved")
        )
      )
      .limit(1)

    if (existingApproved.length > 0) {
      return jsonError("This item has already been claimed", 409)
    }

    const pendingForListing = await db
      .select({ id: dbSchema.claims.id })
      .from(dbSchema.claims)
      .where(
        and(
          eq(dbSchema.claims.listingId, parsed.data.listing_id),
          eq(dbSchema.claims.status, "pending")
        )
      )
      .limit(1)

    if (pendingForListing.length > 0) {
      return jsonError("This item already has a pending claim under review", 409)
    }

    const pendingForClaimant = await db
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

    if (pendingForClaimant.length > 0) {
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
      userId: listingRow.createdBy,
      type: "claim_submitted",
      title: `New claim for "${listingRow.name}"`,
      message: `${claimantName} submitted a claim for "${listingRow.name}".`,
      isRead: false,
      relatedListingId: listingRow.id,
      relatedClaimId: created.id,
      createdAt: now,
    })

    const claims = await fetchClaimsByWhere(eq(dbSchema.claims.id, created.id))
    return NextResponse.json({ ok: true, data: claims[0] })
  } catch (error) {
    console.error("[api/claims][POST] failed", error)
    return jsonError("Failed to create claim", 500)
  }
}
