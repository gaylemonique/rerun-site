// Records a page view or an APK download tap for the stats page.
// Stores the page, the referring site, the country, and the device and browser
// type. The visitor field is a hash that changes daily, so the IP is never kept.
const { createHash } = require("node:crypto")

const SUPABASE_URL = "https://tiqtsvijliszphhkmhhj.supabase.co"
const SUPABASE_KEY = "sb_publishable_ucrr4xNbQEBHM_WUWWtSYw_zvXCDzeE"

const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|curl|wget|python|node-fetch/i

const deviceOf = (ua) => {
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet"
  if (/Mobi|iPhone|Android/i.test(ua)) return "mobile"
  return "desktop"
}

const browserOf = (ua) => {
  if (/Edg\//.test(ua)) return "Edge"
  if (/OPR\/|Opera/.test(ua)) return "Opera"
  if (/SamsungBrowser/.test(ua)) return "Samsung Internet"
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return "Facebook app"
  if (/Instagram/.test(ua)) return "Instagram app"
  if (/Firefox|FxiOS/.test(ua)) return "Firefox"
  if (/Chrome|CriOS/.test(ua)) return "Chrome"
  if (/Safari/.test(ua)) return "Safari"
  return "Other"
}

const hostOf = (value) => {
  try {
    return new URL(value).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store")
  if (req.method !== "POST") return res.status(405).end()

  const ua = String(req.headers["user-agent"] || "")
  if (!ua || BOTS.test(ua) || !SUPABASE_KEY) return res.status(204).end()

  let body = req.body
  if (typeof body === "string") {
    try { body = JSON.parse(body) } catch { body = {} }
  }
  body = body || {}

  const kind = body.kind === "download" ? "download" : "view"
  const path = typeof body.path === "string" ? body.path.slice(0, 200) : "/"
  const referrer = typeof body.referrer === "string" ? hostOf(body.referrer) : null
  const ownHost = String(req.headers.host || "")

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()
  const day = new Date().toISOString().slice(0, 10)
  const visitor = createHash("sha256")
    .update([process.env.SITE_HASH_SALT || "", day, ip, ua].join("|"))
    .digest("hex")
    .slice(0, 32)

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/rerun_site_track`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_kind: kind,
        event_path: path,
        event_referrer: referrer && referrer !== ownHost ? referrer : null,
        event_country: req.headers["x-vercel-ip-country"] || null,
        event_device: deviceOf(ua),
        event_browser: browserOf(ua),
        event_visitor: visitor,
      }),
    })
  } catch {
    // a missed count isn't worth an error for the visitor
  }

  res.status(204).end()
}
