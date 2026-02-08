"use client"

import { use, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { createClaimSchema } from "@/lib/validators"
import { deleteListing, getListing, getListingClaims, updateListing } from "@/lib/items"
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
  const { user } = useAuth()
  const [claimDialogOpen, setClaimDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [claimProof, setClaimProof] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    locationDetails: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const listing = useMemo(
    () => getListing(resolvedParams.id),
    [resolvedParams.id, refreshKey]
  )
  const claims = useMemo(
    () => (listing ? getListingClaims(listing.id) : []),
    [listing]
  )

  useEffect(() => {
    if (!listing) return
    setEditForm({
      title: listing.title,
      description: listing.description,
      locationDetails: listing.location_details || "",
    })
  }, [listing])

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
  const canClaim = listing.type === "found" && listing.status === "active" && !isOwner
  const hasExistingClaim = claims.some(
    (c) => c.claimant_id === user?.id && c.status === "pending"
  )

  const handleSubmitClaim = async () => {
    if (!listing) return

    setIsSubmitting(true)
    try {
      createClaimSchema.parse({
        listing_id: listing.id,
        proof_description: claimProof,
      })

      await new Promise((resolve) => setTimeout(resolve, 800))
      setClaimDialogOpen(false)
      setClaimProof("")
      toast.success("Claim submitted for review")
    } catch {
      toast.error("Please provide clearer proof (at least 20 characters)")
    } finally {
      setIsSubmitting(false)
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
      const updated = updateListing(listing.id, {
        title,
        description,
        location_details: locationDetails || undefined,
      })

      if (!updated) {
        toast.error("Unable to save changes")
        return
      }

      setEditDialogOpen(false)
      setRefreshKey((prev) => prev + 1)
      toast.success("Listing updated")
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleCloseListing = () => {
    if (!listing) return
    const updated = updateListing(listing.id, { status: "closed" })
    if (!updated) {
      toast.error("Unable to close listing")
      return
    }
    setRefreshKey((prev) => prev + 1)
    toast.success("Listing closed")
  }

  const handleDeleteListing = () => {
    if (!listing) return
    if (!window.confirm("Delete this listing permanently?")) return

    setIsDeleting(true)
    try {
      const deleted = deleteListing(listing.id)
      if (!deleted) {
        toast.error("Unable to delete listing")
        return
      }
      toast.success("Listing deleted")
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
              {listing.photos && listing.photos.length > 0 ? (
                <img
                  src={listing.photos[0].url || "/placeholder.svg"}
                  alt={listing.title}
                  className="w-full h-full object-cover"
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

            {listing.photos && listing.photos.length > 1 && (
              <div className="p-4 grid grid-cols-4 gap-2">
                {listing.photos.slice(1).map((photo, index) => (
                  <div
                    key={photo.id}
                    className="aspect-square rounded-md overflow-hidden bg-muted"
                  >
                    <img
                      src={photo.url || "/placeholder.svg"}
                      alt={`${listing.title} ${index + 2}`}
                      className="w-full h-full object-cover"
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

          {/* Claims Section (for staff/admin or owner) */}
          {(isStaffOrAdmin || isOwner) && claims.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Claims ({claims.length})</CardTitle>
                <CardDescription>People who have claimed this item</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {claims.map((claim) => (
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
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button size="sm" variant="outline">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
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
              {canClaim && !hasExistingClaim && (
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

              {hasExistingClaim && (
                <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground text-center">
                  You have already submitted a claim for this item
                </div>
              )}

              {isOwner && (
                <>
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
                  <Button
                    variant="outline"
                    className="w-full bg-transparent"
                    onClick={handleCloseListing}
                    disabled={listing.status === "closed"}
                  >
                    Close Listing
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full text-destructive bg-transparent"
                    onClick={handleDeleteListing}
                    disabled={isDeleting}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {isDeleting ? "Deleting..." : "Delete Listing"}
                  </Button>
                </>
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
          {listing.type === "found" && (
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
