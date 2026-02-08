"use client"

import { cn } from "@/lib/utils"
import { CheckCheck, MoreVertical } from "lucide-react"
import { formatDate, formatDateTime, formatTime } from "@/lib/date-utils"
import type { Conversation, Message } from "@/lib/messages/types"

interface ChatThreadProps {
  conversation: Conversation | null
  messages: Message[]
}

export function ChatThread({ conversation, messages }: ChatThreadProps) {
  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
        Select a conversation to start messaging.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
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
        <button
          type="button"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Conversation actions"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-muted/20 px-5 py-4">
        <p className="mb-4 text-center text-[11px] text-muted-foreground">
          Claim submitted for {conversation.itemTitle}
        </p>

        <div className="space-y-3">
          {messages.map((message) => {
            const isMine = message.sender === "me"
            return (
              <div
                key={message.id}
                className={cn("flex", isMine ? "justify-end" : "justify-start")}
              >
                {!isMine && (
                  <span className="mr-2 mt-1 h-6 w-6 shrink-0 rounded-full bg-muted-foreground/20" />
                )}
                <div
                  className={cn(
                    "max-w-[76%] rounded-xl px-3.5 py-2.5 text-sm leading-5",
                    isMine
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm border border-border bg-background text-card-foreground"
                  )}
                  title={formatDateTime(message.createdAt)}
                >
                  <p className="break-words">{message.body}</p>
                  <p
                    className={cn(
                      "mt-1 flex items-center gap-1 text-[10px]",
                      isMine ? "justify-end text-primary-foreground/80" : "text-muted-foreground"
                    )}
                  >
                    {formatDate(message.createdAt)}
                    {isMine && <CheckCheck className="h-3 w-3" />}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

