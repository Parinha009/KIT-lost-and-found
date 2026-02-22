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

async function uploadToAppRoute(files: File[], options?: UploadListingImagesOptions) {
  const formData = new FormData()
  if (options?.userId) formData.append("userId", options.userId)
  if (options?.listingId) formData.append("listingId", options.listingId)

  files.forEach((file) => {
    formData.append("files", file, file.name)
  })

  const response = await fetch("/api/uploads/listing-images", {
    method: "POST",
    body: formData,
  })

  const json = (await response.json()) as { ok?: boolean; urls?: string[]; error?: string }
  if (!response.ok || !json.ok || !Array.isArray(json.urls)) {
    throw new Error(json.error || `Upload failed with status ${response.status}`)
  }

  return json.urls.filter((url): url is string => typeof url === "string" && url.length > 0)
}

/**
 * Upload adapter for listing photos.
 * Uploads via server route to Supabase Storage bucket: "listing-images".
 */
export async function uploadListingImages(
  files: File[],
  options?: UploadListingImagesOptions
): Promise<string[]> {
  if (files.length === 0) return []

  let lastError: unknown

  try {
    // API-only uploads: server route handles Storage writes using service-role auth.
    return await uploadToAppRoute(files, options)
  } catch (error) {
    lastError = error
  }

  if (options?.strict) {
    if (lastError instanceof Error) throw lastError
    throw new Error(
      lastError
        ? "Image upload failed. Please verify Supabase Storage configuration."
        : `Image upload is not configured. Ensure "${SUPABASE_STORAGE_BUCKET}" exists and set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY on the server.`
    )
  }

  return files.map(() => "/placeholder.jpg")
}
