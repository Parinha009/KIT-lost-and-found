// User types
export type UserRole = "student" | "staff" | "admin"

export interface Profile {
  user_id: string
  full_name: string
  campus_email: string
  phone?: string
  role: UserRole
  created_at: string
}

export interface User {
  id: string
  email: string
  name: string
  phone?: string
  role: UserRole
  avatar_url?: string
  is_banned: boolean
  created_at: string
  updated_at: string
}

// Item categories
export const ITEM_CATEGORIES = [
  "Electronics",
  "Documents",
  "Keys",
  "Wallet",
  "Clothing",
  "Accessories",
  "Bags",
  "Books",
  "Sports Equipment",
  "Other",
] as const

export type ItemCategory = (typeof ITEM_CATEGORIES)[number]

// Campus locations
export const CAMPUS_LOCATIONS = [
  "Main Building",
  "Library",
  "Cafeteria",
  "Sports Complex",
  "Dormitory A",
  "Dormitory B",
  "Parking Lot",
  "Computer Lab",
  "Science Building",
  "Admin Office",
  "Other",
] as const

export type CampusLocation = (typeof CAMPUS_LOCATIONS)[number]

// Listing types
export type ListingType = "lost" | "found"
export type ListingStatus = "active" | "matched" | "claimed" | "closed" | "archived"

export interface Listing {
  id: string
  type: ListingType
  title: string
  description: string
  category: ItemCategory
  location: CampusLocation
  location_details?: string
  date_occurred: string
  status: ListingStatus
  storage_location?: string
  storage_details?: string
  matched_listing_id?: string
  image_urls?: string[]
  user_id: string
  user?: User
  photos: Photo[]
  created_at: string
  updated_at: string
}

export interface Photo {
  id: string
  url: string
  listing_id: string
  created_at: string
}

// Claim types
export type ClaimStatus = "pending" | "approved" | "rejected"

export interface Claim {
  id: string
  listing_id: string
  listing?: Listing
  claimant_id: string
  claimant?: User
  reviewer_id?: string
  reviewer?: User
  status: ClaimStatus
  proof_description: string
  proof_photos?: string[]
  rejection_reason?: string
  handover_at?: string
  handover_notes?: string
  created_at: string
  updated_at: string
}

// Notification types
export type NotificationType = "match" | "claim_submitted" | "claim_approved" | "claim_rejected" | "system"

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  is_read: boolean
  related_listing_id?: string
  related_claim_id?: string
  created_at: string
}

// Match types
export interface Match {
  id: string
  lost_listing_id: string
  found_listing_id: string
  confidence_score: number
  is_dismissed: boolean
  created_at: string
}

// Audit log
export type AuditAction =
  | "listing_created"
  | "listing_updated"
  | "listing_deleted"
  | "claim_submitted"
  | "claim_approved"
  | "claim_rejected"
  | "user_banned"
  | "user_restored"
  | "role_changed"

export interface AuditLog {
  id: string
  actor_id: string
  actor?: User
  action: AuditAction
  target_type: "listing" | "claim" | "user"
  target_id: string
  details?: Record<string, unknown>
  created_at: string
}

// Search/Filter types
export interface ListingFilters {
  search?: string
  type?: ListingType
  category?: ItemCategory
  location?: CampusLocation
  status?: ListingStatus
  dateFrom?: string
  dateTo?: string
}

// Form types
export interface CreateListingForm {
  type: ListingType
  title: string
  description: string
  category: ItemCategory
  location: CampusLocation
  location_details?: string
  date_occurred: string
  storage_location?: string
  storage_details?: string
  photos?: File[]
}

export interface CreateClaimForm {
  proof_description: string
  proof_photos?: File[]
}

// Stats types
export interface DashboardStats {
  total_lost: number
  total_found: number
  total_matched: number
  total_claimed: number
  recent_listings: Listing[]
  pending_claims: number
}
