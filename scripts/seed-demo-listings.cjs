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

  const connectionString =
    process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || ""

  if (!connectionString) {
    console.error(
      "Missing database connection string. Set SUPABASE_DB_URL, DATABASE_URL, or POSTGRES_URL in .env.local."
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

  const seedUsers = [
    {
      id: "ede8d1b1-2ff1-40fd-b87a-3de286a10d24",
      email: "student@kit.edu.kh",
      name: "Sovann Chan",
      phone: "+855 12 345 678",
      role: "student",
    },
    {
      id: "53285713-6e0d-4140-a889-cc579659da81",
      email: "security@kit.edu.kh",
      name: "Dara Kim",
      phone: "+855 12 987 654",
      role: "staff",
    },
    {
      id: "60183042-5c3a-49cb-8ef9-79c7ce0754a6",
      email: "admin@kit.edu.kh",
      name: "Bopha Pich",
      phone: null,
      role: "admin",
    },
  ]

  const seedListings = [
    {
      type: "lost",
      title: "Black Leather Wallet",
      description:
        "Lost my black leather wallet near the cafeteria. Contains student ID and some cash. Brand: Louis Vuitton (replica).",
      category: "Wallet",
      location: "Cafeteria",
      location_details: "Near the vending machines",
      date_occurred: "2024-01-20T12:30:00Z",
      status: "active",
      storage_location: null,
      storage_details: null,
      user_id: seedUsers[0].id,
      photos: ["/wallet-black.jpg"],
    },
    {
      type: "found",
      title: "Blue Backpack",
      description:
        "Found a blue Jansport backpack in the library. Contains some textbooks and a water bottle.",
      category: "Bags",
      location: "Library",
      location_details: "Second floor, study area",
      date_occurred: "2024-01-21T09:00:00Z",
      status: "active",
      storage_location: "Security Office",
      storage_details: "Shelf B-3",
      user_id: seedUsers[1].id,
      photos: ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400"],
    },
    {
      type: "found",
      title: "iPhone 14 Pro",
      description: "Found an iPhone 14 Pro in space gray. Lock screen shows a photo of a cat.",
      category: "Electronics",
      location: "Main Building",
      location_details: "Room 102, left on a desk",
      date_occurred: "2024-01-22T14:00:00Z",
      status: "active",
      storage_location: "Security Office",
      storage_details: "Locked cabinet",
      user_id: seedUsers[1].id,
      photos: ["https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400"],
    },
    {
      type: "lost",
      title: "Car Keys with KIT Keychain",
      description:
        "Lost my car keys somewhere on campus. Has a blue KIT keychain and Honda key fob.",
      category: "Keys",
      location: "Parking Lot",
      location_details: null,
      date_occurred: "2024-01-23T08:00:00Z",
      status: "active",
      storage_location: null,
      storage_details: null,
      user_id: seedUsers[0].id,
      photos: ["/car-keys-kit-keychain.jpg"],
    },
    {
      type: "found",
      title: "Student ID Card",
      description: "Found a student ID card. Name partially visible: 'Sok...'",
      category: "Documents",
      location: "Computer Lab",
      location_details: null,
      date_occurred: "2024-01-23T16:00:00Z",
      status: "matched",
      storage_location: "Admin Office",
      storage_details: null,
      user_id: seedUsers[1].id,
      photos: ["https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400"],
    },
    {
      type: "lost",
      title: "AirPods Pro Case",
      description: "Lost my AirPods Pro case (white). Might still have the AirPods inside.",
      category: "Electronics",
      location: "Sports Complex",
      location_details: "Basketball court area",
      date_occurred: "2024-01-24T18:00:00Z",
      status: "active",
      storage_location: null,
      storage_details: null,
      user_id: seedUsers[0].id,
      photos: ["/airpods-pro-case.jpg"],
    },
  ]

  const supabaseUrlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const supabaseUrl = supabaseUrlRaw ? supabaseUrlRaw.replace(/\/+$/, "") : ""
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

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

  async function uploadLocalImageToStorage({ userId, listingId, publicPath }) {
    if (!supabaseUrl || !serviceRoleKey) return null

    const rel = publicPath.replace(/^\//, "")
    const diskPath = path.join(root, "public", rel)
    if (!fs.existsSync(diskPath)) return null

    const filename = sanitizeFilename(path.basename(rel))
    const objectPath = `${userId}/${listingId}/seed-${filename}`
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

  console.log("Seeding demo users + listings into Supabase (public.users/public.listings/public.photos)...")

  try {
    const now = new Date()

    for (const user of seedUsers) {
      await sql`
        insert into public.users (id, email, name, phone, role, is_banned, created_at, updated_at)
        values (${user.id}, ${user.email}, ${user.name}, ${user.phone}, ${user.role}, false, ${now}, ${now})
        on conflict (id) do nothing
      `
    }

    for (const listing of seedListings) {
      const existing =
        await sql`select id from public.listings where title = ${listing.title} and user_id = ${listing.user_id} limit 1`

      const listingId =
        Array.isArray(existing) && existing.length > 0 && existing[0] && existing[0].id
          ? existing[0].id
          : null

      let id = listingId
      if (!id) {
        const inserted = await sql`
          insert into public.listings (
            type, title, description, category, location, location_details,
            date_occurred, status, storage_location, storage_details, user_id,
            created_at, updated_at
          )
          values (
            ${listing.type},
            ${listing.title},
            ${listing.description},
            ${listing.category},
            ${listing.location},
            ${listing.location_details},
            ${new Date(listing.date_occurred)},
            ${listing.status},
            ${listing.storage_location},
            ${listing.storage_details},
            ${listing.user_id},
            ${now},
            ${now}
          )
          returning id
        `
        id = inserted[0]?.id
      }

      if (!id) continue

      const finalPhotoUrls = []
      for (const url of listing.photos) {
        if (typeof url !== "string" || !url) continue

        if (url.startsWith("/")) {
          const uploaded = await uploadLocalImageToStorage({
            userId: listing.user_id,
            listingId: id,
            publicPath: url,
          })
          finalPhotoUrls.push(uploaded || url)
          continue
        }

        finalPhotoUrls.push(url)
      }

      await sql`
        update public.listings
        set image_urls = ${finalPhotoUrls}
        where id = ${id}
      `

      for (const url of finalPhotoUrls) {
        const photoExists =
          await sql`select id from public.photos where listing_id = ${id} and url = ${url} limit 1`
        if (Array.isArray(photoExists) && photoExists.length > 0) continue

        await sql`
          insert into public.photos (url, listing_id, created_at)
          values (${url}, ${id}, ${now})
        `
      }
    }

    console.log("Done. Demo listings should now appear in Browse/My Listings.")
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
