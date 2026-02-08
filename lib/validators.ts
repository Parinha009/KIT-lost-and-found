import { z } from 'zod'
import {
  ITEM_CATEGORIES,
  CAMPUS_LOCATIONS,
  type ListingType,
  type ItemCategory,
  type CampusLocation,
} from './types'

// Create listing form validation
export const createListingSchema = z.object({
  type: z.enum(['lost', 'found'] as const, {
    errorMap: () => ({ message: 'Type must be "lost" or "found"' }),
  }),
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must not exceed 100 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description must not exceed 2000 characters'),
  category: z.enum(ITEM_CATEGORIES as unknown as [string, ...string[]], {
    errorMap: () => ({ message: 'Invalid category' }),
  }),
  location: z.enum(CAMPUS_LOCATIONS as unknown as [string, ...string[]], {
    errorMap: () => ({ message: 'Invalid location' }),
  }),
  location_details: z
    .string()
    .max(500, 'Location details must not exceed 500 characters')
    .optional()
    .or(z.literal('')),
  date_occurred: z
    .string()
    .refine(
      (date) => !isNaN(Date.parse(date)),
      'Date must be a valid ISO date string'
    ),
  storage_location: z
    .string()
    .max(200, 'Storage location must not exceed 200 characters')
    .optional()
    .or(z.literal('')),
  storage_details: z
    .string()
    .max(500, 'Storage details must not exceed 500 characters')
    .optional()
    .or(z.literal('')),
})

export type CreateListingInput = z.infer<typeof createListingSchema>

// Create claim form validation
export const createClaimSchema = z.object({
  listing_id: z.string().min(1, 'Listing ID is required'),
  proof_description: z
    .string()
    .min(20, 'Proof description must be at least 20 characters')
    .max(2000, 'Proof description must not exceed 2000 characters'),
})

export type CreateClaimInput = z.infer<typeof createClaimSchema>

// Listing filters validation
export const listingFiltersSchema = z.object({
  search: z.string().optional(),
  type: z.enum(['lost', 'found'] as const).optional(),
  category: z.enum(ITEM_CATEGORIES as unknown as [string, ...string[]]).optional(),
  location: z.enum(CAMPUS_LOCATIONS as unknown as [string, ...string[]]).optional(),
  status: z
    .enum(['active', 'matched', 'claimed', 'closed', 'archived'] as const)
    .optional(),
  dateFrom: z
    .string()
    .refine(
      (date) => !isNaN(Date.parse(date)),
      'Start date must be a valid ISO date'
    )
    .optional(),
  dateTo: z
    .string()
    .refine(
      (date) => !isNaN(Date.parse(date)),
      'End date must be a valid ISO date'
    )
    .optional(),
})

export type ListingFiltersInput = z.infer<typeof listingFiltersSchema>
