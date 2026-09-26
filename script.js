(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const stackOn = !reduce

  // header rule once the page scrolls
  const masthead = document.getElementById("masthead")
  const onScroll = () => masthead && masthead.classList.toggle("scrolled", window.scrollY > 8)
  onScroll()
  window.addEventListener("scroll", onScroll, { passive: true })

  // scroll reveal, staggered within each group
  const groups = [
    ["section:not(.hero) > h2, section:not(.hero) > .label, .screens-head", false],
    [".carousel", false],
    [".cards li", true],
    [".steps li", true],
    [".note", false],
    [".about > aside, .about > div", true],
  ]
  const targets = []
  groups.forEach(([selector, stagger]) => {
    document.querySelectorAll(selector).forEach((el, i) => {
      el.setAttribute("data-reveal", "")
      if (stagger) el.style.setProperty("--i", i)
      targets.push(el)
    })
  })

  if (reduce || !("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("in"))
  } else {
    const reveal = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add("in")
        reveal.unobserve(entry.target)
      }),
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    )
    targets.forEach((el) => reveal.observe(el))
  }

  // highlight the nav link for the section in view
  const links = [...document.querySelectorAll("nav a[href^='#']")]
  const sections = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean)
  if (!stackOn && "IntersectionObserver" in window && sections.length) {
    const spy = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + entry.target.id))
      }),
      { rootMargin: "-45% 0px -50% 0px" }
    )
    sections.forEach((s) => spy.observe(s))
  }

  // iPhone and iPad visitors can't install an APK, so point them at the iPhone steps
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  if (isIOS) {
    const ios = document.getElementById("ios")
    if (ios) ios.open = true
    const apk = document.querySelector(".hero a.btn.primary[download]")
    if (apk) {
      apk.removeAttribute("download")
      apk.setAttribute("href", "#install")
      apk.innerHTML = 'Use on iPhone <span class="arrow" aria-hidden="true">↓</span>'
    }
    const meta = document.querySelector(".hero .meta")
    if (meta) meta.textContent = "The Android app can't be installed on iPhone. Open the web app instead."
  }

  // stacked pages: each section sticks and the next one slides over it
  if (stackOn) {
    const main = document.getElementById("top")
    const pages = [...main.children].filter((el) => el.tagName === "SECTION")
    document.documentElement.classList.add("stacked")
    pages.forEach((p, i) => { p.style.zIndex = String(i + 1) })

    const naturalTops = () => {
      let y = main.offsetTop
      return pages.map((p) => { const top = y; y += p.offsetHeight; return top })
    }

    // a page taller than the screen sticks once its bottom is reached
    const measure = () => {
      const vh = window.innerHeight
      pages.forEach((p) => { p.style.top = Math.min(0, vh - p.offsetHeight) + "px" })
    }

    let ticking = false
    const update = () => {
      ticking = false
      const vh = window.innerHeight
      pages.forEach((p, i) => {
        const next = pages[i + 1]
        const cover = next ? Math.min(1, Math.max(0, (vh - next.getBoundingClientRect().top) / vh)) : 0
        p.style.setProperty("--cover", cover.toFixed(3))
      })
      const tops = naturalTops()
      const probe = window.scrollY + vh * 0.4
      let current = 0
      tops.forEach((t, i) => { if (probe >= t) current = i })
      links.forEach((a) => {
        const target = document.querySelector(a.getAttribute("href"))
        a.classList.toggle("active", target === pages[current])
      })
    }
    const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(update) } }

    const goTo = (target) => {
      if (target === main) { window.scrollTo({ top: 0, behavior: "smooth" }); return }
      const i = pages.indexOf(target)
      if (i < 0) return
      window.scrollTo({ top: naturalTops()[i], behavior: "smooth" })
    }

    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const target = document.querySelector(a.getAttribute("href"))
        if (!target) return
        e.preventDefault()
        goTo(target)
      })
    })

    const remeasure = () => { measure(); request() }
    window.addEventListener("scroll", request, { passive: true })
    window.addEventListener("resize", remeasure)
    window.addEventListener("load", remeasure)
    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(remeasure)
      pages.forEach((p) => ro.observe(p))
    }
    measure()
    update()

    // open on the first page unless the link points at a section
    if ("scrollRestoration" in history) history.scrollRestoration = "manual"
    let touched = false
    ;["wheel", "touchstart", "keydown"].forEach((type) =>
      window.addEventListener(type, () => { touched = true }, { once: true, passive: true })
    )
    // a saved address ending in #about should not skip the top; only links from this site keep their hash
    let fromThisSite = false
    try { fromThisSite = !!document.referrer && new URL(document.referrer).origin === location.origin } catch (e) {}
    if (location.hash && !fromThisSite) history.replaceState(null, "", location.pathname + location.search)

    const openAt = () => {
      const target = location.hash ? document.querySelector(location.hash) : null
      const i = target ? pages.indexOf(target) : -1
      window.scrollTo({ top: i > 0 ? naturalTops()[i] : 0, behavior: "instant" })
    }
    openAt()
    window.addEventListener("load", () => { if (!touched) openAt() }, { once: true })
  }

  // brief feedback on the download button
  document.querySelectorAll("a.btn[download]").forEach((a) => {
    a.addEventListener("click", () => {
      const original = a.innerHTML
      a.innerHTML = 'Downloading… <span class="arrow" aria-hidden="true">✓</span>'
      setTimeout(() => { a.innerHTML = original }, 2200)
    })
  })

  // dark / light screenshots: a slide switches when its img has a data-light source
  const modeButtons = [...document.querySelectorAll(".mode button")]
  const shotImgs = [...document.querySelectorAll(".shots img")]
  if (modeButtons.length && shotImgs.length) {
    shotImgs.forEach((img) => { img.dataset.dark = img.getAttribute("src") })
    const hasLight = shotImgs.every((img) => img.dataset.light)
    const light = modeButtons.find((b) => b.dataset.mode === "light")
    if (!hasLight && light) {
      light.disabled = true
      light.title = "Light mode screenshots are coming soon"
    }
    modeButtons.forEach((b) => b.addEventListener("click", () => {
      const mode = b.dataset.mode
      modeButtons.forEach((x) => x.setAttribute("aria-pressed", String(x === b)))
      shotImgs.forEach((img) => { img.src = img.dataset[mode] || img.dataset.dark })
    }))
  }

  // screenshot carousel
  const track = document.querySelector(".shots")
  if (track) {
    const slides = [...track.children]
    const dotsWrap = document.querySelector(".dots")
    const INTERVAL = 2800
    let index = 0
    let timer = null
    let userPaused = false
    let hovering = false
    let inView = true
    let settle = null

    track.style.setProperty("--interval", INTERVAL + "ms")

    const dots = slides.map(() => {
      const d = document.createElement("span")
      d.className = "dot"
      dotsWrap.appendChild(d)
      return d
    })

    const running = () => !reduce && !userPaused && !hovering && inView && !document.hidden

    const paint = () => {
      slides.forEach((s, i) => s.classList.toggle("is-active", i === index))
      dots.forEach((d, i) => {
        d.classList.toggle("on", i === index)
        d.classList.remove("playing")
      })
      // restart the progress animation on the active dot
      void dotsWrap.offsetWidth
      if (running()) dots[index].classList.add("playing")
    }

    const goTo = (i, behavior) => {
      index = (i + slides.length) % slides.length
      const s = slides[index]
      const left = s.offsetLeft - (track.clientWidth - s.clientWidth) / 2
      track.scrollTo({ left, behavior: behavior || (reduce ? "auto" : "smooth") })
      paint()
    }

    const stop = () => { clearInterval(timer); timer = null; dots[index].classList.remove("playing") }
    const start = () => {
      stop()
      if (!running()) return
      dots[index].classList.add("playing")
      timer = setInterval(() => goTo(index + 1), INTERVAL)
    }
    const restart = () => { stop(); paint(); start() }

    // keep the active slide in sync with manual swipes and scrolling
    track.addEventListener("scroll", () => {
      clearTimeout(settle)
      settle = setTimeout(() => {
        const center = track.scrollLeft + track.clientWidth / 2
        let best = 0
        let bestDist = Infinity
        slides.forEach((s, i) => {
          const dist = Math.abs(s.offsetLeft + s.clientWidth / 2 - center)
          if (dist < bestDist) { bestDist = dist; best = i }
        })
        if (best !== index) { index = best; restart() }
      }, 80)
    }, { passive: true })

    track.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(index + 1); restart() }
      if (e.key === "ArrowLeft") { e.preventDefault(); goTo(index - 1); restart() }
    })

    if (reduce) userPaused = true

    const box = track.closest(".carousel")
    box.addEventListener("mouseenter", () => { hovering = true; restart() })
    box.addEventListener("mouseleave", () => { hovering = false; restart() })
    box.addEventListener("focusin", () => { hovering = true; restart() })
    box.addEventListener("focusout", () => { hovering = false; restart() })
    box.addEventListener("touchstart", () => { hovering = true; stop() }, { passive: true })
    box.addEventListener("touchend", () => { setTimeout(() => { hovering = false; restart() }, 2500) }, { passive: true })
    document.addEventListener("visibilitychange", restart)

    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        inView = entries[0].isIntersecting
        restart()
      }, { threshold: 0.1 }).observe(box)
    }

    window.addEventListener("resize", () => goTo(index, "auto"))
    goTo(0, "auto")
    start()
  }
})()
