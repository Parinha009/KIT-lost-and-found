"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { forgotPasswordSchema } from "@/lib/validators"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, ArrowLeft, Mail, CheckCircle } from "lucide-react"

function isRateLimitMessage(message: string): boolean {
  return /rate limit/i.test(message) || /too many requests/i.test(message)
}

function getForgotPasswordErrorMessage(message: string): string {
  if (isRateLimitMessage(message)) {
    return "Too many reset attempts. Please wait a moment and try again."
  }

  return message
}

function getRetrySeconds(message: string): number {
  const match = message.match(/(\d+)\s*(second|seconds|sec|s)\b/i)
  if (!match) return 60

  const value = Number.parseInt(match[1], 10)
  if (Number.isNaN(value) || value <= 0) return 60
  return Math.min(value, 300)
}

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth()
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState("")
  const [cooldownSeconds, setCooldownSeconds] = useState(0)

  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const timer = window.setInterval(() => {
      setCooldownSeconds((current) => (current > 0 ? current - 1 : 0))
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [cooldownSeconds])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (cooldownSeconds > 0) {
      setError(`Please wait ${cooldownSeconds}s before requesting another reset link.`)
      return
    }

    const parsed = forgotPasswordSchema.safeParse({ email: email.trim() })
    if (!parsed.success) {
      const message = parsed.error.errors[0]?.message || "Please enter a valid email"
      setError(message)
      return
    }

    setIsLoading(true)
    try {
      const result = await forgotPassword(parsed.data.email)

      if (!result.success) {
        const isRateLimited = isRateLimitMessage(result.error || "")
        const friendlyMessage = getForgotPasswordErrorMessage(
          result.error || "Unable to send reset link"
        )

        setError(friendlyMessage)
        if (isRateLimited) {
          setCooldownSeconds(getRetrySeconds(result.error || ""))
        }
        if (!isRateLimited) {
          toast.error(friendlyMessage)
        }
        return
      }

      setIsSubmitted(true)
      toast.success("Password reset email sent")
    } catch {
      const message = "Unable to send reset link right now. Please try again."
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Back to Login */}
        <Link 
          href="/login" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Login
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
            <CardTitle className="text-2xl font-semibold text-center">
              {isSubmitted ? "Check your email" : "Forgot password?"}
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              {isSubmitted 
                ? "We've sent a password reset link to your email"
                : "Enter your email and we'll send you a reset link"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSubmitted ? (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="flex items-center justify-center w-16 h-16 bg-accent/20 rounded-full mb-4">
                    <CheckCircle className="w-8 h-8 text-accent" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    If an account exists for <span className="font-medium text-foreground">{email}</span>, 
                    you will receive a password reset email shortly.
                  </p>
                </div>

                <div className="space-y-3">
                  <Button 
                    type="button" 
                    className="w-full" 
                    onClick={() => {
                      setIsSubmitted(false)
                      setEmail("")
                    }}
                  >
                    Try another email
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full bg-transparent"
                    asChild
                  >
                    <Link href="/login">
                      Return to login
                    </Link>
                  </Button>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  {"Didn't receive the email? Check your spam folder or "}
                  <button 
                    type="button"
                    onClick={() => {
                      setIsSubmitted(false)
                    }}
                    className="text-primary hover:underline"
                  >
                    try again
                  </button>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@kit.edu.kh"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (error) {
                          setError("")
                        }
                      }}
                      disabled={isLoading}
                      className="pl-10"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading || cooldownSeconds > 0}>
                  {isLoading
                    ? "Sending reset link..."
                    : cooldownSeconds > 0
                      ? `Retry in ${cooldownSeconds}s`
                      : "Send reset link"}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Remember your password?{" "}
                  <Link href="/login" className="text-primary font-medium hover:underline">
                    Sign in
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {"Don't have an account? "}
          <Link href="/register" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
