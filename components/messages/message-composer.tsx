"use client"

import { type KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Image as ImageIcon, Send } from "lucide-react"

interface MessageComposerProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled?: boolean
}

export function MessageComposer({
  value,
  onChange,
  onSend,
  disabled = false,
}: MessageComposerProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      onSend()
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 text-muted-foreground"
        disabled={disabled}
        aria-label="Attach image"
      >
        <ImageIcon className="h-4 w-4" />
      </Button>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        className="h-10"
        disabled={disabled}
      />
      <Button
        type="button"
        size="icon"
        className="h-10 w-10 shrink-0 bg-primary/75 hover:bg-primary"
        onClick={onSend}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  )
}
