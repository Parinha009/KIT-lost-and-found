import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { checkDatabaseConnection, hasDatabaseConfig } from "@/lib/db"
import { getDbOrNull } from "@/lib/db"

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    return normalized === "true" || normalized === "t" || normalized === "1"
  }
  return false
}

export async function GET() {
  const configured = hasDatabaseConfig()
  if (!configured) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        provider: "supabase-postgres",
        orm: "drizzle",
      },
      { status: 503 }
    )
  }

  const connected = await checkDatabaseConnection()
  if (!connected) {
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        connected: false,
        provider: "supabase-postgres",
        orm: "drizzle",
      },
      { status: 503 }
    )
  }

  const db = getDbOrNull()
  if (!db) {
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        connected: false,
        provider: "supabase-postgres",
        orm: "drizzle",
      },
      { status: 503 }
    )
  }

  // If tables aren't created yet, treat DB as "not ready" so the UI safely uses local fallback.
  try {
    const result = await db.execute(sql`
      select
        to_regclass('public.profiles') is not null as profiles,
        to_regclass('public.items') is not null as items,
        to_regclass('public.users') is not null as users,
        to_regclass('public.claims') is not null as claims,
        to_regclass('public.notifications') is not null as notifications
    `)

    const row = Array.isArray(result)
      ? (result[0] as Record<string, unknown> | undefined)
      : undefined
    const missingTables = Object.entries(row ?? {})
      .filter(([, value]) => !toBoolean(value))
      .map(([key]) => key)

    if (missingTables.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          configured: true,
          connected: true,
          schemaReady: false,
          missingTables,
          provider: "supabase-postgres",
          orm: "drizzle",
        },
        { status: 503 }
      )
    }
  } catch {
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        connected: true,
        schemaReady: false,
        provider: "supabase-postgres",
        orm: "drizzle",
      },
      { status: 503 }
    )
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    connected: true,
    schemaReady: true,
    provider: "supabase-postgres",
    orm: "drizzle",
  })
}
