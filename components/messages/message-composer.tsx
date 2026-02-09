"use client"

import { type ChangeEvent, type KeyboardEvent, useId, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { MessageAttachment } from "@/lib/messages/types"
import { Image as ImageIcon, Send, Video, X } from "lucide-react"

interface MessageComposerProps {
  value: string
  onChange: (value: string) => void
  attachments: MessageAttachment[]
  onAttachFiles: (files: FileList | null) => void
  onRemoveAttachment: (attachmentId: string) => void
  onSend: () => void
  disabled?: boolean
}

export function MessageComposer({
  value,
  onChange,
  attachments,
  onAttachFiles,
  onRemoveAttachment,
  onSend,
  disabled = false,
}: MessageComposerProps) {
  const fileInputId = useId()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      onSend()
    }
  }

  const handlePickFiles = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    onAttachFiles(event.target.files)
    event.target.value = ""
  }

  return (
    <div className="space-y-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <input
        id={fileInputId}
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs"
            >
              {attachment.kind === "image" ? (
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <Video className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="max-w-[140px] truncate">{attachment.fileName}</span>
              <button
                type="button"
                onClick={() => onRemoveAttachment(attachment.id)}
                className={cn(
                  "rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  disabled && "pointer-events-none opacity-50"
                )}
                aria-label={`Remove ${attachment.fileName}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground transition-all duration-200 motion-safe:hover:scale-105"
          onClick={handlePickFiles}
          disabled={disabled}
          aria-label="Attach image or video"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          className="h-10 transition-shadow duration-200 focus-visible:shadow-sm"
          disabled={disabled}
        />
        <Button
          type="button"
          size="icon"
          className="h-10 w-10 shrink-0 bg-primary/75 transition-all duration-200 hover:bg-primary motion-safe:hover:scale-105"
          onClick={onSend}
          disabled={disabled || (!value.trim() && attachments.length === 0)}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
