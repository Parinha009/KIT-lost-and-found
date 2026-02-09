import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET() {
  // Some browsers request `/favicon.ico` even for JSON endpoints (e.g. `/api/*`).
  // Serve a real 200 response (not a redirect) to avoid sticky favicon caches.
  const filePath = path.join(process.cwd(), "public", "placeholder-logo.png")
  const bytes = await readFile(filePath)

  return new NextResponse(bytes, {
    headers: {
      "content-type": "image/png",
      "cache-control": "no-store, max-age=0, must-revalidate",
      pragma: "no-cache",
      expires: "0",
    },
  })
}
