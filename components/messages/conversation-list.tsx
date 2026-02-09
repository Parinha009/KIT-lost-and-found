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
        const itemType = conversation.itemId === "listing-1" ? "lost" : "found"
        return (
          <button
            key={conversation.id}
            type="button"
            onClick={() => onSelectConversation(conversation.id)}
            className={cn(
              "w-full border-b border-border px-4 py-3 text-left transition-all duration-200 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-2 motion-safe:duration-300",
              "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:hover:translate-x-0.5",
              isActive && "bg-muted"
            )}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-muted-foreground/20" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {conversation.participantName}
                  </p>
                  <div className="flex items-center gap-2">
                    {conversation.unreadCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="h-4 min-w-4 px-1 text-[10px] motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-200"
                      >
                        {conversation.unreadCount}
                      </Badge>
                    )}
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(conversation.lastMessageAt)}
                    </span>
                  </div>
                </div>

                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-medium capitalize",
                      itemType === "found"
                        ? "bg-green-500/15 text-green-700"
                        : "bg-red-500/15 text-red-700"
                    )}
                  >
                    {itemType}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {conversation.itemTitle}
                  </span>
                </div>

                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {conversation.lastMessage}
                </p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
