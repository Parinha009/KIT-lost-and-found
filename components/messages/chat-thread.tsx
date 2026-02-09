"use client"

import { type KeyboardEvent, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import {
  CheckCheck,
  MoreVertical,
  PencilLine,
  Trash2,
  MessageCircleOff,
  CircleAlert,
} from "lucide-react"
import { formatDate, formatDateTime, formatTime } from "@/lib/date-utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Conversation, Message } from "@/lib/messages/types"

interface ChatThreadProps {
  conversation: Conversation | null
  messages: Message[]
  onEditMessage: (messageId: string, nextBody: string) => void
  onDeleteMessage: (messageId: string) => void
  onMarkConversationUnread: () => void
  onClearConversation: () => void
  onDeleteConversation: () => void
}

export function ChatThread({
  conversation,
  messages,
  onEditMessage,
  onDeleteMessage,
  onMarkConversationUnread,
  onClearConversation,
  onDeleteConversation,
}: ChatThreadProps) {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState("")
  const editingInputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    setEditingMessageId(null)
    setEditingBody("")
  }, [conversation?.id])

  useEffect(() => {
    if (!editingMessageId || !editingInputRef.current) return

    const input = editingInputRef.current
    const lastIndex = input.value.length
    input.focus()
    input.setSelectionRange(lastIndex, lastIndex)
  }, [editingMessageId])

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
        Select a conversation to start messaging.
      </div>
    )
  }

  const handleStartEdit = (message: Message) => {
    setEditingMessageId(message.id)
    setEditingBody(message.body)
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditingBody("")
  }

  const handleSaveEdit = () => {
    if (!editingMessageId) return
    onEditMessage(editingMessageId, editingBody)
    setEditingMessageId(null)
    setEditingBody("")
  }

  const handleEditKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      handleSaveEdit()
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      handleCancelEdit()
    }
  }

  return (
    <div className="flex h-full flex-col motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2 motion-safe:duration-300">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-8 w-8 shrink-0 rounded-full bg-muted-foreground/20" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {conversation.participantName}
            </p>
            <p className="truncate text-xs text-primary">Re: {conversation.itemTitle}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Conversation actions"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={onMarkConversationUnread}>
              <CircleAlert className="h-4 w-4" />
              Mark as unread
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onClearConversation}>
              <MessageCircleOff className="h-4 w-4" />
              Clear messages
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDeleteConversation}>
              <Trash2 className="h-4 w-4" />
              Delete conversation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto bg-muted/20 px-5 py-4">
        <p className="mb-4 text-center text-[11px] text-muted-foreground">
          Claim submitted for {conversation.itemTitle}
        </p>

        {messages.length === 0 ? (
          <div className="mt-16 text-center text-sm text-muted-foreground">
            No messages yet. Send a message to start this conversation.
          </div>
        ) : (
          <div className="space-y-3">
          {messages.map((message) => {
            const isMine = message.sender === "me"
            const isEditing = editingMessageId === message.id
            const canSaveEditedMessage =
              Boolean(editingBody.trim()) || Boolean(message.attachments?.length)
            return (
              <div
                key={message.id}
                className={cn(
                  "flex motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200",
                  isMine ? "justify-end" : "justify-start"
                )}
              >
                {!isMine && (
                  <span className="mr-2 mt-1 h-6 w-6 shrink-0 rounded-full bg-muted-foreground/20" />
                )}
                <div className="group relative max-w-[76%]">
                  <div
                    className={cn(
                      "rounded-xl px-3.5 py-2.5 text-sm leading-5 transition-shadow duration-200",
                      isMine
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm border border-border bg-background text-card-foreground hover:shadow-sm"
                    )}
                    title={formatDateTime(message.createdAt)}
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          ref={editingInputRef}
                          value={editingBody}
                          onChange={(event) => setEditingBody(event.target.value)}
                          onKeyDown={handleEditKeyDown}
                          className={cn(
                            "min-h-20 resize-none border",
                            isMine
                              ? "border-primary-foreground/30 bg-primary/70 text-primary-foreground placeholder:text-primary-foreground/70"
                              : "bg-background"
                          )}
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn(isMine && "text-primary-foreground hover:bg-primary/80")}
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className={cn(
                              isMine &&
                                "bg-primary-foreground/90 text-primary hover:bg-primary-foreground"
                            )}
                            onClick={handleSaveEdit}
                            disabled={!canSaveEditedMessage}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {message.body && <p className="break-words">{message.body}</p>}
                        {message.attachments?.length ? (
                          <div className={cn("mt-2 grid gap-2", message.body ? "pt-1" : "")}>
                            {message.attachments.map((attachment) =>
                              attachment.kind === "image" ? (
                                <a
                                  key={attachment.id}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={cn(
                                    "overflow-hidden rounded-md border",
                                    isMine ? "border-primary-foreground/25" : "border-border"
                                  )}
                                >
                                  <img
                                    src={attachment.url}
                                    alt={attachment.fileName}
                                    className="max-h-56 w-full object-cover"
                                  />
                                </a>
                              ) : (
                                <video
                                  key={attachment.id}
                                  controls
                                  className={cn(
                                    "max-h-56 w-full rounded-md border",
                                    isMine ? "border-primary-foreground/25" : "border-border"
                                  )}
                                >
                                  <source src={attachment.url} type={attachment.mimeType} />
                                  Your browser does not support the video tag.
                                </video>
                              )
                            )}
                          </div>
                        ) : null}
                      </>
                    )}
                    <p
                      className={cn(
                        "mt-1 flex items-center gap-1 text-[10px]",
                        isMine ? "justify-end text-primary-foreground/80" : "text-muted-foreground"
                      )}
                    >
                      {formatDate(message.createdAt)} {formatTime(message.createdAt)}
                      {message.editedAt ? "| edited" : null}
                      {isMine && <CheckCheck className="h-3 w-3" />}
                    </p>
                  </div>

                  {isMine && !isEditing && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="absolute -right-2 -top-2 rounded-full border border-border bg-background p-1 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                          aria-label="Message actions"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onSelect={() => handleStartEdit(message)}>
                          <PencilLine className="h-4 w-4" />
                          Edit message
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => onDeleteMessage(message.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete message
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            )
          })}
          </div>
        )}
      </div>
    </div>
  )
}
