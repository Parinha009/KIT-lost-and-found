const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1"
const SUPABASE_STORAGE_BUCKET = "listing-images"

type UploadListingImagesOptions = {
  userId?: string
  listingId?: string
  /**
   * When true, upload failures surface as errors (used for DB-backed submissions).
   * When false/omitted, upload failures fall back to placeholder URLs.
   */
  strict?: boolean
}

function getCloudinaryConfig() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !uploadPreset) return null

  return { cloudName, uploadPreset }
}

function getSupabaseStorageConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) return null

  return { url: url.replace(/\/+$/, ""), anonKey }
}

async function uploadToCloudinary(files: File[], cloudName: string, uploadPreset: string) {
  const uploadTasks = files.map(async (file) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("upload_preset", uploadPreset)

    const response = await fetch(`${CLOUDINARY_UPLOAD_URL}/${cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Cloudinary upload failed with status ${response.status}`)
    }

    const result = (await response.json()) as { secure_url?: string }
    if (!result.secure_url) {
      throw new Error("Cloudinary upload did not return a secure URL")
    }

    return result.secure_url
  })

  return Promise.all(uploadTasks)
}

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

async function uploadToSupabaseStorage(
  files: File[],
  config: { url: string; anonKey: string },
  options?: UploadListingImagesOptions
): Promise<string[]> {
  const userId = options?.userId ?? "anon"
  const listingId = options?.listingId ?? crypto.randomUUID()

  const uploadTasks = files.map(async (file) => {
    const safeFilename = sanitizeFilename(file.name)
    const objectPath = `${userId}/${listingId}/${Date.now()}-${safeFilename}`
    const encodedPath = encodeStoragePath(objectPath)

    const uploadUrl = `${config.url}/storage/v1/object/${SUPABASE_STORAGE_BUCKET}/${encodedPath}`
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        authorization: `Bearer ${config.anonKey}`,
        "content-type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: file,
    })

    if (!response.ok) {
      const detail = await readErrorDetail(response)
      throw new Error(
        `Supabase Storage upload failed (${response.status}). ${detail}`.trim()
      )
    }

    return `${config.url}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${encodedPath}`
  })

  return Promise.all(uploadTasks)
}

/**
 * Upload adapter for listing photos.
 * - If Cloudinary env vars are configured, uploads to Cloudinary.
 * - Otherwise falls back to placeholder URLs for frontend-only mode.
 */
export async function uploadListingImages(
  files: File[],
  options?: UploadListingImagesOptions
): Promise<string[]> {
  if (files.length === 0) return []

  const supabaseConfig = getSupabaseStorageConfig()
  const shouldTrySupabase =
    !!supabaseConfig && !!(options?.strict || options?.listingId || options?.userId)

  let lastError: unknown

  if (shouldTrySupabase) {
    try {
      return await uploadToSupabaseStorage(files, supabaseConfig, options)
    } catch (error) {
      lastError = error
    }
  }

  const cloudinaryConfig = getCloudinaryConfig()
  if (cloudinaryConfig) {
    try {
      return await uploadToCloudinary(
        files,
        cloudinaryConfig.cloudName,
        cloudinaryConfig.uploadPreset
      )
    } catch (error) {
      lastError = error
    }
  }

  if (options?.strict) {
    if (lastError instanceof Error) throw lastError
    throw new Error(
      lastError
        ? "Image upload failed. Please verify Supabase Storage/Cloudinary configuration."
        : `Image upload is not configured. Create a Supabase Storage bucket named "${SUPABASE_STORAGE_BUCKET}" (public) and set NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY, or configure Cloudinary.`
    )
  }

  return files.map(() => "/placeholder.jpg")
}
