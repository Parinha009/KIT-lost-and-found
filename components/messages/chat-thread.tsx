"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatDateTime, formatTime } from "@/lib/date-utils"
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
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{conversation.participantName}</p>
          <Badge variant="secondary" className="capitalize text-[10px]">
            {conversation.participantRole}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Re: {conversation.itemTitle} ({conversation.itemStatus})
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">
        {messages.map((message) => {
          const isMine = message.sender === "me"
          return (
            <div
              key={message.id}
              className={cn("flex", isMine ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  isMine
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-card-foreground border border-border"
                )}
                title={formatDateTime(message.createdAt)}
              >
                <p className="break-words">{message.body}</p>
                <p
                  className={cn(
                    "mt-1 text-[10px]",
                    isMine ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}
                >
                  {formatTime(message.createdAt)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
