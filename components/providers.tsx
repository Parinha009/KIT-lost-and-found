"use client"

import type { ReactNode } from "react"
import { AuthProvider } from "@/lib/auth-context"
import { ListingsRealtimeBridge } from "@/components/listings-realtime-bridge"
import { Toaster } from "sonner"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ListingsRealtimeBridge />
      {children}
      <Toaster position="bottom-right" richColors />
    </AuthProvider>
  )
}
