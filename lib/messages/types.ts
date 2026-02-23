import type { ListingStatus, ListingType, UserRole } from "@/lib/types"

export interface Conversation {
  id: string
  participantName: string
  participantRole: UserRole
  itemId: string
  itemType: ListingType
  itemTitle: string
  itemStatus: ListingStatus
  lastMessage: string
  lastMessageAt: string
  unreadCount: number
}

export type MessageSender = "me" | "participant"

export type MessageAttachmentKind = "image" | "video"

export interface MessageAttachment {
  id: string
  kind: MessageAttachmentKind
  url: string
  fileName: string
  mimeType: string
  size: number
}

export interface Message {
  id: string
  conversationId: string
  sender: MessageSender
  body: string
  attachments?: MessageAttachment[]
  editedAt?: string
  createdAt: string
}
