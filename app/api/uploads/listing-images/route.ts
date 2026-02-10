import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SUPABASE_STORAGE_BUCKET = "listing-images"

function sanitizeFilename(name: string): string {
  const trimmed = name.trim() || "upload"
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, "_")
}

function encodeStoragePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const json = (await response.json()) as { message?: unknown; error?: unknown }
    const message = typeof json.message === "string" ? json.message : undefined
    const error = typeof json.error === "string" ? json.error : undefined
    return message || error || response.statusText
  } catch {
    try {
      const text = await response.text()
      return text || response.statusText
    } catch {
      return response.statusText
    }
  }
}

function getSupabaseStorageServerConfig():
  | { url: string; serviceRoleKey: string; anonKey: string }
  | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anonKey || !serviceRoleKey) return null

  return { url: url.replace(/\/+$/, ""), anonKey, serviceRoleKey }
}

export async function POST(request: Request) {
  const config = getSupabaseStorageServerConfig()
  if (!config) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Supabase Storage upload is not configured. Set SUPABASE_SERVICE_ROLE_KEY (server-only) and ensure NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY are set.",
      },
      { status: 503 }
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid multipart form data" }, { status: 400 })
  }

  const userIdRaw = form.get("userId")
  const listingIdRaw = form.get("listingId")

  const userId = typeof userIdRaw === "string" && userIdRaw.trim() ? userIdRaw.trim() : "anon"
  const listingId =
    typeof listingIdRaw === "string" && listingIdRaw.trim()
      ? listingIdRaw.trim()
      : crypto.randomUUID()

  const files = form.getAll("files").filter((value): value is File => value instanceof File)
  if (files.length === 0) {
    return NextResponse.json({ ok: false, error: "No files were provided" }, { status: 422 })
  }

  const urls: string[] = []

  for (const file of files) {
    if (!file.size) continue

    const safeFilename = sanitizeFilename(file.name)
    const objectPath = `${userId}/${listingId}/${Date.now()}-${safeFilename}`
    const encodedPath = encodeStoragePath(objectPath)

    const uploadUrl = `${config.url}/storage/v1/object/${SUPABASE_STORAGE_BUCKET}/${encodedPath}`
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
        "content-type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: Buffer.from(await file.arrayBuffer()),
    })

    if (!response.ok) {
      const detail = await readErrorDetail(response)
      return NextResponse.json(
        {
          ok: false,
          error: `Supabase Storage upload failed (${response.status}). ${detail}`.trim(),
        },
        { status: 500 }
      )
    }

    // Requires the bucket to be public to load via Next/Image without expiring URLs.
    urls.push(
      `${config.url}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${encodedPath}`
    )
  }

  return NextResponse.json({ ok: true, urls })
}

