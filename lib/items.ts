import {
  mockListings,
  mockClaims,
  getListingById as getMockListingById,
  getClaimsByListingId as getMockClaimsByListingId,
} from './mock-data'
import type { Listing, Claim, ListingFilters } from './types'

/**
 * Get all listings with optional filtering
 * In production, this would fetch from an API
 */
export function getListings(filters?: ListingFilters): Listing[] {
  let results = [...mockListings]

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
    results = results.filter(
      (item) => new Date(item.date_occurred) >= fromDate
    )
  }

  if (filters?.dateTo) {
    const toDate = new Date(filters.dateTo)
    results = results.filter(
      (item) => new Date(item.date_occurred) <= toDate
    )
  }

  return results
}

/**
 * Get a single listing by ID
 * In production, this would fetch from an API
 */
export function getListing(id: string): Listing | undefined {
  return getMockListingById(id)
}

/**
 * Get claims for a specific listing
 * In production, this would fetch from an API
 */
export function getListingClaims(listingId: string): Claim[] {
  return getMockClaimsByListingId(listingId)
}

/**
 * Get all claims (admin/demo purpose)
 */
export function getAllClaims(): Claim[] {
  return [...mockClaims]
}

/**
 * Get a single claim by ID
 */
export function getClaim(id: string): Claim | undefined {
  return mockClaims.find((claim) => claim.id === id)
}

/**
 * Validate listing exists
 */
export function listingExists(id: string): boolean {
  return getMockListingById(id) !== undefined
}
