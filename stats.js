(() => {
  const SUPABASE_URL = "https://tiqtsvijliszphhkmhhj.supabase.co"
  const SUPABASE_KEY = "sb_publishable_ucrr4xNbQEBHM_WUWWtSYw_zvXCDzeE"
  const RELEASES = "https://api.github.com/repos/gaylemonique/rerun-site/releases?per_page=100"

  const $ = (id) => document.getElementById(id)
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  const fmt = new Intl.NumberFormat("en")
  const countryName = (() => {
    try {
      const names = new Intl.DisplayNames(["en"], { type: "region" })
      return (code) => names.of(code) || code
    } catch (e) {
      return (code) => code
    }
  })()

  const METRICS = {
    visitors: "Visitors per day",
    views: "Page views per day",
    downloads: "Download taps per day",
  }

  let days = 30
  let metric = "visitors"
  let stats = null

  const show = (signedIn) => {
    $("login").hidden = signedIn
    $("dash").hidden = !signedIn
    $("sign-out").hidden = !signedIn
  }

  // login: a username is turned into its account email the same way the app does it
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault()
    const form = e.currentTarget
    const button = form.querySelector("button")
    const id = form.id.value.trim()
    const password = form.password.value
    $("login-error").textContent = ""
    if (!id || !password) {
      $("login-error").textContent = "Enter your username or email and your password."
      return
    }
    button.disabled = true
    let email = id
    if (!id.includes("@")) {
      const { data } = await db.rpc("rerun_login_email_for_username", { p_username: id })
      email = data || ""
    }
    const { error } = email
      ? await db.auth.signInWithPassword({ email, password })
      : { error: true }
    button.disabled = false
    if (error) {
      $("login-error").textContent = "That username or password didn't work."
      return
    }
    form.reset()
    show(true)
    load()
  })

  $("sign-out").addEventListener("click", async () => {
    await db.auth.signOut()
    stats = null
    show(false)
  })

  document.querySelectorAll("[data-days]").forEach((b) =>
    b.addEventListener("click", () => {
      days = Number(b.dataset.days)
      document.querySelectorAll("[data-days]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)))
      load()
    })
  )

  document.querySelectorAll("[data-metric]").forEach((b) =>
    b.addEventListener("click", () => {
      metric = b.dataset.metric
      document.querySelectorAll("[data-metric]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)))
      drawChart()
    })
  )

  const load = async () => {
    $("dash-error").textContent = ""
    $("range-label").textContent = `Last ${days} days`
    const { data, error } = await db.rpc("rerun_site_stats", { days })
    if (error) {
      stats = null
      $("dash-error").textContent = error.code === "42501"
        ? "This account can't see the stats."
        : "Couldn't load the stats. Try again in a bit."
      return
    }
    stats = data
    $("t-visitors").textContent = fmt.format(data.totals.visitors)
    $("t-views").textContent = fmt.format(data.totals.views)
    $("t-downloads").textContent = fmt.format(data.totals.downloads)
    fillList("l-pages", data.pages, (n) => (n === "/" || n === "/index.html" ? "Home" : n))
    fillList("l-referrers", data.referrers)
    fillList("l-countries", data.countries, countryName)
    fillList("l-devices", data.devices, (n) => n[0].toUpperCase() + n.slice(1))
    fillList("l-browsers", data.browsers)
    fillTable(data.daily)
    drawChart()
  }

  const fillList = (id, rows, label = (n) => n) => {
    const list = $(id)
    list.innerHTML = ""
    if (!rows.length) {
      const li = document.createElement("li")
      li.className = "none"
      li.textContent = "Nothing yet"
      list.appendChild(li)
      return
    }
    const max = rows[0].count
    rows.forEach((row) => {
      const li = document.createElement("li")
      li.style.setProperty("--w", `${(row.count / max) * 100}%`)
      const name = document.createElement("span")
      name.textContent = label(row.name)
      name.title = row.name
      const count = document.createElement("b")
      count.textContent = fmt.format(row.count)
      li.append(name, count)
      list.appendChild(li)
    })
  }

  const dayLabel = (iso, opts) =>
    new Date(iso + "T00:00:00").toLocaleDateString("en", opts || { month: "short", day: "numeric" })

  const fillTable = (daily) => {
    const body = $("daily-table").querySelector("tbody")
    body.innerHTML = ""
    daily.slice().reverse().forEach((d) => {
      const tr = document.createElement("tr")
      ;[dayLabel(d.day), d.visitors, d.views, d.downloads].forEach((v) => {
        const td = document.createElement("td")
        td.textContent = typeof v === "number" ? fmt.format(v) : v
        tr.appendChild(td)
      })
      body.appendChild(tr)
    })
  }

  // one measure at a time, as bars per day
  const drawChart = () => {
    $("chart-title").textContent = METRICS[metric]
    const box = $("chart")
    const tip = $("tip")
    tip.hidden = true
    if (!stats) return
    const daily = stats.daily
    const values = daily.map((d) => d[metric])
    const width = Math.max(box.clientWidth, 280)
    const height = 220
    const left = 32
    const bottom = 22
    const top = 8
    const plotW = width - left
    const plotH = height - bottom - top
    const peak = Math.max(...values, 0)
    const step = niceStep(peak)
    const ceiling = Math.max(step * Math.ceil(peak / step), step)
    const slot = plotW / daily.length
    const gap = Math.min(2, slot * 0.25)
    const barW = Math.max(slot - gap, 1)
    const y = (v) => top + plotH - (v / ceiling) * plotH
    const ns = "http://www.w3.org/2000/svg"
    const el = (name, attrs, text) => {
      const node = document.createElementNS(ns, name)
      Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v))
      if (text != null) node.textContent = text
      return node
    }

    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `${METRICS[metric]}, last ${days} days` })
    for (let v = 0; v <= ceiling; v += step) {
      svg.appendChild(el("line", { class: "grid-line", x1: left, x2: width, y1: y(v), y2: y(v) }))
      svg.appendChild(el("text", { class: "axis-text", x: left - 8, y: y(v) + 4, "text-anchor": "end" }, fmt.format(v)))
    }

    const labelEvery = Math.ceil(daily.length / Math.max(Math.floor(plotW / 64), 1))
    daily.forEach((d, i) => {
      const x = left + i * slot + gap / 2
      const v = d[metric]
      const h = y(0) - y(v)
      const bar = el("path", { class: "bar", d: roundTop(x, y(0), barW, h, Math.min(4, barW / 2)) })
      const hit = el("rect", { class: "hit", x: left + i * slot, y: top, width: slot, height: plotH })
      hit.addEventListener("mouseenter", () => {
        bar.classList.add("on")
        tip.innerHTML = ""
        const b = document.createElement("b")
        b.textContent = fmt.format(v)
        tip.append(b, ` ${metric === "downloads" ? "download taps" : metric === "views" ? "page views" : "visitors"}`, document.createElement("br"), dayLabel(d.day, { weekday: "short", month: "short", day: "numeric" }))
        tip.hidden = false
        tip.style.left = `${box.offsetLeft + ((x + barW / 2) / width) * box.clientWidth}px`
        tip.style.top = `${box.offsetTop + (Math.min(y(v), y(0) - 4) / height) * box.clientHeight}px`
      })
      hit.addEventListener("mouseleave", () => {
        bar.classList.remove("on")
        tip.hidden = true
      })
      svg.appendChild(bar)
      svg.appendChild(hit)
      const fromEnd = daily.length - 1 - i
      if (fromEnd % labelEvery === 0) {
        svg.appendChild(el("text", { class: "axis-text", x: x + barW / 2, y: height - 4, "text-anchor": "middle" }, dayLabel(d.day)))
      }
    })

    if (peak === 0) {
      svg.appendChild(el("text", { class: "empty", x: left + plotW / 2, y: top + plotH / 2, "text-anchor": "middle" }, "Nothing counted in this range yet"))
    }

    box.innerHTML = ""
    box.appendChild(svg)
  }

  const niceStep = (peak) => {
    if (peak <= 4) return 1
    const raw = peak / 4
    const mag = 10 ** Math.floor(Math.log10(raw))
    const norm = raw / mag
    return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
  }

  // bar with rounded top corners, flat on the baseline
  const roundTop = (x, base, w, h, r) => {
    if (h <= 0) return ""
    r = Math.min(r, h)
    return `M${x},${base}V${base - h + r}Q${x},${base - h} ${x + r},${base - h}H${x + w - r}Q${x + w},${base - h} ${x + w},${base - h + r}V${base}Z`
  }

  const loadReleases = async () => {
    try {
      const res = await fetch(RELEASES)
      if (!res.ok) throw new Error()
      const releases = await res.json()
      const body = $("builds").querySelector("tbody")
      body.innerHTML = ""
      let total = 0
      releases.forEach((r) => {
        const apk = r.assets.find((a) => a.name.endsWith(".apk"))
        const count = apk ? apk.download_count : 0
        total += count
        const tr = document.createElement("tr")
        ;[r.tag_name.replace("build-", "Build "), dayLabel(r.published_at.slice(0, 10), { month: "short", day: "numeric", year: "numeric" }), fmt.format(count)].forEach((v) => {
          const td = document.createElement("td")
          td.textContent = v
          tr.appendChild(td)
        })
        body.appendChild(tr)
      })
      $("t-github").textContent = fmt.format(total)
    } catch (e) {
      $("t-github").textContent = "?"
    }
  }

  let resizeTimer
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(drawChart, 150)
  })

  db.auth.getSession().then(({ data }) => {
    const signedIn = !!data.session
    show(signedIn)
    if (signedIn) {
      load()
    }
  })
  loadReleases()
})()
