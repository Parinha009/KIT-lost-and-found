"use client"

import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Calendar, Package, Eye } from "lucide-react"
import type { Listing } from "@/lib/types"
import { formatDistanceToNow } from "@/lib/date-utils"

interface ListingCardProps {
  listing: Listing
}

export function ListingCard({ listing }: ListingCardProps) {
  const primaryImageUrl =
    listing.image_urls?.[0]?.trim() || listing.photos?.[0]?.url?.trim() || ""
  const hasPhoto = primaryImageUrl.length > 0

  return (
    <Card className="group h-full overflow-hidden gap-0 py-0 transition-all duration-200 ease-out motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-lg">
      {/* Image */}
      <div className="relative h-[220px] w-full overflow-hidden bg-muted">
        {hasPhoto ? (
          <Image
            src={primaryImageUrl}
            alt={listing.title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover object-center transition-transform duration-500 ease-out motion-safe:group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-muted-foreground/50" />
          </div>
        )}
        {/* Type Badge */}
        <Badge
          variant={listing.type === "lost" ? "destructive" : "default"}
          className="absolute top-2 left-2 capitalize"
        >
          {listing.type}
        </Badge>
        {/* Status Badge */}
        {listing.status !== "active" && (
          <Badge variant="secondary" className="absolute top-2 right-2 capitalize">
            {listing.status}
          </Badge>
        )}
      </div>

      <CardContent className="flex flex-1 flex-col p-4">
        {/* Title */}
        <h3 className="font-semibold text-foreground line-clamp-1">{listing.title}</h3>

        {/* Category */}
        <Badge variant="outline" className="mt-2">
          {listing.category}
        </Badge>

        {/* Description */}
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{listing.description}</p>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {listing.location}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDistanceToNow(listing.created_at)}
          </span>
        </div>
      </CardContent>

      <CardFooter className="mt-auto p-4 pt-0">
        <Button variant="outline" size="sm" className="w-full bg-transparent" asChild>
          <Link href={`/listings/${listing.id}`}>
            <Eye className="w-4 h-4 mr-2" />
            View Details
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
