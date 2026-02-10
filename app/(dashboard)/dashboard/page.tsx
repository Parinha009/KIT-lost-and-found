"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Package,
  Search,
  CheckCircle,
  Clock,
  Plus,
  ArrowRight,
  MapPin,
  Calendar,
} from "lucide-react"
import type { Claim, Listing } from "@/lib/types"
import { formatDistanceToNow } from "@/lib/date-utils"

export default function DashboardPage() {
  const { user } = useAuth()
  const [listings, setListings] = useState<Listing[]>([])
  const [pendingClaimsCount, setPendingClaimsCount] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    const actor = user
    const actorHeaders: Record<string, string> = {
      "x-user-id": actor.id,
      "x-user-role": actor.role,
    }

    let cancelled = false

    async function load() {
      try {
        const [listingsRes, claimsRes] = await Promise.all([
          fetch("/api/listings", { cache: "no-store" }),
          fetch("/api/claims?status=pending", { cache: "no-store", headers: actorHeaders }),
        ])

        const listingsJson = (await listingsRes.json().catch(() => ({}))) as {
          ok?: boolean
          data?: Listing[]
          error?: string
        }
        if (!listingsRes.ok || !listingsJson.ok) {
          throw new Error(listingsJson.error || "Failed to load listings")
        }

        const claimsJson = (await claimsRes.json().catch(() => ({}))) as {
          ok?: boolean
          data?: Claim[]
          error?: string
        }
        if (!claimsRes.ok || !claimsJson.ok) {
          throw new Error(claimsJson.error || "Failed to load claims")
        }

        const nextListings = Array.isArray(listingsJson.data) ? listingsJson.data : []
        const nextClaims = Array.isArray(claimsJson.data) ? claimsJson.data : []

        if (!cancelled) {
          setLoadError(null)
          setListings(nextListings)
          setPendingClaimsCount(nextClaims.filter((c) => c.status === "pending").length)
        }
      } catch (error) {
        if (!cancelled) {
          setListings([])
          setPendingClaimsCount(0)
          setLoadError(error instanceof Error ? error.message : "Failed to load dashboard data")
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user, user?.id, user?.role])

  const stats = useMemo(() => {
    const totalLost = listings.filter((l) => l.type === "lost").length
    const totalFound = listings.filter((l) => l.type === "found").length
    const totalMatched = listings.filter((l) => l.status === "matched").length
    const totalClaimed = listings.filter((l) => l.status === "claimed").length

    return {
      total_lost: totalLost,
      total_found: totalFound,
      total_matched: totalMatched,
      total_claimed: totalClaimed,
      pending_claims: pendingClaimsCount,
      recent_listings: listings.slice(0, 3),
    }
  }, [listings, pendingClaimsCount])

  const statCards = [
    {
      title: "Lost Items",
      value: stats.total_lost,
      description: "Items reported lost",
      icon: Package,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      title: "Found Items",
      value: stats.total_found,
      description: "Items found on campus",
      icon: Search,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Matched",
      value: stats.total_matched,
      description: "Potential matches found",
      icon: CheckCircle,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Pending Claims",
      value: stats.pending_claims,
      description: "Awaiting review",
      icon: Clock,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {user?.name?.split(" ")[0] || "User"}
          </h1>
          <p className="text-muted-foreground">
            {"Here's what's happening with lost and found items on campus"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/report?type=lost">
              <Plus className="w-4 h-4 mr-2" />
              Report Lost Item
            </Link>
          </Button>
          {(user?.role === "staff" || user?.role === "admin") && (
            <Button variant="outline" asChild>
              <Link href="/report?type=found">
                <Plus className="w-4 h-4 mr-2" />
                Register Found Item
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-md ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {loadError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{loadError}</CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks you can perform</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant="outline" className="justify-start bg-transparent" asChild>
              <Link href="/listings">
                <Search className="w-4 h-4 mr-2" />
                Search All Items
              </Link>
            </Button>
            <Button variant="outline" className="justify-start bg-transparent" asChild>
              <Link href="/my-listings">
                <Package className="w-4 h-4 mr-2" />
                View My Listings
              </Link>
            </Button>
            <Button variant="outline" className="justify-start bg-transparent" asChild>
              <Link href="/notifications">
                <Clock className="w-4 h-4 mr-2" />
                Check Notifications
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Listings</CardTitle>
              <CardDescription>Latest items reported</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/listings">
                View all
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recent_listings.map((listing) => (
                <Link
                  key={listing.id}
                  href={`/listings/${listing.id}`}
                  className="flex items-start gap-3 p-2 rounded-md hover:bg-muted transition-colors"
                >
                  <div
                    className={`p-2 rounded-md ${
                      listing.type === "lost" ? "bg-orange-500/10" : "bg-primary/10"
                    }`}
                  >
                    <Package
                      className={`h-4 w-4 ${
                        listing.type === "lost" ? "text-orange-500" : "text-primary"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{listing.title}</p>
                      <Badge
                        variant={listing.type === "lost" ? "destructive" : "default"}
                        className="text-xs capitalize"
                      >
                        {listing.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {listing.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDistanceToNow(listing.created_at)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role-specific info */}
      {user?.role === "staff" && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="default">Staff</Badge>
              Pending Reviews
            </CardTitle>
            <CardDescription>
              You have {stats.pending_claims} claim(s) waiting for your review
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/claims">Review Claims</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {user?.role === "admin" && (
        <Card className="border-accent/20 bg-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge className="bg-accent text-accent-foreground">Admin</Badge>
              System Overview
            </CardTitle>
            <CardDescription>
              Access administrative functions and system management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin">Go to Admin Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
