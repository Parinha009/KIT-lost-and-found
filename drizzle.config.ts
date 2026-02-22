import { defineConfig } from "drizzle-kit"

const connectionString = process.env.SUPABASE_DB_URL || ""

if (!connectionString) {
  throw new Error("Missing database connection string. Set SUPABASE_DB_URL.")
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
})
