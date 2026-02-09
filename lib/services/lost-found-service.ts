import * as items from "@/lib/items"
import type {
  CreateClaimPayload,
  CreateListingPayload,
  CreateNotificationPayload,
  ClaimMatchResult,
  UpdateClaimStatusPayload,
  UpdateListingPayload,
} from "@/lib/items"
import type { Claim, Listing, ListingFilters, Notification } from "@/lib/types"

export const LOST_FOUND_LISTINGS_UPDATED_EVENT = items.LISTINGS_UPDATED_EVENT

export interface LostFoundWebService {
  getListings(filters?: ListingFilters): Listing[]
  getListing(id: string): Listing | undefined
  createListing(payload: CreateListingPayload): Listing
  updateListing(id: string, payload: UpdateListingPayload): Listing | null
  deleteListing(id: string): boolean
  listingExists(id: string): boolean
  evaluateClaimMatch(
    listingId: string,
    claimantId: string,
    proofDescription: string
  ): ClaimMatchResult
  createClaim(payload: CreateClaimPayload): Claim | null
  updateClaimStatus(
    claimId: string,
    payload: UpdateClaimStatusPayload
  ): Claim | null
  getAllClaims(): Claim[]
  getClaim(id: string): Claim | undefined
  getListingClaims(listingId: string): Claim[]
  createNotification(payload: CreateNotificationPayload): Notification
  getUserNotifications(userId: string): Notification[]
  getUnreadNotificationCount(userId: string): number
  markNotificationAsRead(notificationId: string): boolean
  markAllNotificationsAsRead(userId: string): number
}

class LocalLostFoundWebService implements LostFoundWebService {
  getListings(filters?: ListingFilters): Listing[] {
    return items.getListings(filters)
  }

  getListing(id: string): Listing | undefined {
    return items.getListing(id)
  }

  createListing(payload: CreateListingPayload): Listing {
    return items.createListing(payload)
  }

  updateListing(id: string, payload: UpdateListingPayload): Listing | null {
    return items.updateListing(id, payload)
  }

  deleteListing(id: string): boolean {
    return items.deleteListing(id)
  }

  listingExists(id: string): boolean {
    return items.listingExists(id)
  }

  evaluateClaimMatch(
    listingId: string,
    claimantId: string,
    proofDescription: string
  ): ClaimMatchResult {
    return items.evaluateClaimMatch(listingId, claimantId, proofDescription)
  }

  createClaim(payload: CreateClaimPayload): Claim | null {
    return items.createClaim(payload)
  }

  updateClaimStatus(
    claimId: string,
    payload: UpdateClaimStatusPayload
  ): Claim | null {
    return items.updateClaimStatus(claimId, payload)
  }

  getAllClaims(): Claim[] {
    return items.getAllClaims()
  }

  getClaim(id: string): Claim | undefined {
    return items.getClaim(id)
  }

  getListingClaims(listingId: string): Claim[] {
    return items.getListingClaims(listingId)
  }

  createNotification(payload: CreateNotificationPayload): Notification {
    return items.createNotification(payload)
  }

  getUserNotifications(userId: string): Notification[] {
    return items.getUserNotifications(userId)
  }

  getUnreadNotificationCount(userId: string): number {
    return items.getUnreadNotificationCount(userId)
  }

  markNotificationAsRead(notificationId: string): boolean {
    return items.markNotificationAsRead(notificationId)
  }

  markAllNotificationsAsRead(userId: string): number {
    return items.markAllNotificationsAsRead(userId)
  }
}

const localLostFoundWebService = new LocalLostFoundWebService()

export function getLostFoundWebService(): LostFoundWebService {
  return localLostFoundWebService
}
