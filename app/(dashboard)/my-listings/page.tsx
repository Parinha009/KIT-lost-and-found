"use client"

import React from "react"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ListingCard } from "@/components/listing-card"
import { subscribeListingsUpdated } from "@/lib/client/listings-sync"
import type { Listing } from "@/lib/types"
import { Plus, Package, Search, FileText } from "lucide-react"

export default function MyListingsPage() {
  const { user } = useAuth()
  const [allListings, setAllListings] = useState<Listing[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const refreshListings = useCallback(async () => {
    if (!user) {
      setAllListings([])
      return
    }

    try {
      const res = await fetch(`/api/items?userId=${encodeURIComponent(user.id)}`, {
        cache: "no-store",
      })
      const json = (await res.json()) as { ok?: boolean; data?: Listing[]; error?: string }
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load listings")
      }

      setLoadError(null)
      setAllListings(Array.isArray(json.data) ? json.data : [])
    } catch (error) {
      setAllListings([])
      setLoadError(error instanceof Error ? error.message : "Failed to load listings")
    }
  }, [user])

  useEffect(() => {
    void (async () => {
      await refreshListings()
    })()
  }, [refreshListings])

  useEffect(() => {
    return subscribeListingsUpdated(() => {
      void refreshListings()
    })
  }, [refreshListings])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshListings()
    }, 30_000)

    return () => {
      window.clearInterval(interval)
    }
  }, [refreshListings])

  const myListings = useMemo(() => {
    return allListings.filter((listing) => listing.user_id === user?.id)
  }, [allListings, user?.id])

  const lostListings = myListings.filter((l) => l.type === "lost")
  const foundListings = myListings.filter((l) => l.type === "found")

  const EmptyState = ({
    icon: Icon,
    title,
    description,
    action,
  }: {
    icon: React.ElementType
    title: string
    description: string
    action?: { label: string; href: string }
  }) => (
    <div className="flex flex-col items-center justify-center py-12">
      <Icon className="w-12 h-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground text-center mt-1">{description}</p>
      {action && (
        <Button className="mt-4" asChild>
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Listings</h1>
          <p className="text-muted-foreground">Manage your lost and found reports</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/report?type=lost">
              <Plus className="w-4 h-4 mr-2" />
              Report Lost
            </Link>
          </Button>
          {(user?.role === "staff" || user?.role === "admin") && (
            <Button variant="outline" asChild>
              <Link href="/report?type=found">
                <Plus className="w-4 h-4 mr-2" />
                Register Found
              </Link>
            </Button>
          )}
        </div>
      </div>

      {loadError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{loadError}</CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            All
            <Badge variant="secondary" className="ml-2">
              {myListings.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="lost">
            Lost
            <Badge variant="secondary" className="ml-2">
              {lostListings.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="found">
            Found
            <Badge variant="secondary" className="ml-2">
              {foundListings.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {myListings.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent>
                <EmptyState
                  icon={FileText}
                  title="No listings yet"
                  description="You haven't reported any lost or found items"
                  action={{ label: "Report an Item", href: "/report" }}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="lost" className="mt-6">
          {lostListings.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lostListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent>
                <EmptyState
                  icon={Package}
                  title="No lost items"
                  description="You haven't reported any lost items yet"
                  action={{ label: "Report Lost Item", href: "/report?type=lost" }}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="found" className="mt-6">
          {foundListings.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {foundListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent>
                <EmptyState
                  icon={Search}
                  title="No found items"
                  description={
                    user?.role === "student"
                      ? "Only staff can register found items"
                      : "You haven't registered any found items yet"
                  }
                  action={
                    user?.role !== "student"
                      ? { label: "Register Found Item", href: "/report?type=found" }
                      : undefined
                  }
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Stats Summary */}
      {myListings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{myListings.length}</div>
                <div className="text-xs text-muted-foreground">Total Listings</div>
              </div>
              <div className="text-center p-3 bg-orange-500/10 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{lostListings.length}</div>
                <div className="text-xs text-muted-foreground">Lost Items</div>
              </div>
              <div className="text-center p-3 bg-primary/10 rounded-lg">
                <div className="text-2xl font-bold text-primary">{foundListings.length}</div>
                <div className="text-xs text-muted-foreground">Found Items</div>
              </div>
              <div className="text-center p-3 bg-accent/10 rounded-lg">
                <div className="text-2xl font-bold text-accent">
                  {myListings.filter((l) => l.status === "claimed").length}
                </div>
                <div className="text-xs text-muted-foreground">Resolved</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

