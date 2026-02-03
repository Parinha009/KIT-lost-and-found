"use client"

import React from "react"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
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
import { ITEM_CATEGORIES, CAMPUS_LOCATIONS, type ListingType } from "@/lib/types"
import { Package, Search, Upload, X, MapPin, Calendar, FileText } from "lucide-react"

function ReportPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<ListingType>("lost")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [photos, setPhotos] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])

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

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length + photos.length > 5) {
      alert("Maximum 5 photos allowed")
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

    // Validate required fields
    if (!formData.title || !formData.description || !formData.category || !formData.location) {
      alert("Please fill in all required fields")
      setIsSubmitting(false)
      return
    }

    // For found items, photos are strongly recommended
    if (activeTab === "found" && photos.length === 0) {
      const confirm = window.confirm(
        "Photos are highly recommended for found items. Continue without photos?"
      )
      if (!confirm) {
        setIsSubmitting(false)
        return
      }
    }

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Success - redirect to listings
    router.push("/listings?success=true&type=" + activeTab)
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
                        <SelectTrigger>
                          <SelectValue placeholder="Select storage location" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Security Office">Security Office</SelectItem>
                          <SelectItem value="Admin Office">Admin Office</SelectItem>
                          <SelectItem value="Library Front Desk">Library Front Desk</SelectItem>
                          <SelectItem value="Student Center">Student Center</SelectItem>
                        </SelectContent>
                      </Select>
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
}

function ItemFormFields({ formData, onInputChange, onSelectChange, type }: ItemFormFieldsProps) {
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
        />
      </div>

      {/* Category and Location Row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
          <Select
            value={formData.category}
            onValueChange={(v) => onSelectChange("category", v)}
          >
            <SelectTrigger>
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
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">
            {type === "lost" ? "Last Seen Location" : "Found Location"} *
          </Label>
          <Select
            value={formData.location}
            onValueChange={(v) => onSelectChange("location", v)}
          >
            <SelectTrigger>
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
          />
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
        />
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
