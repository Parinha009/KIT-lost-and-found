"use client"

import { useState, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ListingCard } from "@/components/listing-card"
import { getLostFoundWebService } from "@/lib/services/lost-found-service"
import { ITEM_CATEGORIES, CAMPUS_LOCATIONS } from "@/lib/types"
import { Search, Filter, X, Package } from "lucide-react"

const lostFoundService = getLostFoundWebService()

function ListingsPageContent() {
  const searchParams = useSearchParams()
  const successMessage = searchParams.get("success")
  const defaultStatusFilter = "all"

  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [locationFilter, setLocationFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>(defaultStatusFilter)
  const [showFilters, setShowFilters] = useState(false)
  const allListings = useMemo(() => lostFoundService.getListings(), [successMessage])

  const filteredListings = useMemo(() => {
    return allListings.filter((listing) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase()
        const matchesSearch =
          listing.title.toLowerCase().includes(searchLower) ||
          listing.description.toLowerCase().includes(searchLower) ||
          listing.category.toLowerCase().includes(searchLower)
        if (!matchesSearch) return false
      }

      // Type filter
      if (typeFilter !== "all" && listing.type !== typeFilter) return false

      // Category filter
      if (categoryFilter !== "all" && listing.category !== categoryFilter) return false

      // Location filter
      if (locationFilter !== "all" && listing.location !== locationFilter) return false

      // Status filter
      if (statusFilter !== "all" && listing.status !== statusFilter) return false

      return true
    })
  }, [allListings, search, typeFilter, categoryFilter, locationFilter, statusFilter])

  const activeFiltersCount = [
    typeFilter !== "all",
    categoryFilter !== "all",
    locationFilter !== "all",
    statusFilter !== defaultStatusFilter,
  ].filter(Boolean).length

  const clearFilters = () => {
    setTypeFilter("all")
    setCategoryFilter("all")
    setLocationFilter("all")
    setStatusFilter(defaultStatusFilter)
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {successMessage && (
        <Card className="border-accent bg-accent/10">
          <CardContent className="p-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-accent" />
            <span className="text-sm font-medium">
              Your item has been successfully reported!
            </span>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Browse Items</h1>
          <p className="text-muted-foreground">
            Search through lost and found items on campus
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          {filteredListings.length} item{filteredListings.length !== 1 ? "s" : ""} found
        </Badge>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="relative"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {activeFiltersCount > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                {/* Type Filter */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Type</label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                      <SelectItem value="found">Found</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Category Filter */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Category</label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {ITEM_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Location Filter */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Location</label>
                  <Select value={locationFilter} onValueChange={setLocationFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      {CAMPUS_LOCATIONS.map((loc) => (
                        <SelectItem key={loc} value={loc}>
                          {loc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="matched">Matched</SelectItem>
                      <SelectItem value="claimed">Claimed</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Clear Filters */}
                {activeFiltersCount > 0 && (
                  <div className="flex items-end">
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="w-4 h-4 mr-1" />
                      Clear filters
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Filter Tags */}
        {activeFiltersCount > 0 && !showFilters && (
          <div className="flex flex-wrap gap-2">
            {typeFilter !== "all" && (
              <Badge variant="secondary" className="capitalize">
                {typeFilter}
                <button onClick={() => setTypeFilter("all")} className="ml-1">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            {categoryFilter !== "all" && (
              <Badge variant="secondary">
                {categoryFilter}
                <button onClick={() => setCategoryFilter("all")} className="ml-1">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            {locationFilter !== "all" && (
              <Badge variant="secondary">
                {locationFilter}
                <button onClick={() => setLocationFilter("all")} className="ml-1">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            {statusFilter !== defaultStatusFilter && (
              <Badge variant="secondary" className="capitalize">
                {statusFilter}
                <button onClick={() => setStatusFilter(defaultStatusFilter)} className="ml-1">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Listings Grid */}
      {filteredListings.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground">No items found</h3>
            <p className="text-sm text-muted-foreground text-center mt-1">
              Try adjusting your search or filters to find what you{"'"}re looking for
            </p>
            {activeFiltersCount > 0 && (
              <Button variant="outline" className="mt-4 bg-transparent" onClick={clearFilters}>
                Clear all filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function ListingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]">Loading...</div>}>
      <ListingsPageContent />
    </Suspense>
  )
}
