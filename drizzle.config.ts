import { defineConfig } from "drizzle-kit"

const connectionString =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  ""

if (!connectionString) {
  throw new Error(
    "Missing database connection string. Set SUPABASE_DB_URL, DATABASE_URL, or POSTGRES_URL."
  )
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
})
