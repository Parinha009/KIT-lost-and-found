import { z } from 'zod'
import {
  ITEM_CATEGORIES,
  CAMPUS_LOCATIONS,
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

// Login form validation
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .refine((value) => value.toLowerCase().endsWith("@kit.edu.kh"), {
      message: "Please use your KIT campus email (@kit.edu.kh)",
    }),
  password: z.string().min(1, "Password is required"),
})

export type LoginInput = z.infer<typeof loginSchema>

// Register form validation
export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters")
      .max(100, "Full name must not exceed 100 characters"),
    email: z
      .string()
      .trim()
      .email("Please enter a valid email address")
      .refine((value) => value.endsWith("@kit.edu.kh"), {
        message: "Please use your KIT campus email (@kit.edu.kh)",
      }),
    phone: z
      .string()
      .trim()
      .max(30, "Phone number must not exceed 30 characters")
      .optional()
      .or(z.literal("")),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100, "Password must not exceed 100 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export type RegisterInput = z.infer<typeof registerSchema>
