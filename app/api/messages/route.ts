import { NextResponse } from "next/server"
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm"
import { dbSchema, getDbOrNull } from "@/lib/db"
import type { ListingStatus, UserRole } from "@/lib/types"
import type { Conversation, Message, MessageAttachment } from "@/lib/messages/types"

type Actor = {
  id: string
  role: UserRole
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

async function getActorFromProfile(
  db: NonNullable<ReturnType<typeof getDbOrNull>>,
  request: Request
): Promise<Actor | null> {
  const headerUserId = request.headers.get("x-user-id")?.trim()
  if (!headerUserId) return null

  const [profile] = await db
    .select({
      userId: dbSchema.profiles.userId,
      role: dbSchema.profiles.role,
    })
    .from(dbSchema.profiles)
    .where(eq(dbSchema.profiles.userId, headerUserId))
    .limit(1)

  if (!profile) return null
  return { id: profile.userId, role: profile.role }
}

function normalizeItemStatus(value: string | null): ListingStatus {
  if (
    value === "active" ||
    value === "matched" ||
    value === "claimed" ||
    value === "closed" ||
    value === "archived"
  ) {
    return value
  }
  return "active"
}

function asAttachments(value: unknown): MessageAttachment[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry): MessageAttachment | null => {
      if (!entry || typeof entry !== "object") return null
      const row = entry as Record<string, unknown>
      if (
        (row.kind !== "image" && row.kind !== "video") ||
        typeof row.url !== "string" ||
        typeof row.fileName !== "string" ||
        typeof row.mimeType !== "string" ||
        typeof row.size !== "number"
      ) {
        return null
      }

      return {
        id:
          typeof row.id === "string" && row.id.trim().length > 0
            ? row.id
            : crypto.randomUUID(),
        kind: row.kind,
        url: row.url,
        fileName: row.fileName,
        mimeType: row.mimeType,
        size: row.size,
      }
    })
    .filter((value): value is MessageAttachment => value !== null)
}

function toPreview(body: string, attachments: MessageAttachment[]): string {
  if (body.trim().length > 0) return body.trim()
  if (attachments.length === 0) return "No messages yet"
  return attachments.length === 1 ? "Sent an attachment" : `Sent ${attachments.length} attachments`
}

async function ensureClaimConversations(
  db: NonNullable<ReturnType<typeof getDbOrNull>>,
  actorId: string
): Promise<void> {
  const claimRows = await db
    .select({
      claimId: dbSchema.claims.id,
      listingId: dbSchema.claims.listingId,
      claimantId: dbSchema.claims.claimantId,
      listingOwnerId: dbSchema.items.createdBy,
      itemTitle: dbSchema.items.name,
    })
    .from(dbSchema.claims)
    .innerJoin(dbSchema.items, eq(dbSchema.claims.listingId, dbSchema.items.id))
    .where(
      or(eq(dbSchema.claims.claimantId, actorId), eq(dbSchema.items.createdBy, actorId))
    )

  if (claimRows.length === 0) return

  const participantIds = Array.from(
    new Set(claimRows.flatMap((row) => [row.claimantId, row.listingOwnerId]))
  )
  const participantProfiles = participantIds.length
    ? await db
        .select({ userId: dbSchema.profiles.userId })
        .from(dbSchema.profiles)
        .where(inArray(dbSchema.profiles.userId, participantIds))
    : []
  const participantSet = new Set(participantProfiles.map((profile) => profile.userId))

  const now = new Date()
  for (const claimRow of claimRows) {
    if (claimRow.claimantId === claimRow.listingOwnerId) continue
    if (!participantSet.has(claimRow.claimantId) || !participantSet.has(claimRow.listingOwnerId)) {
      continue
    }

    await db
      .insert(dbSchema.chatConversations)
      .values({
        claimId: claimRow.claimId,
        listingId: claimRow.listingId,
        itemTitle: claimRow.itemTitle,
        itemStatus: "active",
        participantA: claimRow.claimantId,
        participantB: claimRow.listingOwnerId,
        lastMessage: "Claim conversation started",
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: dbSchema.chatConversations.claimId,
      })
  }

  const claimIds = claimRows.map((row) => row.claimId)
  const conversations = await db
    .select({
      id: dbSchema.chatConversations.id,
      participantA: dbSchema.chatConversations.participantA,
      participantB: dbSchema.chatConversations.participantB,
    })
    .from(dbSchema.chatConversations)
    .where(inArray(dbSchema.chatConversations.claimId, claimIds))

  const stateRows = conversations.flatMap((conversation) => [
    {
      conversationId: conversation.id,
      userId: conversation.participantA,
      unreadCount: 0,
      updatedAt: now,
    },
    {
      conversationId: conversation.id,
      userId: conversation.participantB,
      unreadCount: 0,
      updatedAt: now,
    },
  ])

  if (stateRows.length > 0) {
    await db.insert(dbSchema.chatConversationStates).values(stateRows).onConflictDoNothing()
  }
}

async function getConversationForActor(
  db: NonNullable<ReturnType<typeof getDbOrNull>>,
  actorId: string,
  conversationId: string
) {
  const [conversation] = await db
    .select()
    .from(dbSchema.chatConversations)
    .where(
      and(
        eq(dbSchema.chatConversations.id, conversationId),
        or(
          eq(dbSchema.chatConversations.participantA, actorId),
          eq(dbSchema.chatConversations.participantB, actorId)
        )
      )
    )
    .limit(1)

  return conversation || null
}

async function updateConversationPreview(
  db: NonNullable<ReturnType<typeof getDbOrNull>>,
  conversationId: string
) {
  const [latest] = await db
    .select()
    .from(dbSchema.chatMessages)
    .where(eq(dbSchema.chatMessages.conversationId, conversationId))
    .orderBy(desc(dbSchema.chatMessages.createdAt))
    .limit(1)

  const now = new Date()
  if (!latest) {
    await db
      .update(dbSchema.chatConversations)
      .set({
        lastMessage: "No messages yet",
        lastMessageAt: now,
        updatedAt: now,
      })
      .where(eq(dbSchema.chatConversations.id, conversationId))
    return
  }

  const attachments = asAttachments(latest.attachments)
  await db
    .update(dbSchema.chatConversations)
    .set({
      lastMessage: toPreview(latest.body, attachments),
      lastMessageAt: latest.createdAt,
      updatedAt: now,
    })
    .where(eq(dbSchema.chatConversations.id, conversationId))
}

export async function GET(request: Request) {
  const db = getDbOrNull()
  if (!db) return jsonError("Database not configured", 503)

  const actor = await getActorFromProfile(db, request)
  if (!actor) return jsonError("Unauthorized", 401)

  try {
    await ensureClaimConversations(db, actor.id)

    const conversations = await db
      .select()
      .from(dbSchema.chatConversations)
      .where(
        or(
          eq(dbSchema.chatConversations.participantA, actor.id),
          eq(dbSchema.chatConversations.participantB, actor.id)
        )
      )
      .orderBy(desc(dbSchema.chatConversations.lastMessageAt))

    if (conversations.length === 0) {
      return NextResponse.json({
        ok: true,
        data: { conversations: [] as Conversation[], messages: [] as Message[] },
      })
    }

    const conversationIds = conversations.map((conversation) => conversation.id)
    const listingIds = conversations
      .map((conversation) => conversation.listingId)
      .filter((listingId): listingId is string => typeof listingId === "string")
    const otherParticipantIds = conversations.map((conversation) =>
      conversation.participantA === actor.id ? conversation.participantB : conversation.participantA
    )

    const [profiles, states, messages, items] = await Promise.all([
      db
        .select()
        .from(dbSchema.profiles)
        .where(inArray(dbSchema.profiles.userId, otherParticipantIds)),
      db
        .select()
        .from(dbSchema.chatConversationStates)
        .where(
          and(
            inArray(dbSchema.chatConversationStates.conversationId, conversationIds),
            eq(dbSchema.chatConversationStates.userId, actor.id)
          )
        ),
      db
        .select()
        .from(dbSchema.chatMessages)
        .where(inArray(dbSchema.chatMessages.conversationId, conversationIds))
        .orderBy(asc(dbSchema.chatMessages.createdAt)),
      listingIds.length
        ? db
            .select({
              id: dbSchema.items.id,
              type: dbSchema.items.type,
            })
            .from(dbSchema.items)
            .where(inArray(dbSchema.items.id, listingIds))
        : Promise.resolve([]),
    ])

    const profileMap = new Map(profiles.map((profile) => [profile.userId, profile]))
    const stateMap = new Map(states.map((state) => [state.conversationId, state]))
    const itemMap = new Map(items.map((item) => [item.id, item]))

    const mappedConversations: Conversation[] = conversations.map((conversation) => {
      const otherId =
        conversation.participantA === actor.id ? conversation.participantB : conversation.participantA
      const otherProfile = profileMap.get(otherId)
      const state = stateMap.get(conversation.id)

      return {
        id: conversation.id,
        participantName: otherProfile?.fullName || "Unknown User",
        participantRole: otherProfile?.role || "student",
        itemId: conversation.listingId || conversation.id,
        itemType:
          (conversation.listingId ? itemMap.get(conversation.listingId)?.type : undefined) ||
          "found",
        itemTitle: conversation.itemTitle,
        itemStatus: normalizeItemStatus(conversation.itemStatus),
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt.toISOString(),
        unreadCount: state?.unreadCount ?? 0,
      }
    })

    const mappedMessages: Message[] = messages.map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      sender: message.senderId === actor.id ? "me" : "participant",
      body: message.body,
      attachments: asAttachments(message.attachments),
      editedAt: message.editedAt?.toISOString(),
      createdAt: message.createdAt.toISOString(),
    }))

    return NextResponse.json({
      ok: true,
      data: {
        conversations: mappedConversations,
        messages: mappedMessages,
      },
    })
  } catch (error) {
    console.error("[api/messages][GET] failed", error)
    return jsonError("Failed to load messages", 500)
  }
}

type MessagesActionBody =
  | {
      action: "send"
      conversationId: string
      body?: string
      attachments?: MessageAttachment[]
    }
  | {
      action: "edit_message"
      messageId: string
      body: string
    }
  | {
      action: "delete_message"
      messageId: string
    }
  | {
      action: "mark_read" | "mark_unread" | "clear_conversation" | "delete_conversation"
      conversationId: string
    }

export async function POST(request: Request) {
  const db = getDbOrNull()
  if (!db) return jsonError("Database not configured", 503)

  const actor = await getActorFromProfile(db, request)
  if (!actor) return jsonError("Unauthorized", 401)

  let body: MessagesActionBody
  try {
    body = (await request.json()) as MessagesActionBody
  } catch {
    return jsonError("Invalid JSON body")
  }

  const now = new Date()

  try {
    if (body.action === "send") {
      const conversation = await getConversationForActor(db, actor.id, body.conversationId)
      if (!conversation) return jsonError("Conversation not found", 404)

      const messageBody = (body.body || "").trim()
      const attachments = asAttachments(body.attachments)
      if (!messageBody && attachments.length === 0) {
        return jsonError("Message cannot be empty", 422)
      }
      const attachmentRecords: Array<Record<string, unknown>> = attachments.map((attachment) => ({
        id: attachment.id,
        kind: attachment.kind,
        url: attachment.url,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.size,
      }))

      const [created] = await db
        .insert(dbSchema.chatMessages)
        .values({
          conversationId: conversation.id,
          senderId: actor.id,
          body: messageBody,
          attachments: attachmentRecords,
          createdAt: now,
        })
        .returning()

      await db
        .update(dbSchema.chatConversations)
        .set({
          lastMessage: toPreview(messageBody, attachments),
          lastMessageAt: now,
          updatedAt: now,
        })
        .where(eq(dbSchema.chatConversations.id, conversation.id))

      const otherParticipantId =
        conversation.participantA === actor.id ? conversation.participantB : conversation.participantA

      await db
        .insert(dbSchema.chatConversationStates)
        .values({
          conversationId: conversation.id,
          userId: actor.id,
          unreadCount: 0,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            dbSchema.chatConversationStates.conversationId,
            dbSchema.chatConversationStates.userId,
          ],
          set: { unreadCount: 0, updatedAt: now },
        })

      await db
        .insert(dbSchema.chatConversationStates)
        .values({
          conversationId: conversation.id,
          userId: otherParticipantId,
          unreadCount: 1,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            dbSchema.chatConversationStates.conversationId,
            dbSchema.chatConversationStates.userId,
          ],
          set: {
            unreadCount: sql`${dbSchema.chatConversationStates.unreadCount} + 1`,
            updatedAt: now,
          },
        })

      return NextResponse.json({
        ok: true,
        data: {
          id: created.id,
          conversationId: created.conversationId,
          sender: "me",
          body: created.body,
          attachments: asAttachments(created.attachments),
          editedAt: created.editedAt?.toISOString(),
          createdAt: created.createdAt.toISOString(),
        } satisfies Message,
      })
    }

    if (body.action === "edit_message") {
      const nextBody = body.body.trim()
      if (!nextBody) return jsonError("Message cannot be empty", 422)

      const [existing] = await db
        .select()
        .from(dbSchema.chatMessages)
        .where(eq(dbSchema.chatMessages.id, body.messageId))
        .limit(1)

      if (!existing) return jsonError("Message not found", 404)
      if (existing.senderId !== actor.id) return jsonError("Forbidden", 403)

      const conversation = await getConversationForActor(db, actor.id, existing.conversationId)
      if (!conversation) return jsonError("Conversation not found", 404)

      await db
        .update(dbSchema.chatMessages)
        .set({
          body: nextBody,
          editedAt: now,
        })
        .where(eq(dbSchema.chatMessages.id, existing.id))

      await updateConversationPreview(db, existing.conversationId)
      return NextResponse.json({ ok: true })
    }

    if (body.action === "delete_message") {
      const [existing] = await db
        .select()
        .from(dbSchema.chatMessages)
        .where(eq(dbSchema.chatMessages.id, body.messageId))
        .limit(1)

      if (!existing) return jsonError("Message not found", 404)
      if (existing.senderId !== actor.id) return jsonError("Forbidden", 403)

      const conversation = await getConversationForActor(db, actor.id, existing.conversationId)
      if (!conversation) return jsonError("Conversation not found", 404)

      await db.delete(dbSchema.chatMessages).where(eq(dbSchema.chatMessages.id, existing.id))
      await updateConversationPreview(db, existing.conversationId)
      return NextResponse.json({ ok: true })
    }

    if (
      body.action === "mark_read" ||
      body.action === "mark_unread" ||
      body.action === "clear_conversation" ||
      body.action === "delete_conversation"
    ) {
      const conversation = await getConversationForActor(db, actor.id, body.conversationId)
      if (!conversation) return jsonError("Conversation not found", 404)

      if (body.action === "mark_read") {
        await db
          .insert(dbSchema.chatConversationStates)
          .values({
            conversationId: conversation.id,
            userId: actor.id,
            unreadCount: 0,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              dbSchema.chatConversationStates.conversationId,
              dbSchema.chatConversationStates.userId,
            ],
            set: { unreadCount: 0, updatedAt: now },
          })

        return NextResponse.json({ ok: true })
      }

      if (body.action === "mark_unread") {
        await db
          .insert(dbSchema.chatConversationStates)
          .values({
            conversationId: conversation.id,
            userId: actor.id,
            unreadCount: 1,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              dbSchema.chatConversationStates.conversationId,
              dbSchema.chatConversationStates.userId,
            ],
            set: {
              unreadCount: sql`greatest(${dbSchema.chatConversationStates.unreadCount}, 1)`,
              updatedAt: now,
            },
          })

        return NextResponse.json({ ok: true })
      }

      if (body.action === "clear_conversation") {
        await db
          .delete(dbSchema.chatMessages)
          .where(eq(dbSchema.chatMessages.conversationId, conversation.id))
        await updateConversationPreview(db, conversation.id)
        await db
          .insert(dbSchema.chatConversationStates)
          .values({
            conversationId: conversation.id,
            userId: actor.id,
            unreadCount: 0,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              dbSchema.chatConversationStates.conversationId,
              dbSchema.chatConversationStates.userId,
            ],
            set: { unreadCount: 0, updatedAt: now },
          })

        return NextResponse.json({ ok: true })
      }

      await db
        .delete(dbSchema.chatConversations)
        .where(eq(dbSchema.chatConversations.id, conversation.id))
      return NextResponse.json({ ok: true })
    }

    return jsonError("Unsupported action", 422)
  } catch (error) {
    console.error("[api/messages][POST] failed", error)
    return jsonError("Failed to process message action", 500)
  }
}
