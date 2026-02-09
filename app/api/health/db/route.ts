import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { checkDatabaseConnection, hasDatabaseConfig } from "@/lib/db"
import { getDbOrNull } from "@/lib/db"

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
        to_regclass('public.users') is not null as users,
        to_regclass('public.listings') is not null as listings,
        to_regclass('public.photos') is not null as photos,
        to_regclass('public.claims') is not null as claims,
        to_regclass('public.notifications') is not null as notifications
    `)

    const row = Array.isArray(result) ? (result[0] as Record<string, unknown> | undefined) : undefined
    const missingTables = Object.entries(row ?? {})
      .filter(([, value]) => value !== true)
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
