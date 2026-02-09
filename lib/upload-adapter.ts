const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1"

function getCloudinaryConfig() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !uploadPreset) return null

  return { cloudName, uploadPreset }
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

/**
 * Upload adapter for listing photos.
 * - If Cloudinary env vars are configured, uploads to Cloudinary.
 * - Otherwise falls back to placeholder URLs for frontend-only mode.
 */
export async function uploadListingImages(files: File[]): Promise<string[]> {
  if (files.length === 0) return []

  const cloudinaryConfig = getCloudinaryConfig()
  if (!cloudinaryConfig) {
    return files.map(() => "/placeholder.jpg")
  }

  try {
    return await uploadToCloudinary(
      files,
      cloudinaryConfig.cloudName,
      cloudinaryConfig.uploadPreset
    )
  } catch {
    return files.map(() => "/placeholder.jpg")
  }
}
