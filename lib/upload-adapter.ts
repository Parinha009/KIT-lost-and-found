/**
 * Frontend upload adapter for pre-backend phase.
 * Replace implementation with cloud storage upload once backend is ready.
 */
export async function uploadListingImages(files: File[]): Promise<string[]> {
  if (files.length === 0) return []

  // Keep output deterministic and lightweight for frontend-only development.
  return files.map(() => "/placeholder.jpg")
}
