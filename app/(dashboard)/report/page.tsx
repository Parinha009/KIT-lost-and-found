"use client"

import React from "react"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { createListingSchema } from "@/lib/validators"
import { uploadListingImages } from "@/lib/upload-adapter"
import { upsertListingCacheItem } from "@/lib/client/listings-cache"
import { publishListingsUpdated } from "@/lib/client/listings-sync"
import type { Listing } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ITEM_CATEGORIES,
  CAMPUS_LOCATIONS,
  type CampusLocation,
  type ItemCategory,
  type ListingType,
} from "@/lib/types"
import { Package, Search, Upload, X, MapPin, Calendar, FileText } from "lucide-react"
import { toast } from "sonner"
import { ZodError } from "zod"

function ReportPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<ListingType>("lost")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDbReady, setIsDbReady] = useState(false)
  const [photos, setPhotos] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    location: "",
    location_details: "",
    date_occurred: "",
    storage_location: "",
    storage_details: "",
  })

  useEffect(() => {
    const type = searchParams.get("type")
    if (type === "lost" || type === "found") {
      setActiveTab(type)
    }
  }, [searchParams])

  useEffect(() => {
    let cancelled = false

    async function checkDb() {
      try {
        const res = await fetch("/api/health/db", { cache: "no-store" })
        if (!cancelled) setIsDbReady(res.ok)
      } catch {
        if (!cancelled) setIsDbReady(false)
      }
    }

    checkDb()
    return () => {
      cancelled = true
    }
  }, [])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: e.target.value,
    }))
    // Clear error for this field when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }))
    }
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    // Clear error for this field when user selects
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }))
    }
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length + photos.length > 5) {
      toast.error("Maximum 5 photos allowed")
      return
    }

    const newPhotos = [...photos, ...files]
    setPhotos(newPhotos)

    // Create preview URLs
    const newUrls = files.map((file) => URL.createObjectURL(file))
    setPreviewUrls((prev) => [...prev, ...newUrls])
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
    setPreviewUrls((prev) => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFieldErrors({})

    try {
      const dataToValidate = {
        ...formData,
        type: activeTab,
      }

      const validatedData = createListingSchema.parse(dataToValidate)

      if (activeTab === "found" && photos.length === 0) {
        toast.error("Found items must include at least one photo")
        setIsSubmitting(false)
        return
      }

      if (activeTab === "found" && !validatedData.storage_location?.trim()) {
        setFieldErrors((prev) => ({
          ...prev,
          storage_location: "Storage location is required for found items",
        }))
        toast.error("Storage location is required for found items")
        setIsSubmitting(false)
        return
      }

      if (!user) {
        toast.error("You must be logged in to create a listing")
        setIsSubmitting(false)
        return
      }
      let createdListing: Listing

      if (!isDbReady) {
        toast.error("Database is not ready. Run `pnpm db:bootstrap` and refresh.")
        setIsSubmitting(false)
        return
      }

      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...validatedData,
          category: validatedData.category as ItemCategory,
          location: validatedData.location as CampusLocation,
          user_id: user.id,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            phone: user.phone,
            avatar_url: user.avatar_url,
          },
        }),
      })

      const json = (await res.json()) as { ok?: boolean; data?: Listing; error?: string }
      if (!res.ok || !json.ok || !json.data) {
        throw new Error(json.error || "Failed to create listing")
      }

      createdListing = json.data

      if (photos.length > 0) {
        let uploadedPhotoUrls: string[] = []
        try {
          uploadedPhotoUrls = await uploadListingImages(photos, {
            userId: user.id,
            listingId: createdListing.id,
            strict: true,
          })
        } catch (error) {
          await fetch(`/api/items/${createdListing.id}`, {
            method: "DELETE",
            headers: {
              "x-user-id": user.id,
              "x-user-role": user.role,
            },
          }).catch(() => {})
          throw error
        }

        if (uploadedPhotoUrls.length > 0) {
          const patchRes = await fetch(`/api/items/${createdListing.id}`, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              "x-user-id": user.id,
              "x-user-role": user.role,
            },
            body: JSON.stringify({ photoUrls: uploadedPhotoUrls }),
          })

          const patchJson = (await patchRes.json()) as {
            ok?: boolean
            data?: Listing
            error?: string
          }
          if (!patchRes.ok || !patchJson.ok || !patchJson.data) {
            throw new Error(patchJson.error || "Failed to attach listing photos")
          }

          createdListing = patchJson.data
        }
      }

      const itemType = activeTab === "lost" ? "Lost" : "Found"
      upsertListingCacheItem(createdListing)
      publishListingsUpdated({ type: "created", id: createdListing.id })
      toast.success(`${itemType} item reported successfully!`)
      router.push(`/listings?success=true&type=${activeTab}&created=${createdListing.id}`)
    } catch (error) {
      if (error instanceof ZodError) {
        // Extract field errors from Zod validation
        const errors: Record<string, string> = {}
        error.errors.forEach((err) => {
          const path = err.path[0] as string
          errors[path] = err.message
        })
        setFieldErrors(errors)
        toast.error("Please fix the errors in the form")
      } else {
        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : "Failed to submit report. Please try again."
        toast.error(message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const canRegisterFound = user?.role === "staff" || user?.role === "admin"

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Report an Item</h1>
        <p className="text-muted-foreground">
          Fill out the form below to report a lost or found item
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ListingType)}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="lost" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Lost Item
          </TabsTrigger>
          <TabsTrigger
            value="found"
            className="flex items-center gap-2"
            disabled={!canRegisterFound}
          >
            <Search className="w-4 h-4" />
            Found Item
            {!canRegisterFound && (
              <span className="text-xs text-muted-foreground">(Staff only)</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lost">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-orange-500" />
                Report Lost Item
              </CardTitle>
              <CardDescription>
                Describe the item you lost so others can help you find it
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <ItemFormFields
                  formData={formData}
                  onInputChange={handleInputChange}
                  onSelectChange={handleSelectChange}
                  type="lost"
                  fieldErrors={fieldErrors}
                />

                {/* Photo Upload (Optional for lost) */}
                <div className="space-y-2">
                  <Label>Photo (Optional)</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Upload a photo of the item if you have one
                  </p>
                  <PhotoUploader
                    photos={photos}
                    previewUrls={previewUrls}
                    onUpload={handlePhotoUpload}
                    onRemove={removePhoto}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 bg-transparent"
                    onClick={() => router.back()}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Submit Report"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="found">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5 text-primary" />
                Register Found Item
              </CardTitle>
              <CardDescription>
                Register an item you found to help the owner recover it
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <ItemFormFields
                  formData={formData}
                  onInputChange={handleInputChange}
                  onSelectChange={handleSelectChange}
                  type="found"
                  fieldErrors={fieldErrors}
                />

                {/* Storage Location (Required for found items) */}
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  <h3 className="font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Storage Information
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="storage_location">Storage Location *</Label>
                      <Select
                        value={formData.storage_location}
                        onValueChange={(v) => handleSelectChange("storage_location", v)}
                      >
                        <SelectTrigger aria-invalid={!!fieldErrors.storage_location}>
                          <SelectValue placeholder="Select storage location" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Security Office">Security Office</SelectItem>
                          <SelectItem value="Admin Office">Admin Office</SelectItem>
                          <SelectItem value="Library Front Desk">Library Front Desk</SelectItem>
                          <SelectItem value="Student Center">Student Center</SelectItem>
                        </SelectContent>
                      </Select>
                      {fieldErrors.storage_location && (
                        <p className="text-sm text-destructive">{fieldErrors.storage_location}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="storage_details">Storage Details</Label>
                      <Input
                        id="storage_details"
                        name="storage_details"
                        placeholder="e.g., Shelf B-3"
                        value={formData.storage_details}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>

                {/* Photo Upload (Required for found) */}
                <div className="space-y-2">
                  <Label>Photos *</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Upload clear photos to help identify the item
                  </p>
                  <PhotoUploader
                    photos={photos}
                    previewUrls={previewUrls}
                    onUpload={handlePhotoUpload}
                    onRemove={removePhoto}
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 bg-transparent"
                    onClick={() => router.back()}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Register Item"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface ItemFormFieldsProps {
  formData: {
    title: string
    description: string
    category: string
    location: string
    location_details: string
    date_occurred: string
  }
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onSelectChange: (name: string, value: string) => void
  type: ListingType
  fieldErrors: Record<string, string>
}

function ItemFormFields({ formData, onInputChange, onSelectChange, type, fieldErrors }: ItemFormFieldsProps) {
  return (
    <>
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Item Title *</Label>
        <Input
          id="title"
          name="title"
          placeholder={type === "lost" ? "e.g., Black Leather Wallet" : "e.g., Blue Backpack"}
          value={formData.title}
          onChange={onInputChange}
          required
          aria-invalid={!!fieldErrors.title}
        />
        {fieldErrors.title && (
          <p className="text-sm text-destructive">{fieldErrors.title}</p>
        )}
      </div>

      {/* Category and Location Row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
          <Select
            value={formData.category}
            onValueChange={(v) => onSelectChange("category", v)}
          >
            <SelectTrigger aria-invalid={!!fieldErrors.category}>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {ITEM_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.category && (
            <p className="text-sm text-destructive">{fieldErrors.category}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">
            {type === "lost" ? "Last Seen Location" : "Found Location"} *
          </Label>
          <Select
            value={formData.location}
            onValueChange={(v) => onSelectChange("location", v)}
          >
            <SelectTrigger aria-invalid={!!fieldErrors.location}>
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {CAMPUS_LOCATIONS.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {loc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.location && (
            <p className="text-sm text-destructive">{fieldErrors.location}</p>
          )}
        </div>
      </div>

      {/* Location Details and Date Row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="location_details">Location Details</Label>
          <Input
            id="location_details"
            name="location_details"
            placeholder="e.g., Near the vending machines"
            value={formData.location_details}
            onChange={onInputChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date_occurred" className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {type === "lost" ? "When did you lose it?" : "When was it found?"} *
          </Label>
          <Input
            id="date_occurred"
            name="date_occurred"
            type="datetime-local"
            value={formData.date_occurred}
            onChange={onInputChange}
            required
            aria-invalid={!!fieldErrors.date_occurred}
          />
          {fieldErrors.date_occurred && (
            <p className="text-sm text-destructive">{fieldErrors.date_occurred}</p>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="flex items-center gap-1">
          <FileText className="w-4 h-4" />
          Description *
        </Label>
        <Textarea
          id="description"
          name="description"
          placeholder={
            type === "lost"
              ? "Describe the item in detail (color, brand, distinguishing features, contents if applicable)..."
              : "Describe the item and its condition..."
          }
          value={formData.description}
          onChange={onInputChange}
          rows={4}
          required
          aria-invalid={!!fieldErrors.description}
        />
        {fieldErrors.description && (
          <p className="text-sm text-destructive">{fieldErrors.description}</p>
        )}
      </div>
    </>
  )
}

interface PhotoUploaderProps {
  photos: File[]
  previewUrls: string[]
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemove: (index: number) => void
  required?: boolean
}

function PhotoUploader({ previewUrls, onUpload, onRemove, required }: PhotoUploaderProps) {
  return (
    <div className="space-y-3">
      {previewUrls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {previewUrls.map((url, index) => (
            <div key={url} className="relative aspect-square rounded-md overflow-hidden">
              <img src={url || "/placeholder.svg"} alt={`Upload ${index + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute top-1 right-1 p-1 bg-background/80 rounded-full hover:bg-background"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {previewUrls.length < 5 && (
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-primary">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB (max 5 photos)</p>
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            multiple
            onChange={onUpload}
            required={required && previewUrls.length === 0}
          />
        </label>
      )}
    </div>
  )
}

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]">Loading...</div>}>
      <ReportPageContent />
    </Suspense>
  )
}

