"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { MessageSquare, Search } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ConversationList } from "@/components/messages/conversation-list"
import { ChatThread } from "@/components/messages/chat-thread"
import { MessageComposer } from "@/components/messages/message-composer"
import { useAuth } from "@/lib/auth-context"
import { uploadListingImages } from "@/lib/upload-adapter"
import type {
  Conversation,
  Message,
  MessageAttachment,
  MessageAttachmentKind,
} from "@/lib/messages/types"

const MAX_MEDIA_ATTACHMENTS = 4
const MAX_MEDIA_SIZE_BYTES = 25 * 1024 * 1024

type MessagesResponse = {
  ok?: boolean
  data?: {
    conversations?: Conversation[]
    messages?: Message[]
  }
  error?: string
}

type MessagesMutationResponse<T = unknown> = {
  ok?: boolean
  data?: T
  error?: string
}

function sortConversationsByActivity(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  )
}

function getMessagePreview(message: Pick<Message, "body" | "attachments">): string {
  const body = message.body.trim()
  if (body) return body

  const attachmentCount = message.attachments?.length ?? 0
  if (attachmentCount === 0) return "No messages yet"

  return attachmentCount === 1 ? "Sent an attachment" : `Sent ${attachmentCount} attachments`
}

function revokeAttachmentUrl(attachment: MessageAttachment) {
  if (attachment.url.startsWith("blob:")) {
    URL.revokeObjectURL(attachment.url)
  }
}

function revokeAttachments(attachments: MessageAttachment[] | undefined) {
  attachments?.forEach(revokeAttachmentUrl)
}

export default function MessagesPage() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [draftMessage, setDraftMessage] = useState("")
  const [draftAttachments, setDraftAttachments] = useState<MessageAttachment[]>([])
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const messagesRef = useRef(messages)
  const draftAttachmentsRef = useRef(draftAttachments)
  const draftAttachmentFilesRef = useRef(new Map<string, File>())

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

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    draftAttachmentsRef.current = draftAttachments
  }, [draftAttachments])

  const clearDraftAttachments = useCallback(() => {
    draftAttachmentFilesRef.current.clear()
    setDraftAttachments((prev) => {
      prev.forEach(revokeAttachmentUrl)
      return []
    })
  }, [])

  useEffect(() => {
    return () => {
      messagesRef.current.forEach((message) => revokeAttachments(message.attachments))
      draftAttachmentsRef.current.forEach(revokeAttachmentUrl)
      draftAttachmentFilesRef.current.clear()
    }
  }, [])

  const refreshMessages = useCallback(async () => {
    if (!user) {
      setConversations([])
      setMessages([])
      setActiveConversationId(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/messages", {
        cache: "no-store",
        headers: {
          "x-user-id": user.id,
        },
      })

      const json = (await res.json().catch(() => ({}))) as MessagesResponse
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load conversations")
      }

      const nextConversations = sortConversationsByActivity(
        Array.isArray(json.data?.conversations) ? json.data.conversations : []
      )
      const nextMessages = Array.isArray(json.data?.messages) ? json.data.messages : []

      setConversations(nextConversations)
      setMessages(nextMessages)
      setActiveConversationId((prev) => {
        if (nextConversations.length === 0) return null
        if (prev && nextConversations.some((conversation) => conversation.id === prev)) return prev
        return nextConversations[0]?.id ?? null
      })
    } catch (error) {
      setConversations([])
      setMessages([])
      setActiveConversationId(null)
      toast.error(error instanceof Error ? error.message : "Failed to load conversations")
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refreshMessages()
  }, [refreshMessages])

  const runMessageAction = useCallback(
    async <TData = unknown,>(payload: Record<string, unknown>): Promise<TData> => {
      if (!user) throw new Error("You must be logged in.")

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": user.id,
        },
        body: JSON.stringify(payload),
      })

      const json = (await res.json().catch(() => ({}))) as MessagesMutationResponse<TData>
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to process message action")
      }

      return json.data as TData
    },
    [user]
  )

  const syncConversationFromMessages = (conversationId: string, nextMessages: Message[]) => {
    setConversations((prev) =>
      sortConversationsByActivity(
        prev.map((conversation) => {
          if (conversation.id !== conversationId) return conversation

          const latestConversationMessage = nextMessages
            .filter((message) => message.conversationId === conversationId)
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )[0]

          if (!latestConversationMessage) {
            return {
              ...conversation,
              lastMessage: "No messages yet",
            }
          }

          return {
            ...conversation,
            lastMessage: getMessagePreview(latestConversationMessage),
            lastMessageAt: latestConversationMessage.createdAt,
          }
        })
      )
    )
  }

  const handleSelectConversation = (conversationId: string) => {
    const selectedConversation = conversations.find(
      (conversation) => conversation.id === conversationId
    )

    setActiveConversationId(conversationId)
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
      )
    )
    setDraftMessage("")
    clearDraftAttachments()

    if (selectedConversation && selectedConversation.unreadCount > 0) {
      void runMessageAction({ action: "mark_read", conversationId }).catch((error) => {
        console.error("[messages] mark_read failed", error)
      })
    }
  }

  const handleAttachFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return

    const selectedFiles = Array.from(files)
    let openSlots = MAX_MEDIA_ATTACHMENTS - draftAttachments.length

    if (openSlots <= 0) {
      toast.error(`You can attach up to ${MAX_MEDIA_ATTACHMENTS} files per message.`)
      return
    }

    let rejectedTypeCount = 0
    let rejectedSizeCount = 0
    let rejectedLimitCount = 0

    const acceptedAttachments: MessageAttachment[] = []

    selectedFiles.forEach((file) => {
      const kind: MessageAttachmentKind | null = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
          ? "video"
          : null

      if (!kind) {
        rejectedTypeCount += 1
        return
      }

      if (file.size > MAX_MEDIA_SIZE_BYTES) {
        rejectedSizeCount += 1
        return
      }

      if (openSlots <= 0) {
        rejectedLimitCount += 1
        return
      }

      const attachmentId = crypto.randomUUID()
      acceptedAttachments.push({
        id: attachmentId,
        kind,
        url: URL.createObjectURL(file),
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
      })
      draftAttachmentFilesRef.current.set(attachmentId, file)
      openSlots -= 1
    })

    if (acceptedAttachments.length > 0) {
      setDraftAttachments((prev) => [...prev, ...acceptedAttachments])
    }

    if (rejectedTypeCount > 0) {
      toast.error("Only image and video files are supported.")
    }
    if (rejectedSizeCount > 0) {
      toast.error("Each file must be smaller than 25 MB.")
    }
    if (rejectedLimitCount > 0) {
      toast.error(`Only ${MAX_MEDIA_ATTACHMENTS} attachments are allowed per message.`)
    }
  }

  const handleRemoveAttachment = (attachmentId: string) => {
    setDraftAttachments((prev) => {
      const attachment = prev.find((current) => current.id === attachmentId)
      if (attachment) revokeAttachmentUrl(attachment)
      return prev.filter((current) => current.id !== attachmentId)
    })
    draftAttachmentFilesRef.current.delete(attachmentId)
  }

  const handleSendMessage = async () => {
    if (!activeConversation || !user || isSending) return

    const body = draftMessage.trim()
    const attachments = draftAttachments
    if (!body && attachments.length === 0) return

    setIsSending(true)
    try {
      let uploadedAttachments: MessageAttachment[] = []

      if (attachments.length > 0) {
        const files = attachments
          .map((attachment) => draftAttachmentFilesRef.current.get(attachment.id))
          .filter((file): file is File => Boolean(file))

        if (files.length !== attachments.length) {
          throw new Error("Some attachments could not be prepared. Please re-attach files.")
        }

        const uploadedUrls = await uploadListingImages(files, {
          userId: user.id,
          listingId: activeConversation.id,
          strict: true,
        })

        uploadedAttachments = attachments.map((attachment, index) => ({
          ...attachment,
          url: uploadedUrls[index] || attachment.url,
        }))
      }

      const createdMessage = await runMessageAction<Message | undefined>({
        action: "send",
        conversationId: activeConversation.id,
        body,
        attachments: uploadedAttachments,
      })

      const newMessage: Message =
        createdMessage &&
        typeof createdMessage.id === "string" &&
        typeof createdMessage.createdAt === "string"
          ? createdMessage
          : {
              id: `local-${Date.now()}`,
              conversationId: activeConversation.id,
              sender: "me",
              body,
              attachments: uploadedAttachments,
              createdAt: new Date().toISOString(),
            }

      setMessages((prev) => [...prev, newMessage])
      setConversations((prev) =>
        sortConversationsByActivity(
          prev.map((conversation) =>
            conversation.id === activeConversation.id
              ? {
                  ...conversation,
                  lastMessage: getMessagePreview(newMessage),
                  lastMessageAt: newMessage.createdAt,
                  unreadCount: 0,
                }
              : conversation
          )
        )
      )
      setDraftMessage("")
      clearDraftAttachments()

      void refreshMessages()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message")
    } finally {
      setIsSending(false)
    }
  }

  const handleEditMessage = (messageId: string, nextBody: string) => {
    const trimmedBody = nextBody.trim()
    const targetMessage = messages.find((message) => message.id === messageId)

    if (!targetMessage || targetMessage.sender !== "me") {
      toast.error("This message cannot be edited.")
      return
    }

    if (!trimmedBody && !targetMessage.attachments?.length) {
      toast.error("Message cannot be empty.")
      return
    }

    void (async () => {
      try {
        await runMessageAction({
          action: "edit_message",
          messageId,
          body: trimmedBody,
        })

        const nextMessages = messages.map((message) =>
          message.id === messageId
            ? {
                ...message,
                body: trimmedBody,
                editedAt: new Date().toISOString(),
              }
            : message
        )

        setMessages(nextMessages)
        syncConversationFromMessages(targetMessage.conversationId, nextMessages)
        toast.success("Message updated.")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "This message cannot be edited.")
      }
    })()
  }

  const handleDeleteMessage = (messageId: string) => {
    const targetMessage = messages.find((message) => message.id === messageId)

    if (!targetMessage || targetMessage.sender !== "me") {
      toast.error("This message cannot be deleted.")
      return
    }

    void (async () => {
      try {
        await runMessageAction({
          action: "delete_message",
          messageId,
        })

        const nextMessages = messages.filter((message) => message.id !== messageId)
        revokeAttachments(targetMessage.attachments)

        setMessages(nextMessages)
        syncConversationFromMessages(targetMessage.conversationId, nextMessages)
        toast.success("Message deleted.")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "This message cannot be deleted.")
      }
    })()
  }

  const handleMarkConversationUnread = () => {
    if (!activeConversation) return

    void (async () => {
      try {
        await runMessageAction({
          action: "mark_unread",
          conversationId: activeConversation.id,
        })
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === activeConversation.id
              ? { ...conversation, unreadCount: Math.max(conversation.unreadCount, 1) }
              : conversation
          )
        )
        toast.success("Conversation marked as unread.")
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to mark conversation as unread."
        )
      }
    })()
  }

  const handleClearConversation = () => {
    if (!activeConversation) return

    void (async () => {
      try {
        await runMessageAction({
          action: "clear_conversation",
          conversationId: activeConversation.id,
        })

        const conversationMessages = messages.filter(
          (message) => message.conversationId === activeConversation.id
        )
        conversationMessages.forEach((message) => revokeAttachments(message.attachments))

        const nextMessages = messages.filter(
          (message) => message.conversationId !== activeConversation.id
        )
        setMessages(nextMessages)
        syncConversationFromMessages(activeConversation.id, nextMessages)
        toast.success("Conversation cleared.")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to clear conversation.")
      }
    })()
  }

  const handleDeleteConversation = () => {
    if (!activeConversation) return

    void (async () => {
      try {
        const conversationId = activeConversation.id
        await runMessageAction({
          action: "delete_conversation",
          conversationId,
        })

        const nextConversations = sortConversationsByActivity(
          conversations.filter((conversation) => conversation.id !== conversationId)
        )
        const removedMessages = messages.filter(
          (message) => message.conversationId === conversationId
        )
        removedMessages.forEach((message) => revokeAttachments(message.attachments))

        setConversations(nextConversations)
        setMessages((prev) =>
          prev.filter((message) => message.conversationId !== conversationId)
        )
        setActiveConversationId(nextConversations[0]?.id ?? null)
        setDraftMessage("")
        clearDraftAttachments()
        toast.success("Conversation deleted.")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete conversation.")
      }
    })()
  }

  return (
    <div className="space-y-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Messages</h1>
          <p className="mt-1 text-muted-foreground">
            Coordinate item verification and handover with users.
          </p>
        </div>
        <Badge variant="outline" className="w-fit rounded-md px-3 py-1 text-sm">
          {isLoading ? "Loading..." : `${unreadCount} unread`}
        </Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card className="h-[420px] gap-0 overflow-hidden rounded-2xl py-0 transition-shadow duration-200 motion-safe:hover:shadow-md md:h-[560px]">
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

        <Card className="h-[560px] gap-0 overflow-hidden rounded-2xl py-0 transition-shadow duration-200 motion-safe:hover:shadow-md">
          <ChatThread
            conversation={activeConversation}
            messages={threadMessages}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onMarkConversationUnread={handleMarkConversationUnread}
            onClearConversation={handleClearConversation}
            onDeleteConversation={handleDeleteConversation}
          />
          <div className="border-t border-border p-4">
            {activeConversation ? (
              <MessageComposer
                value={draftMessage}
                onChange={setDraftMessage}
                attachments={draftAttachments}
                onAttachFiles={handleAttachFiles}
                onRemoveAttachment={handleRemoveAttachment}
                onSend={handleSendMessage}
                disabled={isSending}
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
