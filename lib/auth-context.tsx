"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { Session } from "@supabase/supabase-js"
import type { Profile, User } from "@/lib/types"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { getProfileByUserId, mapSessionToUser } from "@/lib/auth/session"
import { registerPayloadSchema } from "@/lib/validators"

interface AuthResult {
  success: boolean
  error?: string
}

interface RegisterResult extends AuthResult {
  requiresEmailConfirmation?: boolean
}

interface RegisterData {
  email: string
  password: string
  name: string
  phone?: string
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<AuthResult>
  register: (data: RegisterData) => Promise<RegisterResult>
  logout: () => Promise<void>
  forgotPassword: (email: string) => Promise<AuthResult>
  resetPassword: (password: string) => Promise<AuthResult>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

type ProfileUpsertInput = {
  user_id: string
  full_name: string
  campus_email: string
  phone: string | null
}

type ProfileUpsertResult = {
  success: boolean
  error?: string
}

function normalizeError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

function formatSupabaseError(
  error: { message: string; code?: string; details?: string | null; hint?: string | null } | null
): string {
  if (!error) return "Unknown Supabase error"
  const details = [error.code, error.details, error.hint].filter(Boolean).join(" | ")
  return details ? `${error.message} (${details})` : error.message
}

function inferFullName(session: Session): string {
  const metadataName = session.user.user_metadata?.full_name
  if (typeof metadataName === "string" && metadataName.trim().length > 0) {
    return metadataName.trim()
  }

  const email = session.user.email || ""
  return email.split("@")[0] || "KIT User"
}

function inferCampusEmail(session: Session): string {
  return session.user.email || ""
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => {
    try {
      return getSupabaseBrowserClient()
    } catch {
      return null
    }
  }, [])

  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const syncCounterRef = useRef(0)

  const upsertProfile = useCallback(
    async (payload: ProfileUpsertInput): Promise<ProfileUpsertResult> => {
      if (!supabase) {
        return { success: false, error: "Supabase is not configured." }
      }

      const { error } = await supabase.from("profiles").upsert(payload, {
        onConflict: "user_id",
      })

      if (error) {
        console.error("[auth.profile] upsert failed", {
          userId: payload.user_id,
          error: formatSupabaseError(error),
        })
        return { success: false, error: formatSupabaseError(error) }
      }

      return { success: true }
    },
    [supabase]
  )

  const ensureProfile = useCallback(
    async (currentSession: Session): Promise<Profile | null> => {
      if (!supabase) return null

      const existing = await getProfileByUserId(supabase, currentSession.user.id)
      if (existing) return existing

      const inserted = await upsertProfile({
        user_id: currentSession.user.id,
        full_name: inferFullName(currentSession),
        campus_email: inferCampusEmail(currentSession),
        phone:
          typeof currentSession.user.user_metadata?.phone === "string"
            ? currentSession.user.user_metadata.phone
            : null,
      })

      if (!inserted.success) return null
      return getProfileByUserId(supabase, currentSession.user.id)
    },
    [supabase, upsertProfile]
  )

  const syncFromSession = useCallback(
    async (nextSession: Session | null): Promise<void> => {
      const syncId = ++syncCounterRef.current

      if (!nextSession || !supabase) {
        if (syncId !== syncCounterRef.current) return
        setSession(null)
        setProfile(null)
        setUser(null)
        return
      }

      const nextProfile = await ensureProfile(nextSession)
      if (syncId !== syncCounterRef.current) return

      setSession(nextSession)
      setProfile(nextProfile)
      setUser(mapSessionToUser(nextSession, nextProfile))
    },
    [ensureProfile, supabase]
  )

  useEffect(() => {
    let active = true

    async function bootstrap() {
      if (!supabase) {
        if (active) {
          setSession(null)
          setProfile(null)
          setUser(null)
          setIsLoading(false)
        }
        return
      }

      setIsLoading(true)
      const { data } = await supabase.auth.getSession()
      if (!active) return

      await syncFromSession(data.session)
      if (active) setIsLoading(false)
    }

    void bootstrap()

    if (!supabase) {
      return () => {
        active = false
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void (async () => {
        await syncFromSession(nextSession)
        if (active) setIsLoading(false)
      })()
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [supabase, syncFromSession])

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!supabase) return { success: false, error: "Supabase is not configured." }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error || !data.session) {
        return { success: false, error: error?.message || "Invalid email or password." }
      }

      await syncFromSession(data.session)
      return { success: true }
    },
    [supabase, syncFromSession]
  )

  const register = useCallback(
    async (data: RegisterData): Promise<RegisterResult> => {
      if (!supabase) return { success: false, error: "Supabase is not configured." }

      const validated = registerPayloadSchema.safeParse({
        full_name: data.name,
        campus_email: data.email,
        phone: data.phone || "",
        password: data.password,
      })

      if (!validated.success) {
        return {
          success: false,
          error: validated.error.errors[0]?.message || "Invalid registration input.",
        }
      }

      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/login` : undefined

      const { data: signUpData, error } = await supabase.auth.signUp({
        email: validated.data.campus_email,
        password: validated.data.password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: validated.data.full_name,
            phone: validated.data.phone || null,
          },
        },
      })

      if (error || !signUpData.user) {
        if (error) {
          console.error("[auth.register] signUp failed", {
            email: validated.data.campus_email,
            error: formatSupabaseError(error),
          })
        }
        return { success: false, error: error?.message || "Unable to create account." }
      }

      if (!signUpData.session) {
        return {
          success: true,
          requiresEmailConfirmation: true,
        }
      }

      const profilePayload: ProfileUpsertInput = {
        user_id: signUpData.user.id,
        full_name: validated.data.full_name,
        campus_email: validated.data.campus_email,
        phone: validated.data.phone || null,
      }

      let profileSaved = await upsertProfile(profilePayload)
      if (!profileSaved.success) {
        await new Promise((resolve) => setTimeout(resolve, 300))
        profileSaved = await upsertProfile(profilePayload)
      }

      if (!profileSaved.success) {
        return {
          success: false,
          error: `Account created, but profile setup failed: ${profileSaved.error || "Unknown error"}`,
        }
      }

      await syncFromSession(signUpData.session)

      return {
        success: true,
        requiresEmailConfirmation: false,
      }
    },
    [supabase, syncFromSession, upsertProfile]
  )

  const logout = useCallback(async (): Promise<void> => {
    if (!supabase) {
      setSession(null)
      setProfile(null)
      setUser(null)
      return
    }

    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    setUser(null)
  }, [supabase])

  const forgotPassword = useCallback(
    async (email: string): Promise<AuthResult> => {
      if (!supabase) return { success: false, error: "Supabase is not configured." }

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined

      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) return { success: false, error: error.message }

      return { success: true }
    },
    [supabase]
  )

  const resetPassword = useCallback(
    async (password: string): Promise<AuthResult> => {
      if (!supabase) return { success: false, error: "Supabase is not configured." }

      const { error } = await supabase.auth.updateUser({ password })
      if (error) return { success: false, error: error.message }

      return { success: true }
    },
    [supabase]
  )

  const refreshProfile = useCallback(async (): Promise<void> => {
    if (!supabase) return
    setIsLoading(true)
    try {
      const { data } = await supabase.auth.getSession()
      await syncFromSession(data.session)
    } finally {
      setIsLoading(false)
    }
  }, [supabase, syncFromSession])

  const value: AuthContextType = {
    user,
    profile,
    session,
    isLoading,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export function useRequireAuth(): User | null {
  const { user } = useAuth()
  return user
}

export function getAuthErrorMessage(error: unknown, fallback: string): string {
  return normalizeError(error, fallback)
}
