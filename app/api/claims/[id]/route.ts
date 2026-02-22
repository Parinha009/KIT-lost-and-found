import { NextResponse } from "next/server"
import { eq, inArray } from "drizzle-orm"
import { getDbOrNull, dbSchema } from "@/lib/db"
import type { Claim, Listing, User, UserRole } from "@/lib/types"

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
    created_at: profile.createdAt.toISOString(),
    updated_at: profile.createdAt.toISOString(),
  }
}

async function getClaimById(id: string): Promise<Claim | null> {
  const db = getDbOrNull()
  if (!db) return null

  const [row] = await db
    .select()
    .from(dbSchema.claims)
    .where(eq(dbSchema.claims.id, id))
    .limit(1)

  if (!row) return null

  const [listingRow] = await db
    .select()
    .from(dbSchema.items)
    .where(eq(dbSchema.items.id, row.listingId))
    .limit(1)

  const ownerProfile = listingRow
    ? (
        await db
          .select()
          .from(dbSchema.profiles)
          .where(eq(dbSchema.profiles.userId, listingRow.createdBy))
          .limit(1)
      )[0]
    : undefined

  const userIds = [row.claimantId, row.reviewerId || null].filter(Boolean) as string[]

  const users =
    userIds.length > 0
      ? await db.select().from(dbSchema.users).where(inArray(dbSchema.users.id, userIds))
      : []

  const userMap = new Map(users.map((user) => [user.id, user]))

  const listing = listingRow
    ? {
        id: listingRow.id,
        type: mapListingType(listingRow.type),
        title: listingRow.name,
        description: listingRow.description,
        category: listingRow.category as Listing["category"],
        location: listingRow.location as Listing["location"],
        location_details: listingRow.locationDetails || undefined,
        date_occurred: listingRow.dateOccurred.toISOString(),
        status: "active" as const,
        storage_location: listingRow.storageLocation || undefined,
        storage_details: listingRow.storageDetails || undefined,
        image_urls: Array.isArray(listingRow.imageUrls)
          ? listingRow.imageUrls.filter(
              (value: unknown): value is string => typeof value === "string" && value.length > 0
            )
          : [],
        user_id: listingRow.createdBy,
        user: mapProfileToUser(ownerProfile),
        photos: (Array.isArray(listingRow.imageUrls) ? listingRow.imageUrls : []).map(
          (url, index) => ({
            id: `${listingRow.id}-photo-${index + 1}`,
            url,
            listing_id: listingRow.id,
            created_at: listingRow.createdAt.toISOString(),
          })
        ),
        created_at: listingRow.createdAt.toISOString(),
        updated_at: listingRow.updatedAt.toISOString(),
      }
    : undefined

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
}

type UpdateClaimBody = {
  status: Claim["status"]
  rejection_reason?: string
  handover_notes?: string
  handover_at?: string
  reviewer?: Pick<User, "id" | "email" | "name" | "role" | "phone" | "avatar_url">
}

function normalizeClaimStatus(value: unknown): Claim["status"] | null {
  if (value === "pending" || value === "approved" || value === "rejected") return value
  return null
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const db = getDbOrNull()
  if (!db) return jsonError("Database not configured", 503)

  const actor = getActor(request)
  if (!actor) return jsonError("Unauthorized", 401)
  if (actor.role !== "staff" && actor.role !== "admin") {
    return jsonError("Only staff/admin can review claims", 403)
  }

  const { id } = await context.params
  if (!id) return jsonError("Missing claim id", 422)

  let body: UpdateClaimBody
  try {
    body = (await request.json()) as UpdateClaimBody
  } catch {
    return jsonError("Invalid JSON body")
  }

  const status = normalizeClaimStatus(body.status)
  if (!status) return jsonError("Invalid claim status", 422)

  const now = new Date()

  try {
    const [existing] = await db
      .select()
      .from(dbSchema.claims)
      .where(eq(dbSchema.claims.id, id))
      .limit(1)

    if (!existing) return jsonError("Claim not found", 404)
    if (existing.status !== "pending") return jsonError("This claim was already reviewed", 409)

    const [listing] = await db
      .select()
      .from(dbSchema.items)
      .where(eq(dbSchema.items.id, existing.listingId))
      .limit(1)

    if (!listing) return jsonError("Listing not found", 404)

    const update: Partial<typeof dbSchema.claims.$inferInsert> = {
      status,
      reviewerId: actor.id,
      updatedAt: now,
    }

    if (status === "rejected") {
      update.rejectionReason =
        typeof body.rejection_reason === "string" && body.rejection_reason.trim()
          ? body.rejection_reason.trim()
          : "Rejected"
    }

    if (status === "approved") {
      update.handoverNotes =
        typeof body.handover_notes === "string" && body.handover_notes.trim()
          ? body.handover_notes.trim()
          : null
      update.handoverAt = body.handover_at ? new Date(body.handover_at) : now
      update.rejectionReason = null
    }

    const reviewer = body.reviewer
    if (reviewer?.id && reviewer.email && reviewer.name && reviewer.role && reviewer.id === actor.id) {
      const reviewerExists = await db
        .select({ id: dbSchema.users.id })
        .from(dbSchema.users)
        .where(eq(dbSchema.users.id, reviewer.id))
        .limit(1)

      if (reviewerExists.length === 0) {
        await db.insert(dbSchema.users).values({
          id: reviewer.id,
          email: reviewer.email,
          name: reviewer.name,
          phone: reviewer.phone ?? null,
          role: reviewer.role,
          avatarUrl: reviewer.avatar_url ?? null,
          isBanned: false,
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    await db.update(dbSchema.claims).set(update).where(eq(dbSchema.claims.id, id))

    const notificationType = status === "approved" ? "claim_approved" : "claim_rejected"
    const title =
      status === "approved"
        ? `Claim approved for "${listing.name}"`
        : `Claim rejected for "${listing.name}"`

    const message =
      status === "approved"
        ? `Your claim for "${listing.name}" was approved. Please coordinate pickup with staff.`
        : `Your claim for "${listing.name}" was rejected.${
            update.rejectionReason ? ` Reason: ${update.rejectionReason}` : ""
          }`

    await db.insert(dbSchema.notifications).values({
      userId: existing.claimantId,
      type: notificationType,
      title,
      message,
      isRead: false,
      relatedListingId: listing.id,
      relatedClaimId: existing.id,
      createdAt: now,
    })

    const updated = await getClaimById(id)
    if (!updated) return jsonError("Claim not found", 404)

    return NextResponse.json({ ok: true, data: updated })
  } catch {
    return jsonError("Failed to update claim", 500)
  }
}
