import { NextResponse } from "next/server"
import { and, desc, eq, sql } from "drizzle-orm"
import { getDbOrNull, dbSchema } from "@/lib/db"
import type { Notification, NotificationType, UserRole } from "@/lib/types"

type Actor = { id: string; role: UserRole }

function isUserRole(value: string | null): value is UserRole {
  return value === "student" || value === "staff" || value === "admin"
}

function getActor(request: Request): Actor | null {
  const id = request.headers.get("x-user-id")
  const role = request.headers.get("x-user-role")
  if (!id || !isUserRole(role)) return null
  return { id, role }
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

function mapNotificationType(value: string): NotificationType {
  if (
    value === "match" ||
    value === "claim_submitted" ||
    value === "claim_approved" ||
    value === "claim_rejected" ||
    value === "system"
  ) {
    return value
  }
  return "system"
}

function mapNotification(row: typeof dbSchema.notifications.$inferSelect): Notification {
  return {
    id: row.id,
    user_id: row.userId,
    type: mapNotificationType(row.type),
    title: row.title,
    message: row.message,
    is_read: row.isRead,
    related_listing_id: row.relatedListingId || undefined,
    related_claim_id: row.relatedClaimId || undefined,
    created_at: row.createdAt.toISOString(),
  }
}

export async function GET(request: Request) {
  const db = getDbOrNull()
  if (!db) return jsonError("Database not configured", 503)

  const actor = getActor(request)
  if (!actor) return jsonError("Unauthorized", 401)

  const url = new URL(request.url)
  const userId = url.searchParams.get("userId") || actor.id

  const isAdmin = actor.role === "admin"
  if (!isAdmin && userId !== actor.id) return jsonError("Forbidden", 403)

  try {
    const rows = await db
      .select()
      .from(dbSchema.notifications)
      .where(eq(dbSchema.notifications.userId, userId))
      .orderBy(desc(dbSchema.notifications.createdAt))

    const unread = await db
      .select({ count: sql<number>`count(*)` })
      .from(dbSchema.notifications)
      .where(
        and(
          eq(dbSchema.notifications.userId, userId),
          eq(dbSchema.notifications.isRead, false)
        )
      )

    const unreadCountRow = unread[0]?.count
    const unreadCount =
      typeof unreadCountRow === "number" ? unreadCountRow : Number(unreadCountRow) || 0

    return NextResponse.json({
      ok: true,
      data: rows.map(mapNotification),
      unreadCount,
    })
  } catch {
    return jsonError("Failed to load notifications", 500)
  }
}

type MarkAllBody = { user_id?: string }

export async function PATCH(request: Request) {
  const db = getDbOrNull()
  if (!db) return jsonError("Database not configured", 503)

  const actor = getActor(request)
  if (!actor) return jsonError("Unauthorized", 401)

  let body: MarkAllBody
  try {
    body = (await request.json()) as MarkAllBody
  } catch {
    return jsonError("Invalid JSON body")
  }

  if (!body.user_id || body.user_id !== actor.id) return jsonError("Forbidden", 403)

  try {
    await db
      .update(dbSchema.notifications)
      .set({ isRead: true })
      .where(eq(dbSchema.notifications.userId, actor.id))

    return NextResponse.json({ ok: true })
  } catch {
    return jsonError("Failed to update notifications", 500)
  }
}
