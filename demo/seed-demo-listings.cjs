/* eslint-disable no-console */

const fs = require("node:fs")
const path = require("node:path")

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return

  const content = fs.readFileSync(filePath, "utf8")
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    const index = line.indexOf("=")
    if (index === -1) continue

    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()

    if (!key) continue
    if (value.startsWith("export ")) value = value.slice("export ".length).trim()

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) process.env[key] = value
  }
}

async function main() {
  const root = process.cwd()
  loadDotEnv(path.join(root, ".env.local"))
  loadDotEnv(path.join(root, ".env"))

  const connectionString = process.env.SUPABASE_DB_URL || ""

  if (!connectionString) {
    console.error(
      "Missing database connection string. Set SUPABASE_DB_URL in .env.local."
    )
    process.exitCode = 1
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const postgres = require("postgres")

  const sql = postgres(connectionString, {
    ssl: "require",
    max: 1,
    connect_timeout: 15,
    idle_timeout: 10,
    prepare: false,
    connection: {
      application_name: "kit-lost-and-found-seed",
      statement_timeout: 30_000,
    },
  })

  const supabaseUrlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const supabaseUrl = supabaseUrlRaw ? supabaseUrlRaw.replace(/\/+$/, "") : ""
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  const canUploadToStorage = Boolean(supabaseUrl && serviceRoleKey)

  if (!canUploadToStorage) {
    console.warn(
      "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Seed will continue and store existing image URLs without uploading to Supabase Storage."
    )
  }

  function sanitizeFilename(name) {
    const trimmed = String(name || "").trim() || "upload"
    return trimmed.replace(/[^a-zA-Z0-9._-]/g, "_")
  }

  function encodeStoragePath(objectPath) {
    return objectPath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/")
  }

  function contentTypeFromName(name) {
    const lower = String(name || "").toLowerCase()
    if (lower.endsWith(".png")) return "image/png"
    if (lower.endsWith(".webp")) return "image/webp"
    return "image/jpeg"
  }

  async function uploadLocalImageToStorage({ userId, itemId, publicPath }) {
    const rel = publicPath.replace(/^\//, "")
    const diskPath = path.join(root, "public", rel)
    if (!fs.existsSync(diskPath)) return null

    const filename = sanitizeFilename(path.basename(rel))
    const objectPath = `${userId}/${itemId}/seed-${filename}`
    const encodedPath = encodeStoragePath(objectPath)

    const uploadUrl = `${supabaseUrl}/storage/v1/object/listing-images/${encodedPath}`
    const body = fs.readFileSync(diskPath)

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": contentTypeFromName(filename),
        "x-upsert": "true",
      },
      body,
    })

    if (!response.ok) return null

    return `${supabaseUrl}/storage/v1/object/public/listing-images/${encodedPath}`
  }

  function extensionFromContentType(type) {
    const normalized = String(type || "").toLowerCase()
    if (normalized.includes("png")) return "png"
    if (normalized.includes("webp")) return "webp"
    if (normalized.includes("gif")) return "gif"
    return "jpg"
  }

  async function uploadRemoteImageToStorage({ userId, itemId, url, index }) {
    if (!url) return null

    const response = await fetch(url, { redirect: "follow" })
    if (!response.ok) return null

    const contentType = response.headers.get("content-type") || "image/jpeg"
    const ext = extensionFromContentType(contentType)
    const filename = sanitizeFilename(`seed-remote-${index}.${ext}`)
    const objectPath = `${userId}/${itemId}/${filename}`
    const encodedPath = encodeStoragePath(objectPath)

    const uploadUrl = `${supabaseUrl}/storage/v1/object/listing-images/${encodedPath}`
    const body = Buffer.from(await response.arrayBuffer())

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": contentType,
        "x-upsert": "true",
      },
      body,
    })

    if (!uploadResponse.ok) return null

    return `${supabaseUrl}/storage/v1/object/public/listing-images/${encodedPath}`
  }

  console.log("Seeding demo items into Supabase (public.items)...")

  try {
    const now = new Date()

    const profiles = await sql`
      select user_id, full_name, campus_email, phone, role
      from public.profiles
      order by created_at asc
    `

    if (!Array.isArray(profiles) || profiles.length === 0) {
      console.error(
        "No profile rows found. Register at least one account first so items can be owned by public.profiles.user_id."
      )
      process.exitCode = 1
      return
    }

    const studentProfile =
      profiles.find((profile) => profile.role === "student") ||
      profiles[0]
    const staffProfile =
      profiles.find((profile) => profile.role === "staff" || profile.role === "admin") ||
      studentProfile

    for (const profile of [studentProfile, staffProfile]) {
      const role =
        profile.role === "staff" || profile.role === "admin" || profile.role === "student"
          ? profile.role
          : "student"

      await sql`
        insert into public.users (id, email, name, phone, role, is_banned, created_at, updated_at)
        values (
          ${profile.user_id},
          ${profile.campus_email},
          ${profile.full_name},
          ${profile.phone ?? null},
          ${role},
          false,
          ${now},
          ${now}
        )
        on conflict (id) do update
        set
          email = excluded.email,
          name = excluded.name,
          phone = excluded.phone,
          role = excluded.role,
          updated_at = excluded.updated_at
      `
    }

    const seedItems = [
      {
        type: "lost",
        name: "Black Leather Wallet",
        description:
          "Lost my black leather wallet near the cafeteria. Contains student ID and some cash. Brand: Louis Vuitton (replica).",
        category: "Wallet",
        location: "Cafeteria",
        location_details: "Near the vending machines",
        date_occurred: "2024-01-20T12:30:00Z",
        storage_location: null,
        storage_details: null,
        created_by: studentProfile.user_id,
        photos: ["/wallet-black.jpg"],
      },
      {
        type: "found",
        name: "Blue Backpack",
        description:
          "Found a blue Jansport backpack in the library. Contains some textbooks and a water bottle.",
        category: "Bags",
        location: "Library",
        location_details: "Second floor, study area",
        date_occurred: "2024-01-21T09:00:00Z",
        storage_location: "Security Office",
        storage_details: "Shelf B-3",
        created_by: staffProfile.user_id,
        photos: ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400"],
      },
      {
        type: "found",
        name: "iPhone 14 Pro",
        description: "Found an iPhone 14 Pro in space gray. Lock screen shows a photo of a cat.",
        category: "Electronics",
        location: "Main Building",
        location_details: "Room 102, left on a desk",
        date_occurred: "2024-01-22T14:00:00Z",
        storage_location: "Security Office",
        storage_details: "Locked cabinet",
        created_by: staffProfile.user_id,
        photos: ["https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400"],
      },
      {
        type: "lost",
        name: "Car Keys with KIT Keychain",
        description:
          "Lost my car keys somewhere on campus. Has a blue KIT keychain and Honda key fob.",
        category: "Keys",
        location: "Parking Lot",
        location_details: null,
        date_occurred: "2024-01-23T08:00:00Z",
        storage_location: null,
        storage_details: null,
        created_by: studentProfile.user_id,
        photos: ["/car-keys-kit-keychain.jpg"],
      },
      {
        type: "found",
        name: "Student ID Card",
        description: "Found a student ID card. Name partially visible: 'Sok...'",
        category: "Documents",
        location: "Computer Lab",
        location_details: null,
        date_occurred: "2024-01-23T16:00:00Z",
        storage_location: "Admin Office",
        storage_details: null,
        created_by: staffProfile.user_id,
        photos: ["https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400"],
      },
      {
        type: "lost",
        name: "AirPods Pro Case",
        description: "Lost my AirPods Pro case (white). Might still have the AirPods inside.",
        category: "Electronics",
        location: "Sports Complex",
        location_details: "Basketball court area",
        date_occurred: "2024-01-24T18:00:00Z",
        storage_location: null,
        storage_details: null,
        created_by: studentProfile.user_id,
        photos: ["/airpods-pro-case.jpg"],
      },
    ]

    for (const item of seedItems) {
      const existing =
        await sql`select id from public.items where name = ${item.name} and created_by = ${item.created_by} limit 1`

      const itemId =
        Array.isArray(existing) && existing.length > 0 && existing[0] && existing[0].id
          ? existing[0].id
          : null

      let id = itemId
      if (!id) {
        const inserted = await sql`
          insert into public.items (
            type,
            name,
            description,
            category,
            location,
            location_details,
            date_occurred,
            storage_location,
            storage_details,
            created_by,
            created_at,
            updated_at
          )
          values (
            ${item.type},
            ${item.name},
            ${item.description},
            ${item.category},
            ${item.location},
            ${item.location_details},
            ${new Date(item.date_occurred)},
            ${item.storage_location},
            ${item.storage_details},
            ${item.created_by},
            ${now},
            ${now}
          )
          returning id
        `
        id = inserted[0]?.id
      }

      if (!id) continue

      const finalPhotoUrls = []
      for (const [photoIndex, url] of item.photos.entries()) {
        if (typeof url !== "string" || !url) continue

        if (url.startsWith("/")) {
          if (!canUploadToStorage) {
            finalPhotoUrls.push(url)
            continue
          }

          const uploaded = await uploadLocalImageToStorage({
            userId: item.created_by,
            itemId: id,
            publicPath: url,
          })
          if (!uploaded) {
            throw new Error(
              `Failed to upload local seed image "${url}" to Supabase Storage. Check bucket \"listing-images\" exists and SUPABASE_SERVICE_ROLE_KEY is valid.`
            )
          }
          finalPhotoUrls.push(uploaded)
          continue
        }

        if (url.startsWith("http://") || url.startsWith("https://")) {
          if (!canUploadToStorage) {
            finalPhotoUrls.push(url)
            continue
          }

          const uploaded = await uploadRemoteImageToStorage({
            userId: item.created_by,
            itemId: id,
            url,
            index: photoIndex,
          })
          if (!uploaded) {
            throw new Error(
              `Failed to upload remote seed image "${url}" to Supabase Storage.`
            )
          }
          finalPhotoUrls.push(uploaded)
          continue
        }
      }

      await sql`
        update public.items
        set image_urls = ${finalPhotoUrls}
        where id = ${id}
      `
    }

    console.log("Done. Demo items should now appear in Browse/My Listings.")
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
