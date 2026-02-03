import type {
  User,
  Listing,
  Claim,
  Notification,
  DashboardStats,
} from "./types"

// Mock Users
export const mockUsers: User[] = [
  {
    id: "user-1",
    email: "student@kit.edu.kh",
    name: "Sovann Chan",
    phone: "+855 12 345 678",
    role: "student",
    is_banned: false,
    created_at: "2024-01-15T08:00:00Z",
    updated_at: "2024-01-15T08:00:00Z",
  },
  {
    id: "user-2",
    email: "security@kit.edu.kh",
    name: "Dara Kim",
    phone: "+855 12 987 654",
    role: "staff",
    is_banned: false,
    created_at: "2024-01-10T08:00:00Z",
    updated_at: "2024-01-10T08:00:00Z",
  },
  {
    id: "user-3",
    email: "admin@kit.edu.kh",
    name: "Bopha Pich",
    role: "admin",
    is_banned: false,
    created_at: "2024-01-01T08:00:00Z",
    updated_at: "2024-01-01T08:00:00Z",
  },
]

// Mock Listings
export const mockListings: Listing[] = [
  {
    id: "listing-1",
    type: "lost",
    title: "Black Leather Wallet",
    description:
      "Lost my black leather wallet near the cafeteria. Contains student ID and some cash. Brand: Louis Vuitton (replica).",
    category: "Wallet",
    location: "Cafeteria",
    location_details: "Near the vending machines",
    date_occurred: "2024-01-20T12:30:00Z",
    status: "active",
    user_id: "user-1",
    user: mockUsers[0],
    photos: [],
    created_at: "2024-01-20T14:00:00Z",
    updated_at: "2024-01-20T14:00:00Z",
  },
  {
    id: "listing-2",
    type: "found",
    title: "Blue Backpack",
    description:
      "Found a blue Jansport backpack in the library. Contains some textbooks and a water bottle.",
    category: "Bags",
    location: "Library",
    location_details: "Second floor, study area",
    date_occurred: "2024-01-21T09:00:00Z",
    status: "active",
    storage_location: "Security Office",
    storage_details: "Shelf B-3",
    user_id: "user-2",
    user: mockUsers[1],
    photos: [
      {
        id: "photo-1",
        url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400",
        listing_id: "listing-2",
        created_at: "2024-01-21T09:00:00Z",
      },
    ],
    created_at: "2024-01-21T10:00:00Z",
    updated_at: "2024-01-21T10:00:00Z",
  },
  {
    id: "listing-3",
    type: "found",
    title: "iPhone 14 Pro",
    description: "Found an iPhone 14 Pro in space gray. Lock screen shows a photo of a cat.",
    category: "Electronics",
    location: "Main Building",
    location_details: "Room 102, left on a desk",
    date_occurred: "2024-01-22T14:00:00Z",
    status: "active",
    storage_location: "Security Office",
    storage_details: "Locked cabinet",
    user_id: "user-2",
    user: mockUsers[1],
    photos: [
      {
        id: "photo-2",
        url: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400",
        listing_id: "listing-3",
        created_at: "2024-01-22T14:00:00Z",
      },
    ],
    created_at: "2024-01-22T15:00:00Z",
    updated_at: "2024-01-22T15:00:00Z",
  },
  {
    id: "listing-4",
    type: "lost",
    title: "Car Keys with KIT Keychain",
    description:
      "Lost my car keys somewhere on campus. Has a blue KIT keychain and Honda key fob.",
    category: "Keys",
    location: "Parking Lot",
    date_occurred: "2024-01-23T08:00:00Z",
    status: "active",
    user_id: "user-1",
    user: mockUsers[0],
    photos: [],
    created_at: "2024-01-23T09:00:00Z",
    updated_at: "2024-01-23T09:00:00Z",
  },
  {
    id: "listing-5",
    type: "found",
    title: "Student ID Card",
    description: "Found a student ID card. Name partially visible: 'Sok...'",
    category: "Documents",
    location: "Computer Lab",
    date_occurred: "2024-01-23T16:00:00Z",
    status: "matched",
    storage_location: "Admin Office",
    user_id: "user-2",
    user: mockUsers[1],
    photos: [
      {
        id: "photo-3",
        url: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400",
        listing_id: "listing-5",
        created_at: "2024-01-23T16:00:00Z",
      },
    ],
    created_at: "2024-01-23T17:00:00Z",
    updated_at: "2024-01-24T08:00:00Z",
  },
  {
    id: "listing-6",
    type: "lost",
    title: "AirPods Pro Case",
    description: "Lost my AirPods Pro case (white). Might still have the AirPods inside.",
    category: "Electronics",
    location: "Sports Complex",
    location_details: "Basketball court area",
    date_occurred: "2024-01-24T18:00:00Z",
    status: "active",
    user_id: "user-1",
    user: mockUsers[0],
    photos: [],
    created_at: "2024-01-24T19:00:00Z",
    updated_at: "2024-01-24T19:00:00Z",
  },
]

// Mock Claims
export const mockClaims: Claim[] = [
  {
    id: "claim-1",
    listing_id: "listing-3",
    listing: mockListings[2],
    claimant_id: "user-1",
    claimant: mockUsers[0],
    status: "pending",
    proof_description:
      "This is my phone. The lock screen cat is named 'Mochi'. I can unlock it with Face ID to prove it.",
    created_at: "2024-01-23T08:00:00Z",
    updated_at: "2024-01-23T08:00:00Z",
  },
  {
    id: "claim-2",
    listing_id: "listing-5",
    listing: mockListings[4],
    claimant_id: "user-1",
    claimant: mockUsers[0],
    reviewer_id: "user-2",
    reviewer: mockUsers[1],
    status: "approved",
    proof_description: "My full name is Sokunthea and my student ID is KIT2024001.",
    handover_at: "2024-01-24T10:00:00Z",
    handover_notes: "Verified ID and handed over at Admin Office",
    created_at: "2024-01-24T08:00:00Z",
    updated_at: "2024-01-24T10:00:00Z",
  },
]

// Mock Notifications
export const mockNotifications: Notification[] = [
  {
    id: "notif-1",
    user_id: "user-1",
    type: "match",
    title: "Potential Match Found",
    message:
      "Your lost wallet might match a found item. Check the listing for more details.",
    is_read: false,
    related_listing_id: "listing-1",
    created_at: "2024-01-22T08:00:00Z",
  },
  {
    id: "notif-2",
    user_id: "user-1",
    type: "claim_approved",
    title: "Claim Approved",
    message:
      "Your claim for 'Student ID Card' has been approved. Please visit Admin Office for pickup.",
    is_read: true,
    related_claim_id: "claim-2",
    created_at: "2024-01-24T10:00:00Z",
  },
  {
    id: "notif-3",
    user_id: "user-2",
    type: "claim_submitted",
    title: "New Claim Submitted",
    message: "A new claim has been submitted for 'iPhone 14 Pro'. Please review.",
    is_read: false,
    related_claim_id: "claim-1",
    created_at: "2024-01-23T08:00:00Z",
  },
]

// Mock Dashboard Stats
export const mockDashboardStats: DashboardStats = {
  total_lost: 3,
  total_found: 3,
  total_matched: 1,
  total_claimed: 1,
  recent_listings: mockListings.slice(0, 4),
  pending_claims: 1,
}

// Current user (for demo)
export const currentUser = mockUsers[0]

// Helper functions
export function getListingById(id: string): Listing | undefined {
  return mockListings.find((l) => l.id === id)
}

export function getClaimsByListingId(listingId: string): Claim[] {
  return mockClaims.filter((c) => c.listing_id === listingId)
}

export function getUserNotifications(userId: string): Notification[] {
  return mockNotifications.filter((n) => n.user_id === userId)
}

export function getUnreadNotificationCount(userId: string): number {
  return mockNotifications.filter((n) => n.user_id === userId && !n.is_read).length
}
