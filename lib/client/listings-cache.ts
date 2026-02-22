import type { Listing } from "@/lib/types"

export const LISTINGS_CACHE_KEY = "kit:listings:cache:v1"
export const LISTINGS_CACHE_TTL_MS = 30_000

export type ListingsCachePayload = {
  cachedAt: number
  data: Listing[]
}

function isListingsArray(value: unknown): value is Listing[] {
  return Array.isArray(value)
}

export function readListingsCache(): ListingsCachePayload | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.sessionStorage.getItem(LISTINGS_CACHE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<ListingsCachePayload>
    if (typeof parsed.cachedAt !== "number" || !isListingsArray(parsed.data)) {
      return null
    }

    return { cachedAt: parsed.cachedAt, data: parsed.data }
  } catch {
    return null
  }
}

export function isListingsCacheFresh(payload: ListingsCachePayload): boolean {
  return Date.now() - payload.cachedAt < LISTINGS_CACHE_TTL_MS
}

export function writeListingsCache(data: Listing[]): void {
  if (typeof window === "undefined") return

  const payload: ListingsCachePayload = {
    cachedAt: Date.now(),
    data,
  }

  try {
    window.sessionStorage.setItem(LISTINGS_CACHE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore cache write errors (e.g., private mode or storage quota)
  }
}

export function upsertListingCacheItem(nextListing: Listing): void {
  const cached = readListingsCache()
  if (!cached) return

  const items = [...cached.data]
  const index = items.findIndex((listing) => listing.id === nextListing.id)

  if (index >= 0) {
    items[index] = nextListing
  } else {
    items.unshift(nextListing)
  }

  writeListingsCache(items)
}

export function removeListingFromCache(listingId: string): void {
  const cached = readListingsCache()
  if (!cached) return

  const next = cached.data.filter((listing) => listing.id !== listingId)
  writeListingsCache(next)
}
