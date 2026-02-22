import { z } from 'zod'
import {
  ITEM_CATEGORIES,
  CAMPUS_LOCATIONS,
} from './types'

const campusEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Please enter a valid email address')
  .refine((value) => value.endsWith('@kit.edu.kh'), {
    message: 'Please use your KIT campus email (@kit.edu.kh)',
  })

const strongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password must not exceed 100 characters')
  .refine((value) => /[A-Z]/.test(value), {
    message: 'Password must include at least one uppercase letter',
  })
  .refine((value) => /[a-z]/.test(value), {
    message: 'Password must include at least one lowercase letter',
  })
  .refine((value) => /\d/.test(value), {
    message: 'Password must include at least one number',
  })

const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .refine((value) => value === '' || /^\+?\d{8,15}$/.test(value), {
    message: 'Phone must be numeric and 8 to 15 digits (optional + prefix)',
  })
  .transform((value) => (value === '' ? undefined : value))

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
  email: campusEmailSchema,
  password: z.string().min(1, 'Password is required'),
})

export type LoginInput = z.infer<typeof loginSchema>

const registerPayloadSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(50, 'Full name must not exceed 50 characters'),
  campus_email: campusEmailSchema,
  phone: phoneSchema,
  password: strongPasswordSchema,
})

export const registerSchema = registerPayloadSchema
  .extend({
    confirm_password: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

export type RegisterInput = z.infer<typeof registerSchema>
export type RegisterPayloadInput = z.infer<typeof registerPayloadSchema>
export { registerPayloadSchema }

export const forgotPasswordSchema = z.object({
  email: campusEmailSchema,
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
