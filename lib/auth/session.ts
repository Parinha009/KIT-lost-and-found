import type { Session, SupabaseClient } from "@supabase/supabase-js"
import type { Profile, User, UserRole } from "@/lib/types"

const PROFILE_COLUMNS = "user_id, full_name, campus_email, phone, role, created_at"

type ProfileRow = {
  user_id: string
  full_name: string
  campus_email: string
  phone: string | null
  role: UserRole
  created_at: string
}

function isUserRole(value: string): value is UserRole {
  return value === "student" || value === "staff" || value === "admin"
}

function normalizeRole(value: string | undefined | null): UserRole {
  if (!value) return "student"
  return isUserRole(value) ? value : "student"
}

export function mapProfileRow(row: ProfileRow): Profile {
  return {
    user_id: row.user_id,
    full_name: row.full_name,
    campus_email: row.campus_email,
    phone: row.phone || undefined,
    role: normalizeRole(row.role),
    created_at: row.created_at,
  }
}

export async function getProfileByUserId(
  client: SupabaseClient,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle<ProfileRow>()

  if (error || !data) return null
  return mapProfileRow(data)
}

export function mapSessionToUser(session: Session, profile: Profile | null): User {
  const authUser = session.user
  const fallbackEmail = authUser.email || profile?.campus_email || ""
  const fallbackName = fallbackEmail ? fallbackEmail.split("@")[0] : "KIT User"
  const metadataName = (() => {
    const value = authUser.user_metadata?.full_name
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
  })()

  return {
    id: authUser.id,
    email: profile?.campus_email || fallbackEmail,
    name: profile?.full_name || metadataName || fallbackName,
    phone: profile?.phone,
    role: profile?.role || "student",
    avatar_url:
      typeof authUser.user_metadata?.avatar_url === "string"
        ? authUser.user_metadata.avatar_url
        : undefined,
    is_banned: false,
    created_at: profile?.created_at || authUser.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export async function getSessionProfileAndUser(client: SupabaseClient): Promise<{
  session: Session | null
  profile: Profile | null
  user: User | null
}> {
  const { data } = await client.auth.getSession()
  const session = data.session

  if (!session) {
    return { session: null, profile: null, user: null }
  }

  const profile = await getProfileByUserId(client, session.user.id)
  return {
    session,
    profile,
    user: mapSessionToUser(session, profile),
  }
}

