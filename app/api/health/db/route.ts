import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { checkDatabaseConnection, hasDatabaseConfig } from "@/lib/db"
import { getDbOrNull } from "@/lib/db"

export const dynamic = "force-dynamic"

const NO_STORE_HEADERS = {
  "cache-control": "no-store, max-age=0",
} as const

const REQUIRED_TABLES = ["users", "listings", "photos", "claims", "notifications"] as const

function rowsFromExecuteResult(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value as Array<Record<string, unknown>>

  if (
    value &&
    typeof value === "object" &&
    "rows" in value &&
    Array.isArray((value as { rows?: unknown }).rows)
  ) {
    return (value as { rows: Array<Record<string, unknown>> }).rows
  }

  return []
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
      { status: 503, headers: NO_STORE_HEADERS }
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
      { status: 503, headers: NO_STORE_HEADERS }
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
      { status: 503, headers: NO_STORE_HEADERS }
    )
  }

  // If tables aren't created yet, treat DB as "not ready" so the UI safely uses local fallback.
  try {
    const result = await db.execute(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('users', 'listings', 'photos', 'claims', 'notifications')
    `)

    const rows = rowsFromExecuteResult(result)
    const present = new Set(
      rows
        .map((row) => row.table_name)
        .filter((name): name is string => typeof name === "string")
    )
    const missingTables = REQUIRED_TABLES.filter((name) => !present.has(name))

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
        { status: 503, headers: NO_STORE_HEADERS }
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
      { status: 503, headers: NO_STORE_HEADERS }
    )
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    connected: true,
    schemaReady: true,
    provider: "supabase-postgres",
    orm: "drizzle",
  }, { headers: NO_STORE_HEADERS })
}
