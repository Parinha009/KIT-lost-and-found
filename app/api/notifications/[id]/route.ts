import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDbOrNull, dbSchema } from "@/lib/db"
import type { UserRole } from "@/lib/types"

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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const db = getDbOrNull()
  if (!db) return jsonError("Database not configured", 503)

  const actor = getActor(request)
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

