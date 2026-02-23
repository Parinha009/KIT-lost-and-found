"use client"

import React from "react"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Bell,
  Check,
  CheckCheck,
  Link2,
  MessageSquare,
  AlertCircle,
  Inbox,
} from "lucide-react"
import { formatDistanceToNow } from "@/lib/date-utils"
import type { Notification, NotificationType } from "@/lib/types"
import { toast } from "sonner"

const notificationIcons: Record<NotificationType, React.ReactNode> = {
  match: <Link2 className="w-4 h-4" />,
  claim_submitted: <MessageSquare className="w-4 h-4" />,
  claim_approved: <Check className="w-4 h-4" />,
  claim_rejected: <AlertCircle className="w-4 h-4" />,
  system: <Bell className="w-4 h-4" />,
}

const notificationColors: Record<NotificationType, string> = {
  match: "bg-primary/10 text-primary",
  claim_submitted: "bg-yellow-500/10 text-yellow-600",
  claim_approved: "bg-accent/10 text-accent",
  claim_rejected: "bg-destructive/10 text-destructive",
  system: "bg-muted text-muted-foreground",
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    if (!user) {
      setNotifications([])
      return
    }

    const actor = user
    let cancelled = false

    async function refreshNotifications() {
      try {
        const res = await fetch(`/api/notifications?userId=${encodeURIComponent(actor.id)}`, {
          cache: "no-store",
          headers: {
            "x-user-id": actor.id,
          },
        })

        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          data?: Notification[]
          error?: string
        }

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to load notifications")
        }

        if (!cancelled) setNotifications(Array.isArray(json.data) ? json.data : [])
      } catch (error) {
        if (!cancelled) {
          setNotifications([])
          toast.error(error instanceof Error ? error.message : "Failed to load notifications")
        }
      }
    }

    void refreshNotifications()
    return () => {
      cancelled = true
    }
  }, [user])

  const unreadNotifications = notifications.filter((n) => !n.is_read)
  const readNotifications = notifications.filter((n) => n.is_read)

  const markAsRead = (id: string) => {
    if (!user) return
    const actor = user

    void (async () => {
      try {
        const res = await fetch(`/api/notifications/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: {
            "x-user-id": actor.id,
          },
        })

        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
        if (!res.ok || !json.ok) throw new Error(json.error || "Failed to update notification")

        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        )
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update notification")
      }
    })()
  }

  const markAllAsRead = () => {
    if (!user) return
    const actor = user

    void (async () => {
      try {
        const res = await fetch("/api/notifications", {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            "x-user-id": actor.id,
          },
          body: JSON.stringify({ user_id: actor.id }),
        })

        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
        if (!res.ok || !json.ok) throw new Error(json.error || "Failed to update notifications")

        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update notifications")
      }
    })()
  }

  const NotificationItem = ({ notification }: { notification: Notification }) => {
    const linkHref = notification.related_listing_id
      ? `/listings/${notification.related_listing_id}`
      : notification.related_claim_id
        ? "/claims"
        : "#"

    return (
      <div
        className={`flex items-start gap-4 p-4 rounded-lg transition-colors ${
          notification.is_read ? "bg-background" : "bg-muted/50"
        }`}
      >
        <div className={`p-2 rounded-full ${notificationColors[notification.type]}`}>
          {notificationIcons[notification.type]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-foreground">{notification.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
            </div>
            {!notification.is_read && (
              <Badge variant="default" className="shrink-0">
                New
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-3">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(notification.created_at)}
            </span>
            {linkHref !== "#" && (
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                <Link href={linkHref}>View details</Link>
              </Button>
            )}
            {!notification.is_read && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => markAsRead(notification.id)}
              >
                Mark as read
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-12">
      <Inbox className="w-12 h-12 text-muted-foreground/50 mb-4" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground">
            Stay updated on your lost and found activities
          </p>
        </div>
        {unreadNotifications.length > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            <CheckCheck className="w-4 h-4 mr-2" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all" className="relative">
            All
            <Badge variant="secondary" className="ml-2">
              {notifications.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="unread" className="relative">
            Unread
            {unreadNotifications.length > 0 && (
              <Badge variant="default" className="ml-2">
                {unreadNotifications.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <Card>
            <CardContent className="p-2">
              {notifications.length > 0 ? (
                <div className="divide-y divide-border">
                  {notifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))}
                </div>
              ) : (
                <EmptyState message="No notifications yet" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unread" className="mt-4">
          <Card>
            <CardContent className="p-2">
              {unreadNotifications.length > 0 ? (
                <div className="divide-y divide-border">
                  {unreadNotifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))}
                </div>
              ) : (
                <EmptyState message="All caught up! No unread notifications" />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Notification Types Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Notification Types</CardTitle>
          <CardDescription>What each notification means</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-full ${notificationColors.match}`}>
                <Link2 className="w-3 h-3" />
              </div>
              <span className="text-sm">Potential item match found</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-full ${notificationColors.claim_submitted}`}>
                <MessageSquare className="w-3 h-3" />
              </div>
              <span className="text-sm">New claim submitted</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-full ${notificationColors.claim_approved}`}>
                <Check className="w-3 h-3" />
              </div>
              <span className="text-sm">Claim approved</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-full ${notificationColors.claim_rejected}`}>
                <AlertCircle className="w-3 h-3" />
              </div>
              <span className="text-sm">Claim rejected</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
