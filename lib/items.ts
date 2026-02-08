import { mockClaims, mockListings, mockUsers } from "./mock-data"
import type {
  CampusLocation,
  Claim,
  ItemCategory,
  Listing,
  ListingFilters,
  ListingStatus,
  ListingType,
} from "./types"

const LISTINGS_STORAGE_KEY = "kit-lf-listings"

export interface CreateListingPayload {
  type: ListingType
  title: string
  description: string
  category: ItemCategory
  location: CampusLocation
  location_details?: string
  date_occurred: string
  storage_location?: string
  storage_details?: string
  user_id: string
  photoUrls?: string[]
}

export interface UpdateListingPayload {
  title?: string
  description?: string
  category?: ItemCategory
  location?: CampusLocation
  location_details?: string
  date_occurred?: string
  storage_location?: string
  storage_details?: string
  status?: ListingStatus
  photoUrls?: string[]
}

function cloneListing(listing: Listing): Listing {
  return {
    ...listing,
    user: listing.user ? { ...listing.user } : undefined,
    photos: listing.photos.map((photo) => ({ ...photo })),
  }
}

function getDefaultListings(): Listing[] {
  return mockListings.map(cloneListing)
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function readStoredListings(): Listing[] | null {
  if (!canUseStorage()) return null

  try {
    const raw = window.localStorage.getItem(LISTINGS_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Listing[]
    if (!Array.isArray(parsed)) return null

    return parsed
      .filter((entry): entry is Listing => Boolean(entry && typeof entry === "object"))
      .map((entry) => {
        const fallbackUser = mockUsers.find((user) => user.id === entry.user_id)
        return {
          ...entry,
          user: entry.user ?? fallbackUser,
          photos: Array.isArray(entry.photos)
            ? entry.photos.map((photo) => ({ ...photo }))
            : [],
        }
      })
  } catch {
    return null
  }
}

function writeStoredListings(listings: Listing[]): void {
  if (!canUseStorage()) return
  window.localStorage.setItem(LISTINGS_STORAGE_KEY, JSON.stringify(listings))
}

function getListingsSource(): Listing[] {
  const stored = readStoredListings()
  return stored ?? getDefaultListings()
}

/**
 * Get all listings with optional filtering.
 * Uses localStorage-backed frontend store and falls back to mock seed data.
 */
export function getListings(filters?: ListingFilters): Listing[] {
  let results = getListingsSource()

  if (filters?.type) {
    results = results.filter((item) => item.type === filters.type)
  }

  if (filters?.category) {
    results = results.filter((item) => item.category === filters.category)
  }

  if (filters?.location) {
    results = results.filter((item) => item.location === filters.location)
  }

  if (filters?.status) {
    results = results.filter((item) => item.status === filters.status)
  }

  if (filters?.search) {
    const searchLower = filters.search.toLowerCase()
    results = results.filter(
      (item) =>
        item.title.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower)
    )
  }

  if (filters?.dateFrom) {
    const fromDate = new Date(filters.dateFrom)
    results = results.filter((item) => new Date(item.date_occurred) >= fromDate)
  }

  if (filters?.dateTo) {
    const toDate = new Date(filters.dateTo)
    results = results.filter((item) => new Date(item.date_occurred) <= toDate)
  }

  return [...results].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

/**
 * Create and persist a new listing in the frontend store.
 */
export function createListing(payload: CreateListingPayload): Listing {
  const now = new Date().toISOString()
  const photoUrls = payload.photoUrls ?? []
  const user = mockUsers.find((candidate) => candidate.id === payload.user_id)
  const listingId = `listing-${Date.now()}`

  const nextListing: Listing = {
    id: listingId,
    type: payload.type,
    title: payload.title,
    description: payload.description,
    category: payload.category,
    location: payload.location,
    location_details: payload.location_details || undefined,
    date_occurred: payload.date_occurred,
    status: "active",
    storage_location: payload.storage_location || undefined,
    storage_details: payload.storage_details || undefined,
    user_id: payload.user_id,
    user,
    photos: photoUrls.map((url, index) => ({
      id: `photo-${Date.now()}-${index}`,
      url,
      listing_id: listingId,
      created_at: now,
    })),
    created_at: now,
    updated_at: now,
  }

  const nextListings = [nextListing, ...getListingsSource()]
  writeStoredListings(nextListings)

  return nextListing
}

/**
 * Update an existing listing and persist changes.
 */
export function updateListing(id: string, payload: UpdateListingPayload): Listing | null {
  const currentListings = getListingsSource()
  const index = currentListings.findIndex((listing) => listing.id === id)
  if (index === -1) return null

  const target = currentListings[index]
  const now = new Date().toISOString()

  const updatedPhotos =
    payload.photoUrls !== undefined
      ? payload.photoUrls.map((url, photoIndex) => ({
          id: target.photos[photoIndex]?.id ?? `photo-${Date.now()}-${photoIndex}`,
          url,
          listing_id: target.id,
          created_at: target.photos[photoIndex]?.created_at ?? now,
        }))
      : target.photos

  const updated: Listing = {
    ...target,
    ...payload,
    location_details:
      payload.location_details !== undefined ? payload.location_details || undefined : target.location_details,
    storage_location:
      payload.storage_location !== undefined ? payload.storage_location || undefined : target.storage_location,
    storage_details:
      payload.storage_details !== undefined ? payload.storage_details || undefined : target.storage_details,
    photos: updatedPhotos,
    updated_at: now,
  }

  currentListings[index] = updated
  writeStoredListings(currentListings)
  return updated
}

/**
 * Delete a listing from the frontend store.
 */
export function deleteListing(id: string): boolean {
  const currentListings = getListingsSource()
  const nextListings = currentListings.filter((listing) => listing.id !== id)
  if (nextListings.length === currentListings.length) return false
  writeStoredListings(nextListings)
  return true
}

/**
 * Get a single listing by ID.
 */
export function getListing(id: string): Listing | undefined {
  return getListingsSource().find((listing) => listing.id === id)
}

/**
 * Get claims for a specific listing (mock for frontend phase).
 */
export function getListingClaims(listingId: string): Claim[] {
  return mockClaims.filter((claim) => claim.listing_id === listingId)
}

/**
 * Get all claims (admin/demo purpose).
 */
export function getAllClaims(): Claim[] {
  return [...mockClaims]
}

/**
 * Get a single claim by ID.
 */
export function getClaim(id: string): Claim | undefined {
  return mockClaims.find((claim) => claim.id === id)
}

/**
 * Validate listing exists.
 */
export function listingExists(id: string): boolean {
  return getListing(id) !== undefined
}
