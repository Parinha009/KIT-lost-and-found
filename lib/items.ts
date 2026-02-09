import { mockClaims, mockListings, mockNotifications, mockUsers } from "./mock-data"
import type {
  CampusLocation,
  Claim,
  ClaimStatus,
  ItemCategory,
  Listing,
  ListingFilters,
  ListingStatus,
  ListingType,
  Notification,
  NotificationType,
} from "./types"

export const LISTINGS_UPDATED_EVENT = "kit-lf-listings-updated"
const LISTINGS_STORAGE_KEY = "kit-lf-listings"
const CLAIMS_STORAGE_KEY = "kit-lf-claims"
const NOTIFICATIONS_STORAGE_KEY = "kit-lf-notifications"
const CLAIMS_UPDATED_EVENT = "kit-lf-claims-updated"
const NOTIFICATIONS_UPDATED_EVENT = "kit-lf-notifications-updated"

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "have",
  "near",
  "from",
  "item",
  "found",
  "lost",
  "your",
  "mine",
  "into",
  "about",
  "some",
])

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

export interface CreateClaimPayload {
  listing_id: string
  claimant_id: string
  proof_description: string
}

export interface UpdateClaimStatusPayload {
  status: ClaimStatus
  reviewer_id?: string
  rejection_reason?: string
  handover_notes?: string
  handover_at?: string
}

export interface ClaimMatchResult {
  isMatch: boolean
  score: number
  reasons: string[]
  linkedLostListingId?: string
}

export interface CreateNotificationPayload {
  user_id: string
  type: NotificationType
  title: string
  message: string
  related_listing_id?: string
  related_claim_id?: string
}

function emitEvent(eventName: string): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(eventName))
}

function cloneListing(listing: Listing): Listing {
  return {
    ...listing,
    user: listing.user ? { ...listing.user } : undefined,
    photos: listing.photos.map((photo) => ({ ...photo })),
  }
}

function cloneClaim(claim: Claim): Claim {
  return {
    ...claim,
    listing: claim.listing ? cloneListing(claim.listing) : undefined,
    claimant: claim.claimant ? { ...claim.claimant } : undefined,
    reviewer: claim.reviewer ? { ...claim.reviewer } : undefined,
    proof_photos: claim.proof_photos ? [...claim.proof_photos] : undefined,
  }
}

function cloneNotification(notification: Notification): Notification {
  return { ...notification }
}

function getDefaultListings(): Listing[] {
  return mockListings.map(cloneListing)
}

function getDefaultClaims(): Claim[] {
  return mockClaims.map(cloneClaim)
}

function getDefaultNotifications(): Notification[] {
  return mockNotifications.map(cloneNotification)
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
  emitEvent(LISTINGS_UPDATED_EVENT)
}

function getListingsSource(): Listing[] {
  const stored = readStoredListings()
  return stored ?? getDefaultListings()
}

function readStoredClaims(): Claim[] | null {
  if (!canUseStorage()) return null

  try {
    const raw = window.localStorage.getItem(CLAIMS_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Claim[]
    if (!Array.isArray(parsed)) return null

    const listings = getListingsSource()
    return parsed
      .filter((entry): entry is Claim => Boolean(entry && typeof entry === "object"))
      .map((entry) => {
        const listing = entry.listing ?? listings.find((item) => item.id === entry.listing_id)
        const claimant = entry.claimant ?? mockUsers.find((user) => user.id === entry.claimant_id)
        const reviewer = entry.reviewer_id
          ? entry.reviewer ?? mockUsers.find((user) => user.id === entry.reviewer_id)
          : undefined

        return {
          ...entry,
          listing,
          claimant,
          reviewer,
          proof_photos: Array.isArray(entry.proof_photos) ? [...entry.proof_photos] : undefined,
        }
      })
  } catch {
    return null
  }
}

function writeStoredClaims(claims: Claim[]): void {
  if (!canUseStorage()) return
  window.localStorage.setItem(CLAIMS_STORAGE_KEY, JSON.stringify(claims))
  emitEvent(CLAIMS_UPDATED_EVENT)
}

function getClaimsSource(): Claim[] {
  const stored = readStoredClaims()
  return stored ?? getDefaultClaims()
}

function readStoredNotifications(): Notification[] | null {
  if (!canUseStorage()) return null

  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Notification[]
    if (!Array.isArray(parsed)) return null

    return parsed
      .filter(
        (entry): entry is Notification =>
          Boolean(entry && typeof entry === "object" && typeof entry.user_id === "string")
      )
      .map((entry) => ({
        ...entry,
        is_read: Boolean(entry.is_read),
      }))
  } catch {
    return null
  }
}

function writeStoredNotifications(notifications: Notification[]): void {
  if (!canUseStorage()) return
  window.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications))
  emitEvent(NOTIFICATIONS_UPDATED_EVENT)
}

function getNotificationsSource(): Notification[] {
  const stored = readStoredNotifications()
  return stored ?? getDefaultNotifications()
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
}

function getOverlapScore(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left))
  const rightTokens = new Set(tokenize(right))

  if (leftTokens.size === 0 || rightTokens.size === 0) return 0

  let overlap = 0
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) overlap += 1
  })

  return overlap / Math.min(leftTokens.size, rightTokens.size)
}

function getListingMatchText(listing: Listing): string {
  return [
    listing.title,
    listing.description,
    listing.category,
    listing.location,
    listing.location_details,
  ]
    .filter(Boolean)
    .join(" ")
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
 * Evaluate how well a claim aligns with the found item and claimant's own lost reports.
 */
export function evaluateClaimMatch(
  listingId: string,
  claimantId: string,
  proofDescription: string
): ClaimMatchResult {
  const listing = getListing(listingId)
  if (!listing) {
    return {
      isMatch: false,
      score: 0,
      reasons: ["Listing was not found."],
    }
  }

  const listingText = getListingMatchText(listing)
  const proofToFoundScore = getOverlapScore(proofDescription, listingText)

  const claimantLostListings = getListingsSource().filter(
    (item) => item.user_id === claimantId && item.type === "lost" && item.status === "active"
  )
  const sameCategoryLostListings = claimantLostListings.filter(
    (item) => item.category === listing.category
  )

  let bestLostMatchScore = 0
  let linkedLostListingId: string | undefined

  sameCategoryLostListings.forEach((lostItem) => {
    const lostText = getListingMatchText(lostItem)
    const lostToFoundScore = getOverlapScore(lostText, listingText)
    const proofToLostScore = getOverlapScore(proofDescription, lostText)
    const combinedScore = (lostToFoundScore + proofToLostScore) / 2

    if (combinedScore > bestLostMatchScore) {
      bestLostMatchScore = combinedScore
      linkedLostListingId = lostItem.id
    }
  })

  const score =
    sameCategoryLostListings.length > 0
      ? Math.max(proofToFoundScore, bestLostMatchScore)
      : proofToFoundScore

  const minimumScore = sameCategoryLostListings.length > 0 ? 0.12 : 0.22
  const reasons: string[] = []

  if (sameCategoryLostListings.length === 0) {
    reasons.push(
      `You do not have an active lost listing in category "${listing.category}".`
    )
  } else if (!linkedLostListingId) {
    reasons.push("Your active lost listing details do not align with this found item.")
  }

  if (proofToFoundScore < 0.1) {
    reasons.push("Your claim text does not contain enough details matching this found item.")
  }

  if (score >= minimumScore) {
    if (linkedLostListingId) {
      reasons.push("Claim details align with your lost listing and this found item.")
    } else {
      reasons.push("Claim details align with this found item.")
    }
    return {
      isMatch: true,
      score,
      reasons,
      linkedLostListingId,
    }
  }

  return {
    isMatch: false,
    score,
    reasons,
    linkedLostListingId,
  }
}

/**
 * Create and persist a claim.
 */
export function createClaim(payload: CreateClaimPayload): Claim | null {
  const listing = getListing(payload.listing_id)
  if (!listing) return null

  const existingPending = getClaimsSource().some(
    (claim) =>
      claim.listing_id === payload.listing_id &&
      claim.claimant_id === payload.claimant_id &&
      claim.status === "pending"
  )

  if (existingPending) return null

  const now = new Date().toISOString()
  const claimant = mockUsers.find((user) => user.id === payload.claimant_id)

  const nextClaim: Claim = {
    id: `claim-${Date.now()}`,
    listing_id: payload.listing_id,
    listing,
    claimant_id: payload.claimant_id,
    claimant,
    status: "pending",
    proof_description: payload.proof_description,
    created_at: now,
    updated_at: now,
  }

  const nextClaims = [nextClaim, ...getClaimsSource()]
  writeStoredClaims(nextClaims)

  return nextClaim
}

/**
 * Update claim status and persist it.
 */
export function updateClaimStatus(
  claimId: string,
  payload: UpdateClaimStatusPayload
): Claim | null {
  const claims = getClaimsSource()
  const claimIndex = claims.findIndex((claim) => claim.id === claimId)
  if (claimIndex === -1) return null

  const currentClaim = claims[claimIndex]
  const now = new Date().toISOString()
  const reviewer =
    payload.reviewer_id !== undefined
      ? mockUsers.find((user) => user.id === payload.reviewer_id)
      : currentClaim.reviewer

  const updatedClaim: Claim = {
    ...currentClaim,
    status: payload.status,
    reviewer_id: payload.reviewer_id ?? currentClaim.reviewer_id,
    reviewer,
    rejection_reason:
      payload.status === "rejected"
        ? payload.rejection_reason || currentClaim.rejection_reason
        : undefined,
    handover_at:
      payload.status === "approved"
        ? payload.handover_at || currentClaim.handover_at || now
        : currentClaim.handover_at,
    handover_notes:
      payload.status === "approved"
        ? payload.handover_notes || currentClaim.handover_notes
        : currentClaim.handover_notes,
    updated_at: now,
  }

  claims[claimIndex] = updatedClaim
  writeStoredClaims(claims)

  if (payload.status === "approved") {
    updateListing(updatedClaim.listing_id, { status: "claimed" })
  }

  return updatedClaim
}

/**
 * Get claims for a specific listing.
 */
export function getListingClaims(listingId: string): Claim[] {
  return getClaimsSource()
    .filter((claim) => claim.listing_id === listingId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

/**
 * Get all claims.
 */
export function getAllClaims(): Claim[] {
  return [...getClaimsSource()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

/**
 * Get a single claim by ID.
 */
export function getClaim(id: string): Claim | undefined {
  return getClaimsSource().find((claim) => claim.id === id)
}

/**
 * Create and persist a notification.
 */
export function createNotification(payload: CreateNotificationPayload): Notification {
  const now = new Date().toISOString()
  const nextNotification: Notification = {
    id: `notif-${Date.now()}`,
    user_id: payload.user_id,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    is_read: false,
    related_listing_id: payload.related_listing_id,
    related_claim_id: payload.related_claim_id,
    created_at: now,
  }

  const nextNotifications = [nextNotification, ...getNotificationsSource()]
  writeStoredNotifications(nextNotifications)
  return nextNotification
}

/**
 * Get all notifications for a user.
 */
export function getUserNotifications(userId: string): Notification[] {
  return getNotificationsSource()
    .filter((notification) => notification.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

/**
 * Get unread notification count for a user.
 */
export function getUnreadNotificationCount(userId: string): number {
  return getNotificationsSource().filter(
    (notification) => notification.user_id === userId && !notification.is_read
  ).length
}

/**
 * Mark one notification as read.
 */
export function markNotificationAsRead(notificationId: string): boolean {
  const notifications = getNotificationsSource()
  const notificationIndex = notifications.findIndex(
    (notification) => notification.id === notificationId
  )
  if (notificationIndex === -1) return false

  if (notifications[notificationIndex].is_read) return true

  notifications[notificationIndex] = {
    ...notifications[notificationIndex],
    is_read: true,
  }
  writeStoredNotifications(notifications)
  return true
}

/**
 * Mark all notifications as read for a user.
 */
export function markAllNotificationsAsRead(userId: string): number {
  const notifications = getNotificationsSource()
  let updatedCount = 0

  const nextNotifications = notifications.map((notification) => {
    if (notification.user_id === userId && !notification.is_read) {
      updatedCount += 1
      return { ...notification, is_read: true }
    }
    return notification
  })

  if (updatedCount > 0) {
    writeStoredNotifications(nextNotifications)
  }

  return updatedCount
}

/**
 * Validate listing exists.
 */
export function listingExists(id: string): boolean {
  return getListing(id) !== undefined
}
