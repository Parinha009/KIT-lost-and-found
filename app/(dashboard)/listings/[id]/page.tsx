"use client"

import { use, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { createClaimSchema } from "@/lib/validators"
import { removeListingFromCache, upsertListingCacheItem } from "@/lib/client/listings-cache"
import { publishListingsUpdated, subscribeListingsUpdated } from "@/lib/client/listings-sync"
import type { Claim, Listing, User } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Package,
  Clock,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Archive,
  Trash2,
} from "lucide-react"
import { formatDate, formatDateTime } from "@/lib/date-utils"
import { toast } from "sonner"

interface ListingDetailPageProps {
  params: Promise<{ id: string }>
}

export default function ListingDetailPage({ params }: ListingDetailPageProps) {
  const resolvedParams = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const claimsEnabled = true
  const matchingEnabled = false
  const [claimDialogOpen, setClaimDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [matchDialogOpen, setMatchDialogOpen] = useState(false)
  const [claimProof, setClaimProof] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const [matchedListingId, setMatchedListingId] = useState("")
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    locationDetails: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isSavingMatch, setIsSavingMatch] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [listing, setListing] = useState<Listing | null>(null)
  const [isLoadingListing, setIsLoadingListing] = useState(true)
  const [claims, setClaims] = useState<Claim[]>([])
  const quickClaimHandledRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function loadListingAndClaims() {
      setIsLoadingListing(true)
      try {
        const res = await fetch(`/api/items/${resolvedParams.id}`, { cache: "no-store" })
        const json = (await res.json()) as { ok?: boolean; data?: Listing; error?: string }

        const nextListing = res.ok && json.ok && json.data ? json.data : null
        if (!cancelled) setListing(nextListing)

        if (!nextListing || !user || !claimsEnabled || nextListing.type !== "found") {
          if (!cancelled) setClaims([])
          return
        }

        const claimsRes = await fetch(
          `/api/claims?listingId=${encodeURIComponent(nextListing.id)}`,
          {
            cache: "no-store",
            headers: {
              "x-user-id": user.id,
              "x-user-role": user.role,
            },
          }
        )

        const claimsJson = (await claimsRes.json()) as {
          ok?: boolean
          data?: Claim[]
          error?: string
        }

        if (!cancelled) {
          setClaims(claimsRes.ok && claimsJson.ok && Array.isArray(claimsJson.data) ? claimsJson.data : [])
        }
      } catch (error) {
        if (!cancelled) {
          setListing(null)
          setClaims([])
          toast.error(error instanceof Error ? error.message : "Failed to load listing")
        }
      } finally {
        if (!cancelled) setIsLoadingListing(false)
      }
    }

    void loadListingAndClaims()
    return () => {
      cancelled = true
    }
  }, [resolvedParams.id, refreshKey, user])

  useEffect(() => {
    if (!listing) return
    setEditForm({
      title: listing.title,
      description: listing.description,
      locationDetails: listing.location_details || "",
    })
  }, [listing])

  useEffect(() => {
    return subscribeListingsUpdated((event) => {
      if (event.id && event.id !== resolvedParams.id) return

      if (event.type === "deleted" && event.id === resolvedParams.id) {
        toast("This listing was deleted.")
        router.replace("/listings")
        return
      }

      setRefreshKey((prev) => prev + 1)
    })
  }, [resolvedParams.id, router])

  useEffect(() => {
    quickClaimHandledRef.current = false
  }, [resolvedParams.id])

  useEffect(() => {
    if (quickClaimHandledRef.current) return
    if (searchParams.get("claim") !== "1") return
    if (!listing || !user) return

    const hasSubmittedClaim = claims.some((claim) => claim.claimant_id === user.id)
    const canAutoOpenClaim =
      user.role === "student" &&
      listing.type === "found" &&
      listing.user_id !== user.id &&
      (listing.status === "active" || listing.status === "matched") &&
      !hasSubmittedClaim

    if (!canAutoOpenClaim) return

    quickClaimHandledRef.current = true
    setClaimDialogOpen(true)
  }, [claims, listing, searchParams, user])

  if (isLoadingListing) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        Loading...
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Package className="w-12 h-12 text-muted-foreground/50 mb-4" />
        <h2 className="text-lg font-medium">Listing not found</h2>
        <p className="text-muted-foreground mb-4">
          The listing you{"'"}re looking for doesn{"'"}t exist or has been removed.
        </p>
        <Button asChild>
          <Link href="/listings">Back to listings</Link>
        </Button>
      </div>
    )
  }

  const isOwner = user?.id === listing.user_id
  const isStaffOrAdmin = user?.role === "staff" || user?.role === "admin"
  const actorHeaders: Record<string, string> = user
    ? {
        "x-user-id": user.id,
        "x-user-role": user.role,
      }
    : {}

  const isOwnerEditableListing = Boolean(
    user &&
      isOwner &&
      listing.status === "active"
  )
  const canEditListing = isOwnerEditableListing
  const canCloseListing = Boolean(user && isStaffOrAdmin && listing.status !== "closed")
  const canDeleteListing = Boolean(user && isOwnerEditableListing)
  const canReviewClaims = Boolean(user && isStaffOrAdmin && listing.type === "found")
  const showLegacyFoundReadonlyHint = false
  const userClaims = claims.filter((claim) => claim.claimant_id === user?.id)
  const hasSubmittedClaim = userClaims.length > 0
  const latestUserClaim = [...userClaims].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )[0]
  const canClaim =
    user?.role === "student" &&
    listing.type === "found" &&
    !isOwner &&
    (listing.status === "active" || listing.status === "matched") &&
    !hasSubmittedClaim
  const visibleClaims = isStaffOrAdmin || isOwner ? claims : userClaims

  const handleSubmitClaim = async () => {
    if (!claimsEnabled) {
      toast("Claims are coming soon.")
      return
    }
    if (!listing || !user) return

    setIsSubmitting(true)
    try {
      createClaimSchema.parse({
        listing_id: listing.id,
        proof_description: claimProof,
      })

      const res = await fetch("/api/claims", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...actorHeaders,
        },
        body: JSON.stringify({
          listing_id: listing.id,
          proof_description: claimProof.trim(),
          claimant: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            phone: user.phone,
            avatar_url: user.avatar_url,
          } satisfies Pick<User, "id" | "email" | "name" | "role" | "phone" | "avatar_url">,
        }),
      })

      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        toast.error(json.error || "Unable to submit claim")
        return
      }

      setClaimDialogOpen(false)
      setClaimProof("")
      setRefreshKey((prev) => prev + 1)
      toast.success("Claim submitted and sent to staff review.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please provide clearer proof (at least 20 characters)")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMatchListing = async () => {
    if (!matchingEnabled) {
      toast("Matching is coming soon.")
      return
    }
    if (!listing || !user) return
    if (!isStaffOrAdmin) return

    const otherId = matchedListingId.trim()
    if (!otherId) {
      toast.error("Enter a listing id to match")
      return
    }

    setIsSavingMatch(true)
    try {
      const res = await fetch(`/api/items/${listing.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...actorHeaders,
        },
        body: JSON.stringify({ status: "matched", matched_listing_id: otherId }),
      })

      const json = (await res.json()) as { ok?: boolean; data?: Listing; error?: string }
      if (!res.ok || !json.ok || !json.data) {
        toast.error(json.error || "Unable to mark as matched")
        return
      }

      setListing(json.data)
      upsertListingCacheItem(json.data)
      publishListingsUpdated({ type: "updated", id: json.data.id })
      setMatchDialogOpen(false)
      setMatchedListingId("")
      setRefreshKey((prev) => prev + 1)
      toast.success("Listing marked as matched")
    } finally {
      setIsSavingMatch(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!listing) return

    const title = editForm.title.trim()
    const description = editForm.description.trim()
    const locationDetails = editForm.locationDetails.trim()

    if (!title || !description) {
      toast.error("Title and description are required")
      return
    }

    setIsSavingEdit(true)
    try {
      const res = await fetch(`/api/items/${listing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", ...actorHeaders },
        body: JSON.stringify({
          title,
          description,
          location_details: locationDetails,
        }),
      })

      const json = (await res.json()) as { ok?: boolean; data?: Listing; error?: string }
      if (!res.ok || !json.ok || !json.data) {
        toast.error(json.error || "Unable to save changes")
        return
      }

      setListing(json.data)
      upsertListingCacheItem(json.data)
      publishListingsUpdated({ type: "updated", id: json.data.id })

      setEditDialogOpen(false)
      setRefreshKey((prev) => prev + 1)
      toast.success("Listing updated")
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleCloseListing = async () => {
    if (!listing) return

    try {
      const res = await fetch(`/api/items/${listing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", ...actorHeaders },
        body: JSON.stringify({ status: "closed" }),
      })

      const json = (await res.json()) as { ok?: boolean; data?: Listing; error?: string }
      if (!res.ok || !json.ok || !json.data) {
        toast.error(json.error || "Unable to close listing")
        return
      }

      setListing(json.data)
      upsertListingCacheItem(json.data)
      publishListingsUpdated({ type: "updated", id: json.data.id })

      setRefreshKey((prev) => prev + 1)
      toast.success("Listing closed")
    } catch {
      toast.error("Unable to close listing")
    }
  }

  const handleDeleteListing = async () => {
    if (!listing) return
    if (!window.confirm("Delete this listing permanently?")) return

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/items/${listing.id}`, {
        method: "DELETE",
        headers: actorHeaders,
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }

      if (!res.ok || !json.ok) {
        toast.error(json.error || "Unable to delete listing")
        return
      }

      toast.success("Listing deleted")
      removeListingFromCache(listing.id)
      publishListingsUpdated({ type: "deleted", id: listing.id })
      router.push("/listings")
    } finally {
      setIsDeleting(false)
    }
  }

  const initials = listing.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U"

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/listings">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to listings
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image Gallery */}
          <Card className="overflow-hidden">
            <div className="relative aspect-video bg-muted">
              {(listing.image_urls?.length ?? 0) > 0 || (listing.photos?.length ?? 0) > 0 ? (
                <Image
                  src={
                    listing.image_urls?.[0]?.trim() ||
                    listing.photos?.[0]?.url?.trim() ||
                    "/placeholder.svg"
                  }
                  alt={listing.title}
                  fill
                  sizes="(min-width: 1024px) 66vw, 100vw"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-16 h-16 text-muted-foreground/50" />
                </div>
              )}
              <Badge
                variant={listing.type === "lost" ? "destructive" : "default"}
                className="absolute top-4 left-4 capitalize text-sm"
              >
                {listing.type}
              </Badge>
            </div>

            {((listing.image_urls?.length ?? 0) > 1 || (listing.photos?.length ?? 0) > 1) && (
              <div className="p-4 grid grid-cols-4 gap-2">
                {(listing.image_urls?.length ? listing.image_urls.slice(1) : listing.photos.slice(1).map((p) => p.url)).map(
                  (url, index) => (
                  <div
                    key={`${url}-${index}`}
                    className="relative aspect-square rounded-md overflow-hidden bg-muted"
                  >
                    <Image
                      src={url || "/placeholder.svg"}
                      alt={`${listing.title} ${index + 2}`}
                      fill
                      sizes="(min-width: 1024px) 16vw, 25vw"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Details */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">{listing.title}</CardTitle>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="outline">{listing.category}</Badge>
                    <Badge
                      variant={listing.status === "active" ? "default" : "secondary"}
                      className="capitalize"
                    >
                      {listing.status}
                    </Badge>
                  </div>
                  {listing.status === "matched" && listing.matched_listing_id && (
                    <Link
                      href={`/listings/${listing.matched_listing_id}`}
                      className="mt-2 inline-block text-sm text-primary hover:underline"
                    >
                      View matched listing
                    </Link>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Description</h3>
                <p className="text-muted-foreground">{listing.description}</p>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">
                      {listing.type === "lost" ? "Last Seen Location" : "Found Location"}
                    </p>
                    <p className="text-sm text-muted-foreground">{listing.location}</p>
                    {listing.location_details && (
                      <p className="text-sm text-muted-foreground">{listing.location_details}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">
                      {listing.type === "lost" ? "Lost On" : "Found On"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(listing.date_occurred)}
                    </p>
                  </div>
                </div>

                {listing.storage_location && (
                  <div className="flex items-start gap-3">
                    <Archive className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Storage Location</p>
                      <p className="text-sm text-muted-foreground">{listing.storage_location}</p>
                      {listing.storage_details && isStaffOrAdmin && (
                        <p className="text-sm text-muted-foreground">{listing.storage_details}</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Posted</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(listing.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Claims Section */}
          {visibleClaims.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {isStaffOrAdmin || isOwner
                    ? `Claims (${visibleClaims.length})`
                    : "Your Claim"}
                </CardTitle>
                <CardDescription>
                  {isStaffOrAdmin || isOwner
                    ? "People who have claimed this item"
                    : "Your claim status for this item"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {visibleClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="flex items-start gap-4 p-4 rounded-lg bg-muted/50"
                  >
                    <Avatar>
                      <AvatarFallback>
                        {claim.claimant?.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{claim.claimant?.name}</p>
                        <Badge
                          variant={
                            claim.status === "approved"
                              ? "default"
                              : claim.status === "rejected"
                                ? "destructive"
                                : "secondary"
                          }
                          className="capitalize"
                        >
                          {claim.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {claim.proof_description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Submitted {formatDate(claim.created_at)}
                      </p>
                    </div>
                    {isStaffOrAdmin && claim.status === "pending" && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href="/claims">
                          Review in Claims
                        </Link>
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Posted By */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Posted by
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{listing.user?.name}</p>
                  <Badge variant="outline" className="capitalize text-xs">
                    {listing.user?.role}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {claimsEnabled && canClaim && (
                <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Claim This Item
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Claim Item</DialogTitle>
                      <DialogDescription>
                        Provide details to prove this item belongs to you. Be specific about
                        identifying features.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="proof">Proof of Ownership *</Label>
                        <Textarea
                          id="proof"
                          placeholder="Describe specific details that prove this item is yours (e.g., contents, unique marks, passcode hints)..."
                          value={claimProof}
                          onChange={(e) => setClaimProof(e.target.value)}
                          rows={4}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setClaimDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSubmitClaim}
                        disabled={!claimProof.trim() || isSubmitting}
                      >
                        {isSubmitting ? "Submitting..." : "Submit Claim"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

              {latestUserClaim?.status === "pending" && (
                <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground text-center">
                  You have already submitted a claim for this item.
                </div>
              )}

              {latestUserClaim?.status === "approved" && (
                <div className="p-3 rounded-md text-sm text-accent bg-accent/10 text-center">
                  Your claim has been approved. Please coordinate pickup with staff.
                </div>
              )}

              {latestUserClaim?.status === "rejected" && (
                <div className="p-3 rounded-md text-sm text-destructive bg-destructive/10 text-center">
                  Your latest claim was rejected. Review the details and contact staff if needed.
                </div>
              )}

              {showLegacyFoundReadonlyHint && (
                <div className="p-3 rounded-md text-sm bg-muted text-muted-foreground text-center">
                  This found listing is owned by your account. You cannot claim your own item.
                </div>
              )}

              {canEditListing && (
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full bg-transparent">
                      Edit Listing
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Listing</DialogTitle>
                      <DialogDescription>
                        Update the listing details shown to campus users.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label htmlFor="edit-title">Title</Label>
                        <Input
                          id="edit-title"
                          value={editForm.title}
                          onChange={(event) =>
                            setEditForm((prev) => ({ ...prev, title: event.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-description">Description</Label>
                        <Textarea
                          id="edit-description"
                          rows={4}
                          value={editForm.description}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              description: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-location-details">Location Details</Label>
                        <Input
                          id="edit-location-details"
                          value={editForm.locationDetails}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              locationDetails: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditDialogOpen(false)}
                        disabled={isSavingEdit}
                      >
                        Cancel
                      </Button>
                      <Button type="button" onClick={handleSaveEdit} disabled={isSavingEdit}>
                        {isSavingEdit ? "Saving..." : "Save Changes"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

              {matchingEnabled && isStaffOrAdmin && (
                <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full bg-transparent">
                      Mark as Matched
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Match Listing</DialogTitle>
                      <DialogDescription>
                        Link this listing to another listing (lost to found). This will mark both as matched.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                      <Label htmlFor="matched-id">Matched Listing ID</Label>
                      <Input
                        id="matched-id"
                        value={matchedListingId}
                        onChange={(e) => setMatchedListingId(e.target.value)}
                        placeholder="Paste the other listing id..."
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setMatchDialogOpen(false)}
                        disabled={isSavingMatch}
                      >
                        Cancel
                      </Button>
                      <Button type="button" onClick={handleMatchListing} disabled={isSavingMatch}>
                        {isSavingMatch ? "Saving..." : "Match"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

              {canCloseListing && (
                <Button
                  variant="outline"
                  className="w-full bg-transparent"
                  onClick={handleCloseListing}
                  disabled={listing.status === "closed"}
                >
                  Close Listing
                </Button>
              )}

              {canDeleteListing && (
                <Button
                  variant="outline"
                  className="w-full text-destructive bg-transparent"
                  onClick={handleDeleteListing}
                  disabled={isDeleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isDeleting ? "Deleting..." : "Delete Listing"}
                </Button>
              )}

              {canReviewClaims && (
                <Button variant="outline" className="w-full bg-transparent" asChild>
                  <Link href="/claims">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Review Claims
                  </Link>
                </Button>
              )}

              <Button variant="ghost" className="w-full" asChild>
                <Link href="/listings">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Listings
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Tips */}
          {claimsEnabled && listing.type === "found" && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  How to Claim
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>1. Click &quot;Claim This Item&quot; above</p>
                <p>2. Provide specific proof of ownership</p>
                <p>3. Wait for staff verification</p>
                <p>4. Visit the storage location for pickup</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

