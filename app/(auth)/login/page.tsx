"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search, Eye, EyeOff, ArrowLeft } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { loginSchema } from "@/lib/validators"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type DemoRole = "student" | "staff" | "admin"

interface FieldErrors {
  email?: string
  password?: string
}

const demoEmails: Record<DemoRole, string> = {
  student: "student@kit.edu.kh",
  staff: "security@kit.edu.kh",
  admin: "admin@kit.edu.kh",
}

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isFormDisabled = isSubmitting || isLoading

  const clearGlobalError = () => {
    if (formError) {
      setFormError("")
    }
  }

  const handleEmailChange = (value: string) => {
    setEmail(value)
    clearGlobalError()
    if (fieldErrors.email) {
      setFieldErrors((prev) => ({ ...prev, email: undefined }))
    }
  }

  const handlePasswordChange = (value: string) => {
    setPassword(value)
    clearGlobalError()
    if (fieldErrors.password) {
      setFieldErrors((prev) => ({ ...prev, password: undefined }))
    }
  }

  const validateForm = () => {
    const nextErrors: FieldErrors = {}
    const parsed = loginSchema.safeParse({
      email: email.trim(),
      password,
    })

    if (!parsed.success) {
      parsed.error.errors.forEach((issue) => {
        const path = issue.path[0]
        if (path === "email" && !nextErrors.email) {
          nextErrors.email = issue.message
        }
        if (path === "password" && !nextErrors.password) {
          nextErrors.password = issue.message
        }
      })
    }

    setFieldErrors(nextErrors)

    return {
      isValid: Object.keys(nextErrors).length === 0,
      trimmedEmail: email.trim(),
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError("")

    const { isValid, trimmedEmail } = validateForm()
    if (!isValid) {
      return
    }

    setIsSubmitting(true)
    try {
      const result = await login(trimmedEmail, password)
      if (result.success) {
        router.push("/dashboard")
        return
      }

      setFormError(result.error || "Unable to sign in. Please try again.")
    } catch {
      setFormError("Unable to sign in right now. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDemoLogin = async (role: DemoRole) => {
    setFormError("")
    setFieldErrors({})
    setIsSubmitting(true)
    try {
      const result = await login(demoEmails[role], "demo")
      if (result.success) {
        router.push("/dashboard")
        return
      }

      setFormError(result.error || "Demo login failed. Please try again.")
    } catch {
      setFormError("Demo login failed. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
            <Search className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold text-foreground">KIT Lost & Found</span>
        </div>

        <Card className="border-border shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-semibold text-center">Welcome back</CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {formError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                  {formError}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@kit.edu.kh"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "email-error" : undefined}
                  disabled={isFormDisabled}
                />
                {fieldErrors.email && (
                  <p id="email-error" className="text-sm text-destructive">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? "password-error" : undefined}
                    disabled={isFormDisabled}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    disabled={isFormDisabled}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p id="password-error" className="text-sm text-destructive">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isFormDisabled}>
                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Demo accounts</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDemoLogin("student")}
                  disabled={isFormDisabled}
                >
                  Student
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDemoLogin("staff")}
                  disabled={isFormDisabled}
                >
                  Staff
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDemoLogin("admin")}
                  disabled={isFormDisabled}
                >
                  Admin
                </Button>
              </div>
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {"Don't have an account? "}
              <Link href="/register" className="text-primary font-medium hover:underline">
                Sign up
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
