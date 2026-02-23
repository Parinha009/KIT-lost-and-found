import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { dbSchema, getDbOrNull } from "@/lib/db"

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

type Actor = {
  id: string
}

function getActor(request: Request): Actor | null {
  const id = request.headers.get("x-user-id")?.trim()
  if (!id) return null
  return { id }
}

type UpdateProfileBody = {
  name?: string
  phone?: string | null
}

function normalizePhone(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function GET(request: Request) {
  const db = getDbOrNull()
  if (!db) return jsonError("Database not configured", 503)

  const actor = getActor(request)
  if (!actor) return jsonError("Unauthorized", 401)

  try {
    const [profile] = await db
      .select()
      .from(dbSchema.profiles)
      .where(eq(dbSchema.profiles.userId, actor.id))
      .limit(1)

    if (!profile) return jsonError("Profile not found", 404)

    return NextResponse.json({
      ok: true,
      data: {
        user_id: profile.userId,
        full_name: profile.fullName,
        campus_email: profile.campusEmail,
        phone: profile.phone || undefined,
        role: profile.role,
        created_at: profile.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error("[api/profile][GET] failed", error)
    return jsonError("Failed to load profile", 500)
  }
}

export async function PATCH(request: Request) {
  const db = getDbOrNull()
  if (!db) return jsonError("Database not configured", 503)

  const actor = getActor(request)
  if (!actor) return jsonError("Unauthorized", 401)

  let body: UpdateProfileBody
  try {
    body = (await request.json()) as UpdateProfileBody
  } catch {
    return jsonError("Invalid JSON body")
  }

  const nextName = body.name?.trim()
  const nextPhone = normalizePhone(body.phone)

  if (nextName !== undefined && nextName.length < 2) {
    return jsonError("Name must be at least 2 characters", 422)
  }
  if (nextName !== undefined && nextName.length > 100) {
    return jsonError("Name must not exceed 100 characters", 422)
  }

  if (nextName === undefined && body.phone === undefined) {
    return jsonError("Nothing to update", 422)
  }

  try {
    const [existingProfile] = await db
      .select()
      .from(dbSchema.profiles)
      .where(eq(dbSchema.profiles.userId, actor.id))
      .limit(1)

    if (!existingProfile) return jsonError("Profile not found", 404)

    const now = new Date()
    const fullName = nextName ?? existingProfile.fullName
    const phone = body.phone === undefined ? existingProfile.phone : nextPhone

    const [updatedProfile] = await db
      .update(dbSchema.profiles)
      .set({
        fullName,
        phone,
      })
      .where(eq(dbSchema.profiles.userId, actor.id))
      .returning()

    if (!updatedProfile) return jsonError("Profile not found", 404)

    const [existingUser] = await db
      .select({ id: dbSchema.users.id })
      .from(dbSchema.users)
      .where(eq(dbSchema.users.id, actor.id))
      .limit(1)

    if (existingUser) {
      await db
        .update(dbSchema.users)
        .set({
          name: fullName,
          phone,
          role: updatedProfile.role,
          updatedAt: now,
        })
        .where(eq(dbSchema.users.id, actor.id))
    } else {
      await db.insert(dbSchema.users).values({
        id: actor.id,
        email: updatedProfile.campusEmail,
        name: fullName,
        phone,
        role: updatedProfile.role,
        avatarUrl: null,
        isBanned: false,
        createdAt: now,
        updatedAt: now,
      })
    }

    return NextResponse.json({
      ok: true,
      data: {
        user_id: updatedProfile.userId,
        full_name: updatedProfile.fullName,
        campus_email: updatedProfile.campusEmail,
        phone: updatedProfile.phone || undefined,
        role: updatedProfile.role,
        created_at: updatedProfile.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error("[api/profile][PATCH] failed", error)
    return jsonError("Failed to update profile", 500)
  }
}
