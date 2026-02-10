import { relations, sql } from "drizzle-orm"
import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

export const userRoleEnum = pgEnum("user_role", ["student", "staff", "admin"])
export const listingTypeEnum = pgEnum("listing_type", ["lost", "found"])
export const listingStatusEnum = pgEnum("listing_status", [
  "active",
  "matched",
  "claimed",
  "closed",
  "archived",
])
export const claimStatusEnum = pgEnum("claim_status", ["pending", "approved", "rejected"])
export const notificationTypeEnum = pgEnum("notification_type", [
  "match",
  "claim_submitted",
  "claim_approved",
  "claim_rejected",
  "system",
])

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone"),
  role: userRoleEnum("role").notNull().default("student"),
  avatarUrl: text("avatar_url"),
  isBanned: boolean("is_banned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const listings = pgTable("listings", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: listingTypeEnum("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  location: text("location").notNull(),
  locationDetails: text("location_details"),
  dateOccurred: timestamp("date_occurred", { withTimezone: true }).notNull(),
  status: listingStatusEnum("status").notNull().default("active"),
  storageLocation: text("storage_location"),
  storageDetails: text("storage_details"),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  matchedListingId: uuid("matched_listing_id"),
  imageUrls: text("image_urls")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const photos = pgTable("photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull(),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => listings.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const claims = pgTable("claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => listings.id, { onDelete: "cascade" }),
  claimantId: uuid("claimant_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  reviewerId: uuid("reviewer_id").references(() => users.id, { onDelete: "set null" }),
  status: claimStatusEnum("status").notNull().default("pending"),
  proofDescription: text("proof_description").notNull(),
  proofPhotos: jsonb("proof_photos")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  rejectionReason: text("rejection_reason"),
  handoverAt: timestamp("handover_at", { withTimezone: true }),
  handoverNotes: text("handover_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  relatedListingId: uuid("related_listing_id").references(() => listings.id, {
    onDelete: "set null",
  }),
  relatedClaimId: uuid("related_claim_id").references(() => claims.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const usersRelations = relations(users, ({ many }) => ({
  listings: many(listings),
  notifications: many(notifications),
  claimsAsClaimant: many(claims, { relationName: "claims_claimant" }),
  claimsAsReviewer: many(claims, { relationName: "claims_reviewer" }),
}))

export const listingsRelations = relations(listings, ({ one, many }) => ({
  user: one(users, {
    fields: [listings.userId],
    references: [users.id],
  }),
  photos: many(photos),
  claims: many(claims),
}))

export const photosRelations = relations(photos, ({ one }) => ({
  listing: one(listings, {
    fields: [photos.listingId],
    references: [listings.id],
  }),
}))

export const claimsRelations = relations(claims, ({ one }) => ({
  listing: one(listings, {
    fields: [claims.listingId],
    references: [listings.id],
  }),
  claimant: one(users, {
    fields: [claims.claimantId],
    references: [users.id],
    relationName: "claims_claimant",
  }),
  reviewer: one(users, {
    fields: [claims.reviewerId],
    references: [users.id],
    relationName: "claims_reviewer",
  }),
}))

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  listing: one(listings, {
    fields: [notifications.relatedListingId],
    references: [listings.id],
  }),
  claim: one(claims, {
    fields: [notifications.relatedClaimId],
    references: [claims.id],
  }),
}))

export type DbUser = typeof users.$inferSelect
export type DbListing = typeof listings.$inferSelect
export type DbPhoto = typeof photos.$inferSelect
export type DbClaim = typeof claims.$inferSelect
export type DbNotification = typeof notifications.$inferSelect
