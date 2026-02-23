import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDbOrNull, dbSchema } from "@/lib/db"
import type { UserRole } from "@/lib/types"

type Actor = { id: string; role: UserRole }

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

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const db = getDbOrNull()
  if (!db) return jsonError("Database not configured", 503)

  const actor = await getActorFromProfile(db, request)
  if (!actor) return jsonError("Unauthorized", 401)

  const { id } = await context.params
  if (!id) return jsonError("Missing notification id", 422)

  try {
    const [updated] = await db
      .update(dbSchema.notifications)
      .set({ isRead: true })
      .where(and(eq(dbSchema.notifications.id, id), eq(dbSchema.notifications.userId, actor.id)))
      .returning({ id: dbSchema.notifications.id })

    if (!updated) return jsonError("Notification not found", 404)

    return NextResponse.json({ ok: true })
  } catch {
    return jsonError("Failed to update notification", 500)
  }
}
