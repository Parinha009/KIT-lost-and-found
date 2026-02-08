"use client"

import type { ReactNode } from "react"
import { AuthProvider } from "@/lib/auth-context"
import { Toaster } from "sonner"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <Toaster position="bottom-right" richColors />
    </AuthProvider>
  )
}
