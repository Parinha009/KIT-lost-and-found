export const LISTINGS_UPDATED_EVENT = "kit:listings:updated"
const LISTINGS_STORAGE_EVENT_KEY = "kit:listings:updated:at"
const LISTINGS_BROADCAST_CHANNEL = "kit:listings:updates"

type ListingsUpdateType = "created" | "updated" | "deleted"

export type ListingsUpdateEventDetail = {
  id?: string
  type?: ListingsUpdateType
  at: number
}

type Listener = (detail: ListingsUpdateEventDetail) => void

function nowDetail(detail?: Omit<ListingsUpdateEventDetail, "at">): ListingsUpdateEventDetail {
  return {
    ...detail,
    at: Date.now(),
  }
}

function parseDetail(value: unknown): ListingsUpdateEventDetail | null {
  if (!value || typeof value !== "object") return null

  const record = value as Partial<ListingsUpdateEventDetail>
  if (typeof record.at !== "number") return null

  const id = typeof record.id === "string" ? record.id : undefined
  const type =
    record.type === "created" || record.type === "updated" || record.type === "deleted"
      ? record.type
      : undefined

  return { at: record.at, id, type }
}

function emit(detail: ListingsUpdateEventDetail): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<ListingsUpdateEventDetail>(LISTINGS_UPDATED_EVENT, { detail }))
}

export function publishListingsUpdated(detail?: Omit<ListingsUpdateEventDetail, "at">): void {
  if (typeof window === "undefined") return

  const eventDetail = nowDetail(detail)
  emit(eventDetail)

  try {
    window.localStorage.setItem(LISTINGS_STORAGE_EVENT_KEY, JSON.stringify(eventDetail))
  } catch {
    // Ignore storage failures.
  }

  try {
    const channel = new BroadcastChannel(LISTINGS_BROADCAST_CHANNEL)
    channel.postMessage(eventDetail)
    channel.close()
  } catch {
    // BroadcastChannel is optional.
  }
}

export function subscribeListingsUpdated(listener: Listener): () => void {
  if (typeof window === "undefined") {
    return () => {}
  }

  const onCustomEvent = (event: Event) => {
    const custom = event as CustomEvent<ListingsUpdateEventDetail>
    if (custom.detail) listener(custom.detail)
  }

  const onStorageEvent = (event: StorageEvent) => {
    if (event.key !== LISTINGS_STORAGE_EVENT_KEY || !event.newValue) return

    try {
      const parsed = parseDetail(JSON.parse(event.newValue))
      if (parsed) listener(parsed)
    } catch {
      // Ignore malformed payloads.
    }
  }

  let channel: BroadcastChannel | null = null
  const onChannelMessage = (event: MessageEvent) => {
    const parsed = parseDetail(event.data)
    if (parsed) listener(parsed)
  }

  window.addEventListener(LISTINGS_UPDATED_EVENT, onCustomEvent as EventListener)
  window.addEventListener("storage", onStorageEvent)

  try {
    channel = new BroadcastChannel(LISTINGS_BROADCAST_CHANNEL)
    channel.addEventListener("message", onChannelMessage)
  } catch {
    channel = null
  }

  return () => {
    window.removeEventListener(LISTINGS_UPDATED_EVENT, onCustomEvent as EventListener)
    window.removeEventListener("storage", onStorageEvent)
    if (channel) {
      channel.removeEventListener("message", onChannelMessage)
      channel.close()
    }
  }
}
