"use client"

import React from "react"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Eye,
  FileText,
  AlertTriangle,
} from "lucide-react"
import {
  getLostFoundWebService,
} from "@/lib/services/lost-found-service"
import { formatDateTime, formatDistanceToNow } from "@/lib/date-utils"
import type { Claim, ClaimStatus } from "@/lib/types"
import { toast } from "sonner"

const statusColors: Record<ClaimStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  approved: "bg-accent/10 text-accent border-accent/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
}

const statusIcons: Record<ClaimStatus, React.ReactNode> = {
  pending: <Clock className="w-4 h-4" />,
  approved: <CheckCircle className="w-4 h-4" />,
  rejected: <XCircle className="w-4 h-4" />,
}

const lostFoundService = getLostFoundWebService()

export default function ClaimsPage() {
  const { user } = useAuth()
  const [claims, setClaims] = useState<Claim[]>([])
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)
  const [actionDialog, setActionDialog] = useState<"approve" | "reject" | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [handoverNotes, setHandoverNotes] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    const refreshClaims = () => {
      setClaims(lostFoundService.getAllClaims())
    }

    refreshClaims()
    window.addEventListener("kit-lf-claims-updated", refreshClaims)
    window.addEventListener("storage", refreshClaims)

    return () => {
      window.removeEventListener("kit-lf-claims-updated", refreshClaims)
      window.removeEventListener("storage", refreshClaims)
    }
  }, [])

  const isStaffOrAdmin = user?.role === "staff" || user?.role === "admin"

  // Filter claims based on user role
  const myClaims = claims.filter((c) => c.claimant_id === user?.id)
  const pendingClaims = claims.filter((c) => c.status === "pending")
  const processedClaims = claims.filter((c) => c.status !== "pending")

  const handleApprove = async () => {
    if (!selectedClaim || !user) return
    setIsProcessing(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 500))
      const updatedClaim = lostFoundService.updateClaimStatus(selectedClaim.id, {
        status: "approved",
        reviewer_id: user.id,
        handover_at: new Date().toISOString(),
        handover_notes: handoverNotes.trim() || undefined,
      })

      if (!updatedClaim) {
        toast.error("Unable to approve this claim.")
        return
      }

      lostFoundService.createNotification({
        user_id: updatedClaim.claimant_id,
        type: "claim_approved",
        title: `Claim approved for "${updatedClaim.listing?.title || "your item"}"`,
        message:
          `Your claim for "${updatedClaim.listing?.title || "this item"}" was approved.` +
          " Please coordinate pickup with staff.",
        related_listing_id: updatedClaim.listing_id,
        related_claim_id: updatedClaim.id,
      })

      setClaims(lostFoundService.getAllClaims())
      toast.success("Claim approved and claimant notified.")
      setActionDialog(null)
      setSelectedClaim(null)
      setHandoverNotes("")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedClaim || !rejectionReason.trim() || !user) return
    setIsProcessing(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 500))
      const updatedClaim = lostFoundService.updateClaimStatus(selectedClaim.id, {
        status: "rejected",
        reviewer_id: user.id,
        rejection_reason: rejectionReason.trim(),
      })

      if (!updatedClaim) {
        toast.error("Unable to reject this claim.")
        return
      }

      lostFoundService.createNotification({
        user_id: updatedClaim.claimant_id,
        type: "claim_rejected",
        title: `Claim rejected for "${updatedClaim.listing?.title || "your item"}"`,
        message:
          `Your claim for "${updatedClaim.listing?.title || "this item"}" was rejected. ` +
          `Reason: ${rejectionReason.trim()}`,
        related_listing_id: updatedClaim.listing_id,
        related_claim_id: updatedClaim.id,
      })

      setClaims(lostFoundService.getAllClaims())
      toast.success("Claim rejected and claimant notified.")
      setActionDialog(null)
      setSelectedClaim(null)
      setRejectionReason("")
    } finally {
      setIsProcessing(false)
    }
  }

  const ClaimCard = ({ claim, showActions = false }: { claim: Claim; showActions?: boolean }) => {
    const initials = claim.claimant?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U"

    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Item thumbnail */}
            <div className="w-16 h-16 rounded-md bg-muted overflow-hidden shrink-0">
              {claim.listing?.photos?.[0] ? (
                <img
                  src={claim.listing.photos[0].url || "/placeholder.svg"}
                  alt={claim.listing.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-muted-foreground/50" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/listings/${claim.listing_id}`}
                    className="font-medium hover:underline line-clamp-1"
                  >
                    {claim.listing?.title || "Unknown Item"}
                  </Link>
                  <Badge
                    variant="outline"
                    className={`mt-1 capitalize ${statusColors[claim.status]}`}
                  >
                    {statusIcons[claim.status]}
                    <span className="ml-1">{claim.status}</span>
                  </Badge>
                </div>
              </div>

              {/* Claimant info (for staff view) */}
              {showActions && (
                <div className="flex items-center gap-2 mt-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">
                    {claim.claimant?.name}
                  </span>
                </div>
              )}

              {/* Proof description */}
              <div className="mt-2 p-2 bg-muted rounded text-sm">
                <p className="text-xs text-muted-foreground font-medium mb-1">Proof provided:</p>
                <p className="line-clamp-2">{claim.proof_description}</p>
              </div>

              {/* Timestamps */}
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span>Submitted {formatDistanceToNow(claim.created_at)}</span>
                {claim.handover_at && (
                  <span>Handover: {formatDateTime(claim.handover_at)}</span>
                )}
              </div>

              {/* Rejection reason */}
              {claim.status === "rejected" && claim.rejection_reason && (
                <div className="mt-2 p-2 bg-destructive/10 rounded text-sm">
                  <p className="text-xs text-destructive font-medium mb-1">Rejection reason:</p>
                  <p className="text-destructive">{claim.rejection_reason}</p>
                </div>
              )}

              {/* Actions */}
              {showActions && claim.status === "pending" && (
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedClaim(claim)
                      setActionDialog("approve")
                    }}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedClaim(claim)
                      setActionDialog("reject")
                    }}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/listings/${claim.listing_id}`}>
                      <Eye className="w-4 h-4 mr-1" />
                      View Item
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const EmptyState = ({ title, description }: { title: string; description: string }) => (
    <div className="flex flex-col items-center justify-center py-12">
      <FileText className="w-12 h-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Claims</h1>
        <p className="text-muted-foreground">
          {isStaffOrAdmin
            ? "Review and manage item claims"
            : "Track the status of your claims"}
        </p>
      </div>

      {isStaffOrAdmin ? (
        // Staff/Admin View
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending" className="relative">
              Pending Review
              {pendingClaims.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {pendingClaims.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="processed">Processed</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4 space-y-4">
            {pendingClaims.length > 0 ? (
              pendingClaims.map((claim) => (
                <ClaimCard key={claim.id} claim={claim} showActions />
              ))
            ) : (
              <Card>
                <CardContent>
                  <EmptyState
                    title="No pending claims"
                    description="All claims have been processed"
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="processed" className="mt-4 space-y-4">
            {processedClaims.length > 0 ? (
              processedClaims.map((claim) => <ClaimCard key={claim.id} claim={claim} />)
            ) : (
              <Card>
                <CardContent>
                  <EmptyState
                    title="No processed claims"
                    description="Processed claims will appear here"
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        // Student View
        <div className="space-y-4">
          {myClaims.length > 0 ? (
            myClaims.map((claim) => <ClaimCard key={claim.id} claim={claim} />)
          ) : (
            <Card>
              <CardContent>
                <EmptyState
                  title="No claims yet"
                  description="When you claim an item, it will appear here"
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog open={actionDialog === "approve"} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Claim</DialogTitle>
            <DialogDescription>
              Confirm that the item is being handed over to the claimant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-md">
              <p className="font-medium">{selectedClaim?.listing?.title}</p>
              <p className="text-sm text-muted-foreground">
                Claimant: {selectedClaim?.claimant?.name}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="handoverNotes">Handover Notes (Optional)</Label>
              <Textarea
                id="handoverNotes"
                placeholder="Any notes about the handover..."
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={isProcessing}>
              {isProcessing ? "Processing..." : "Confirm Handover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={actionDialog === "reject"} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Reject Claim
            </DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this claim. The claimant will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-md">
              <p className="font-medium">{selectedClaim?.listing?.title}</p>
              <p className="text-sm text-muted-foreground">
                Claimant: {selectedClaim?.claimant?.name}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">Rejection Reason *</Label>
              <Textarea
                id="rejectionReason"
                placeholder="Explain why this claim is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || isProcessing}
            >
              {isProcessing ? "Processing..." : "Reject Claim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
