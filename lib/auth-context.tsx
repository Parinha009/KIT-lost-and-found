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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load user from localStorage on mount (for demo persistence)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY)
      if (stored) {
        const parsedUser = JSON.parse(stored) as User
        setUser(parsedUser)
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
      id: `user-${Date.now()}`,
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
      id: `user-${Date.now()}`,
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
