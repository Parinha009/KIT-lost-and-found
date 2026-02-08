import type { Conversation, Message } from "@/lib/messages/types"

const seedConversations: Conversation[] = [
  {
    id: "conv-1",
    participantName: "Taing Bunsou",
    participantRole: "student",
    itemId: "listing-3",
    itemTitle: "iPhone 14 Pro",
    itemStatus: "active",
    lastMessage: "Your claim has been approved. Please come to the security office to collect your phone.",
    lastMessageAt: "2026-02-08T09:20:00Z",
    unreadCount: 1,
  },
  {
    id: "conv-2",
    participantName: "Nho Tomaneath",
    participantRole: "student",
    itemId: "listing-2",
    itemTitle: "Blue Backpack",
    itemStatus: "active",
    lastMessage: "Yes, I can meet you at the library reception tomorrow for verification.",
    lastMessageAt: "2026-02-07T11:45:00Z",
    unreadCount: 0,
  },
  {
    id: "conv-3",
    participantName: "Sary Sodaney",
    participantRole: "student",
    itemId: "listing-1",
    itemTitle: "Black Leather Wallet",
    itemStatus: "active",
    lastMessage: "I found a wallet that might be yours. Does it have a student card inside?",
    lastMessageAt: "2026-02-06T08:20:00Z",
    unreadCount: 0,
  },
]

const seedMessages: Message[] = [
  {
    id: "msg-1",
    conversationId: "conv-1",
    sender: "me",
    body: "I submitted a claim for the iPhone. I can show you photos of my cat that is on the lock screen as proof.",
    createdAt: "2026-02-08T09:05:00Z",
  },
  {
    id: "msg-2",
    conversationId: "conv-1",
    sender: "participant",
    body: "Thank you for the verification. I'm reviewing your claim now.",
    createdAt: "2026-02-08T09:12:00Z",
  },
  {
    id: "msg-3",
    conversationId: "conv-1",
    sender: "participant",
    body: "Your claim has been approved. Please come to the security office to collect your phone.",
    createdAt: "2026-02-08T09:20:00Z",
  },
  {
    id: "msg-4",
    conversationId: "conv-2",
    sender: "me",
    body: "I can describe the backpack content if needed.",
    createdAt: "2026-02-07T10:20:00Z",
  },
  {
    id: "msg-5",
    conversationId: "conv-2",
    sender: "participant",
    body: "Yes, I can meet you at the library reception tomorrow for verification.",
    createdAt: "2026-02-07T11:45:00Z",
  },
  {
    id: "msg-6",
    conversationId: "conv-3",
    sender: "participant",
    body: "I found a wallet that might be yours. Does it have a student card inside?",
    createdAt: "2026-02-06T08:20:00Z",
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
