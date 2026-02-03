"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
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
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Package,
  User,
  Clock,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Archive,
} from "lucide-react"
import { getListingById, getClaimsByListingId } from "@/lib/mock-data"
import { formatDate, formatDateTime } from "@/lib/date-utils"

interface ListingDetailPageProps {
  params: Promise<{ id: string }>
}

export default function ListingDetailPage({ params }: ListingDetailPageProps) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { user } = useAuth()
  const [claimDialogOpen, setClaimDialogOpen] = useState(false)
  const [claimProof, setClaimProof] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const listing = getListingById(resolvedParams.id)
  const claims = listing ? getClaimsByListingId(listing.id) : []

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
    if (!claimProof.trim()) return

    setIsSubmitting(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsSubmitting(false)
    setClaimDialogOpen(false)
    setClaimProof("")
    // Show success message or redirect
    router.refresh()
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
                  <Button variant="outline" className="w-full bg-transparent">
                    Edit Listing
                  </Button>
                  <Button variant="outline" className="w-full text-destructive bg-transparent">
                    Close Listing
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
