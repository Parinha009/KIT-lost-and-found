"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import type { User, UserRole } from "./types"
import { mockUsers } from "./mock-data"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  switchRole: (role: UserRole) => void // For demo purposes
}

interface RegisterData {
  email: string
  password: string
  name: string
  phone?: string
}

const AUTH_STORAGE_KEY = "kit-lf-auth-user"

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string) {
  return UUID_RE.test(value)
}

function createUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)

    // RFC 4122 v4
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
      16,
      20
    )}-${hex.slice(20)}`
  }

  // Very old browsers only: still return a UUID-shaped id.
  return `00000000-0000-4000-8000-${Math.random().toString(16).slice(2).padEnd(12, "0").slice(0, 12)}`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load user from localStorage on mount (for demo persistence)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY)
      if (stored) {
        const parsedUser = JSON.parse(stored) as User
        const fromMock = mockUsers.find(
          (candidate) => candidate.email.toLowerCase() === parsedUser.email.toLowerCase()
        )

        const normalized: User = fromMock
          ? fromMock
          : isUuid(parsedUser.id)
            ? parsedUser
            : { ...parsedUser, id: createUuid() }

        setUser(normalized)
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(normalized))
      }
    } catch {
      // Ignore parse errors
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (email: string, _password: string) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500))
    
    // Find user by email (mock)
    const foundUser = mockUsers.find((u) => u.email.toLowerCase() === email.toLowerCase())
    
    if (foundUser) {
      setUser(foundUser)
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(foundUser))
      return { success: true }
    }
    
    // For demo, create a student account if not found
    const newUser: User = {
      id: createUuid(),
      email: email,
      name: email.split("@")[0],
      role: "student",
      is_banned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    
    setUser(newUser)
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser))
    return { success: true }
  }, [])

  const register = useCallback(async (data: RegisterData) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500))
    
    // Check if email exists
    const existingUser = mockUsers.find(
      (u) => u.email.toLowerCase() === data.email.toLowerCase()
    )
    
    if (existingUser) {
      return { success: false, error: "Email already registered" }
    }
    
    // Create new user
    const newUser: User = {
      id: createUuid(),
      email: data.email,
      name: data.name,
      phone: data.phone,
      role: "student",
      is_banned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    
    setUser(newUser)
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser))
    return { success: true }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }, [])

  // For demo purposes - switch between different roles
  const switchRole = useCallback((role: UserRole) => {
    const userWithRole = mockUsers.find((u) => u.role === role)
    if (userWithRole) {
      setUser(userWithRole)
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userWithRole))
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
