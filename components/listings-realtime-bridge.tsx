"use client"

import { useEffect } from "react"
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { useAuth } from "@/lib/auth-context"
import { publishListingsUpdated } from "@/lib/client/listings-sync"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

type ItemRow = {
  id?: string | null
}

let itemsRealtimeChannel: RealtimeChannel | null = null
let itemsRealtimeUserId: string | null = null

function resolvePayloadId(payload: RealtimePostgresChangesPayload<ItemRow>): string | undefined {
  const nextId = (payload.new as { id?: unknown } | null | undefined)?.id
  if (typeof nextId === "string" && nextId.trim().length > 0) return nextId

  const previousId = (payload.old as { id?: unknown } | null | undefined)?.id
  if (typeof previousId === "string" && previousId.trim().length > 0) return previousId

  return undefined
}

function mapEventType(
  eventType: RealtimePostgresChangesPayload<ItemRow>["eventType"]
): "created" | "updated" | "deleted" | null {
  if (eventType === "INSERT") return "created"
  if (eventType === "UPDATE") return "updated"
  if (eventType === "DELETE") return "deleted"
  return null
}

export function ListingsRealtimeBridge() {
  const { user, session } = useAuth()

  useEffect(() => {
    let cancelled = false
    let supabase: ReturnType<typeof getSupabaseBrowserClient> | null = null

    try {
      supabase = getSupabaseBrowserClient()
    } catch {
      return
    }

    const sessionUserId = session?.user?.id ?? null
    const canSubscribe = Boolean(user?.id && sessionUserId && user.id === sessionUserId)

    if (!canSubscribe) {
      if (itemsRealtimeChannel) {
        void supabase.removeChannel(itemsRealtimeChannel)
        itemsRealtimeChannel = null
        itemsRealtimeUserId = null
      }
      return
    }

    if (itemsRealtimeChannel && itemsRealtimeUserId === sessionUserId) {
      return
    }

    if (itemsRealtimeChannel) {
      void supabase.removeChannel(itemsRealtimeChannel)
      itemsRealtimeChannel = null
      itemsRealtimeUserId = null
    }

    const channel = supabase
      .channel(`items-realtime:${sessionUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, (payload) => {
        if (cancelled) return

        const type = mapEventType(payload.eventType)
        if (!type) return

        publishListingsUpdated({
          type,
          id: resolvePayloadId(payload),
        })
      })
      .subscribe()

    itemsRealtimeChannel = channel
    itemsRealtimeUserId = sessionUserId

    return () => {
      cancelled = true
      if (itemsRealtimeChannel === channel) {
        void supabase.removeChannel(channel)
        itemsRealtimeChannel = null
        itemsRealtimeUserId = null
      }
    }
  }, [session?.access_token, session?.user?.id, user?.id])

  return null
}
