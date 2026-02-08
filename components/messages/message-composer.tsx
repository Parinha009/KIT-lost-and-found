"use client"

import { type KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send } from "lucide-react"

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
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      onSend()
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        className="min-h-[84px] resize-none"
        disabled={disabled}
      />
      <div className="flex justify-end">
        <Button onClick={onSend} disabled={disabled || !value.trim()}>
          <Send className="mr-2 h-4 w-4" />
          Send
        </Button>
      </div>
    </div>
  )
}
