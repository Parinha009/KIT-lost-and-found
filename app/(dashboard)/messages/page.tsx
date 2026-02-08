"use client"

import { useMemo, useState } from "react"
import { MessageSquare, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ConversationList } from "@/components/messages/conversation-list"
import { ChatThread } from "@/components/messages/chat-thread"
import { MessageComposer } from "@/components/messages/message-composer"
import {
  getInitialConversations,
  getInitialMessages,
} from "@/lib/messages/mock-store"
import type { Conversation, Message } from "@/lib/messages/types"

function sortConversationsByActivity(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  )
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>(
    getInitialConversations
  )
  const [messages, setMessages] = useState<Message[]>(getInitialMessages)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    conversations[0]?.id ?? null
  )
  const [draftMessage, setDraftMessage] = useState("")

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  )

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return conversations

    return conversations.filter((conversation) => {
      return (
        conversation.participantName.toLowerCase().includes(query) ||
        conversation.itemTitle.toLowerCase().includes(query) ||
        conversation.lastMessage.toLowerCase().includes(query)
      )
    })
  }, [conversations, searchQuery])

  const threadMessages = useMemo(() => {
    if (!activeConversationId) return []
    return messages
      .filter((message) => message.conversationId === activeConversationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [messages, activeConversationId])

  const unreadCount = useMemo(
    () =>
      conversations.reduce((count, conversation) => count + conversation.unreadCount, 0),
    [conversations]
  )

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId)
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
      )
    )
  }

  const handleSendMessage = () => {
    if (!activeConversation) return

    const body = draftMessage.trim()
    if (!body) return

    const createdAt = new Date().toISOString()
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      conversationId: activeConversation.id,
      sender: "me",
      body,
      createdAt,
    }

    setMessages((prev) => [...prev, newMessage])
    setConversations((prev) =>
      sortConversationsByActivity(
        prev.map((conversation) =>
          conversation.id === activeConversation.id
            ? {
                ...conversation,
                lastMessage: body,
                lastMessageAt: createdAt,
              }
            : conversation
        )
      )
    )
    setDraftMessage("")
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Messages</h1>
          <p className="mt-1 text-muted-foreground">
            Coordinate item verification and handover with users.
          </p>
        </div>
        <Badge variant="outline" className="w-fit rounded-md px-3 py-1 text-sm">
          {unreadCount} unread
        </Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card className="h-[420px] gap-0 overflow-hidden rounded-2xl py-0 md:h-[560px]">
          <div className="border-b border-border p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search conversations..."
                className="h-12 rounded-lg pl-10 text-base"
              />
            </div>
          </div>
          <ConversationList
            conversations={filteredConversations}
            selectedConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
          />
        </Card>

        <Card className="h-[560px] gap-0 overflow-hidden rounded-2xl py-0">
          <ChatThread conversation={activeConversation} messages={threadMessages} />
          <div className="border-t border-border p-4">
            {activeConversation ? (
              <MessageComposer
                value={draftMessage}
                onChange={setDraftMessage}
                onSend={handleSendMessage}
              />
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                Select a conversation to compose a message.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
