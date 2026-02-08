import type { ListingStatus, UserRole } from "@/lib/types"

export interface Conversation {
  id: string
  participantName: string
  participantRole: UserRole
  itemId: string
  itemTitle: string
  itemStatus: ListingStatus
  lastMessage: string
  lastMessageAt: string
  unreadCount: number
}

export type MessageSender = "me" | "participant"

export interface Message {
  id: string
  conversationId: string
  sender: MessageSender
  body: string
  createdAt: string
}
