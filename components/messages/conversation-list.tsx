"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "@/lib/date-utils"
import type { Conversation } from "@/lib/messages/types"

interface ConversationListProps {
  conversations: Conversation[]
  selectedConversationId: string | null
  onSelectConversation: (conversationId: string) => void
}

export function ConversationList({
  conversations,
  selectedConversationId,
  onSelectConversation,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
        No conversations found.
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      {conversations.map((conversation) => {
        const isActive = conversation.id === selectedConversationId
        return (
          <button
            key={conversation.id}
            type="button"
            onClick={() => onSelectConversation(conversation.id)}
            className={cn(
              "w-full border-b border-border px-4 py-3 text-left transition-colors",
              "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive && "bg-primary/10"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {conversation.participantName}
                </p>
                <p className="text-xs capitalize text-muted-foreground">
                  {conversation.participantRole}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {conversation.unreadCount > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                    {conversation.unreadCount}
                  </Badge>
                )}
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDistanceToNow(conversation.lastMessageAt)}
                </span>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span className="truncate text-xs font-medium text-foreground">
                {conversation.itemTitle}
              </span>
              <Badge variant="outline" className="shrink-0 capitalize text-[10px]">
                {conversation.itemStatus}
              </Badge>
            </div>

            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              {conversation.lastMessage}
            </p>
          </button>
        )
      })}
    </div>
  )
}
