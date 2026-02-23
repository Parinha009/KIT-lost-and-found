import { relations, sql } from "drizzle-orm"
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
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

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey(),
  fullName: text("full_name").notNull(),
  campusEmail: text("campus_email").notNull().unique(),
  phone: text("phone"),
  role: userRoleEnum("role").notNull().default("student"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type").$type<"lost" | "found">().notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  location: text("location").notNull(),
  locationDetails: text("location_details"),
  dateOccurred: timestamp("date_occurred", { withTimezone: true }).notNull(),
  storageLocation: text("storage_location"),
  storageDetails: text("storage_details"),
  imageUrls: text("image_urls")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => profiles.userId, { onDelete: "restrict" }),
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
    .references(() => items.id, { onDelete: "cascade" }),
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
  relatedListingId: uuid("related_listing_id").references(() => items.id, {
    onDelete: "set null",
  }),
  relatedClaimId: uuid("related_claim_id").references(() => claims.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const chatConversations = pgTable("chat_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  claimId: uuid("claim_id").references(() => claims.id, { onDelete: "set null" }).unique(),
  listingId: uuid("listing_id").references(() => items.id, { onDelete: "set null" }),
  itemTitle: text("item_title").notNull().default("Conversation"),
  itemStatus: text("item_status").notNull().default("active"),
  participantA: uuid("participant_a")
    .notNull()
    .references(() => profiles.userId, { onDelete: "cascade" }),
  participantB: uuid("participant_b")
    .notNull()
    .references(() => profiles.userId, { onDelete: "cascade" }),
  lastMessage: text("last_message").notNull().default("No messages yet"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => chatConversations.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => profiles.userId, { onDelete: "cascade" }),
  body: text("body").notNull().default(""),
  attachments: jsonb("attachments")
    .$type<Array<Record<string, unknown>>>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const chatConversationStates = pgTable(
  "chat_conversation_states",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => chatConversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    unreadCount: integer("unread_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.conversationId, table.userId] }),
  })
)

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  listings: many(listings),
  notifications: many(notifications),
  claimsAsClaimant: many(claims, { relationName: "claims_claimant" }),
  claimsAsReviewer: many(claims, { relationName: "claims_reviewer" }),
}))

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
  items: many(items),
}))

export const itemsRelations = relations(items, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [items.createdBy],
    references: [profiles.userId],
  }),
  claims: many(claims),
}))

export const listingsRelations = relations(listings, ({ one, many }) => ({
  user: one(users, {
    fields: [listings.userId],
    references: [users.id],
  }),
  photos: many(photos),
}))

export const photosRelations = relations(photos, ({ one }) => ({
  listing: one(listings, {
    fields: [photos.listingId],
    references: [listings.id],
  }),
}))

export const claimsRelations = relations(claims, ({ one }) => ({
  listing: one(items, {
    fields: [claims.listingId],
    references: [items.id],
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
  listing: one(items, {
    fields: [notifications.relatedListingId],
    references: [items.id],
  }),
  claim: one(claims, {
    fields: [notifications.relatedClaimId],
    references: [claims.id],
  }),
}))

export const chatConversationsRelations = relations(chatConversations, ({ one, many }) => ({
  claim: one(claims, {
    fields: [chatConversations.claimId],
    references: [claims.id],
  }),
  listing: one(items, {
    fields: [chatConversations.listingId],
    references: [items.id],
  }),
  participantAProfile: one(profiles, {
    fields: [chatConversations.participantA],
    references: [profiles.userId],
    relationName: "chat_participant_a",
  }),
  participantBProfile: one(profiles, {
    fields: [chatConversations.participantB],
    references: [profiles.userId],
    relationName: "chat_participant_b",
  }),
  messages: many(chatMessages),
  participantStates: many(chatConversationStates),
}))

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatMessages.conversationId],
    references: [chatConversations.id],
  }),
  senderProfile: one(profiles, {
    fields: [chatMessages.senderId],
    references: [profiles.userId],
  }),
}))

export const chatConversationStatesRelations = relations(chatConversationStates, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatConversationStates.conversationId],
    references: [chatConversations.id],
  }),
  userProfile: one(profiles, {
    fields: [chatConversationStates.userId],
    references: [profiles.userId],
  }),
}))

export type DbUser = typeof users.$inferSelect
export type DbProfile = typeof profiles.$inferSelect
export type DbItem = typeof items.$inferSelect
export type DbListing = typeof listings.$inferSelect
export type DbPhoto = typeof photos.$inferSelect
export type DbClaim = typeof claims.$inferSelect
export type DbNotification = typeof notifications.$inferSelect
export type DbChatConversation = typeof chatConversations.$inferSelect
export type DbChatMessage = typeof chatMessages.$inferSelect
export type DbChatConversationState = typeof chatConversationStates.$inferSelect
