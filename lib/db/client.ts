import "server-only"

import { drizzle } from "drizzle-orm/postgres-js"
import { sql } from "drizzle-orm"
import postgres from "postgres"
import * as schema from "@/lib/db/schema"

const DATABASE_URL =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  ""

type DrizzleDatabase = ReturnType<typeof drizzle<typeof schema>>

declare global {
  // eslint-disable-next-line no-var
  var __kitSqlClient: ReturnType<typeof postgres> | undefined
  // eslint-disable-next-line no-var
  var __kitDrizzleDb: DrizzleDatabase | undefined
}

function isConfigured() {
  return DATABASE_URL.length > 0
}

function createDatabase() {
  const sqlClient = postgres(DATABASE_URL, {
    max: 1,
    prepare: false,
    ssl: "require",
  })

  return {
    sqlClient,
    db: drizzle(sqlClient, { schema }),
  }
}

export function hasDatabaseConfig(): boolean {
  return isConfigured()
}

export function getDbOrNull(): DrizzleDatabase | null {
  if (!isConfigured()) return null

  if (process.env.NODE_ENV === "production") {
    return createDatabase().db
  }

  if (!globalThis.__kitSqlClient || !globalThis.__kitDrizzleDb) {
    const { sqlClient, db } = createDatabase()
    globalThis.__kitSqlClient = sqlClient
    globalThis.__kitDrizzleDb = db
  }

  return globalThis.__kitDrizzleDb
}

export function getDb(): DrizzleDatabase {
  const db = getDbOrNull()
  if (!db) {
    throw new Error(
      "Database URL is not configured. Set SUPABASE_DB_URL or DATABASE_URL."
    )
  }
  return db
}

export async function checkDatabaseConnection(): Promise<boolean> {
  const db = getDbOrNull()
  if (!db) return false

  try {
    await db.execute(sql`select 1`)
    return true
  } catch {
    return false
  }
}
