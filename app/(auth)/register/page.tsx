"use client"

import React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { registerSchema } from "@/lib/validators"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Eye, EyeOff, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

export default function RegisterPage() {
  const router = useRouter()
  const { register } = useAuth()
  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  })
  const [showPassword, setShowPassword] = React.useState(false)
  const [error, setError] = React.useState("")
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setFieldErrors({})

    const parsed = registerSchema.safeParse(formData)
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {}
      parsed.error.errors.forEach((issue) => {
        const path = issue.path[0]
        if (typeof path === "string" && !nextErrors[path]) {
          nextErrors[path] = issue.message
        }
      })
      setFieldErrors(nextErrors)
      setError("Please fix the highlighted fields")
      toast.error("Please fix the highlighted fields")
      return
    }

    setIsSubmitting(true)

    const result = await register({
      email: parsed.data.email,
      password: parsed.data.password,
      name: parsed.data.name,
      phone: parsed.data.phone || undefined,
    })

    if (result.success) {
      toast.success("Account created successfully")
      router.push("/dashboard")
    } else {
      setIsSubmitting(false)
      setError(result.error || "Registration failed")
      toast.error(result.error || "Registration failed")
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Back to Home */}
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
            <Search className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold text-foreground">KIT Lost & Found</span>
        </div>

        <Card className="border-border shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-semibold text-center">Create an account</CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              Enter your details to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(fieldErrors.name)}
                />
                {fieldErrors.name && (
                  <p className="text-sm text-destructive">{fieldErrors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Campus Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@kit.edu.kh"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(fieldErrors.email)}
                />
                {fieldErrors.email && (
                  <p className="text-sm text-destructive">{fieldErrors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number (Optional)</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+855 12 345 678"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(fieldErrors.phone)}
                />
                {fieldErrors.phone && (
                  <p className="text-sm text-destructive">{fieldErrors.phone}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(fieldErrors.password)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-sm text-destructive">{fieldErrors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(fieldErrors.confirmPassword)}
                />
                {fieldErrors.confirmPassword && (
                  <p className="text-sm text-destructive">{fieldErrors.confirmPassword}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Creating account..." : "Create account"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          By creating an account, you agree to our{" "}
          <Link href="/terms" className="text-primary underline underline-offset-2">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-primary underline underline-offset-2">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  )
}
