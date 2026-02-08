import type { Conversation, Message } from "@/lib/messages/types"

const seedConversations: Conversation[] = [
  {
    id: "conv-1",
    participantName: "Dara Kim",
    participantRole: "staff",
    itemId: "listing-3",
    itemTitle: "iPhone 14 Pro",
    itemStatus: "active",
    lastMessage: "Please describe the wallpaper so we can verify ownership.",
    lastMessageAt: "2026-02-07T15:10:00Z",
    unreadCount: 1,
  },
  {
    id: "conv-2",
    participantName: "Sovann Chan",
    participantRole: "student",
    itemId: "listing-4",
    itemTitle: "Car Keys with KIT Keychain",
    itemStatus: "active",
    lastMessage: "I found a similar keychain near the parking lot entrance.",
    lastMessageAt: "2026-02-06T11:45:00Z",
    unreadCount: 0,
  },
  {
    id: "conv-3",
    participantName: "Bopha Pich",
    participantRole: "admin",
    itemId: "listing-5",
    itemTitle: "Student ID Card",
    itemStatus: "matched",
    lastMessage: "Claim approved. Pickup at Admin Office after 2 PM.",
    lastMessageAt: "2026-02-05T08:20:00Z",
    unreadCount: 2,
  },
]

const seedMessages: Message[] = [
  {
    id: "msg-1",
    conversationId: "conv-1",
    sender: "participant",
    body: "Hi, I saw your claim for the iPhone listing.",
    createdAt: "2026-02-07T14:50:00Z",
  },
  {
    id: "msg-2",
    conversationId: "conv-1",
    sender: "me",
    body: "Yes, I can provide details. The lock screen has a cat photo.",
    createdAt: "2026-02-07T15:00:00Z",
  },
  {
    id: "msg-3",
    conversationId: "conv-1",
    sender: "participant",
    body: "Please describe the wallpaper so we can verify ownership.",
    createdAt: "2026-02-07T15:10:00Z",
  },
  {
    id: "msg-4",
    conversationId: "conv-2",
    sender: "participant",
    body: "I found a similar keychain near the parking lot entrance.",
    createdAt: "2026-02-06T11:45:00Z",
  },
  {
    id: "msg-5",
    conversationId: "conv-3",
    sender: "participant",
    body: "Claim approved. Pickup at Admin Office after 2 PM.",
    createdAt: "2026-02-05T08:20:00Z",
  },
]

export function getInitialConversations(): Conversation[] {
  return seedConversations
    .map((conversation) => ({ ...conversation }))
    .sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    )
}

export function getInitialMessages(): Message[] {
  return seedMessages
    .map((message) => ({ ...message }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}
