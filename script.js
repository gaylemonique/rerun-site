(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

  // header rule once the page scrolls
  const masthead = document.getElementById("masthead")
  const onScroll = () => masthead && masthead.classList.toggle("scrolled", window.scrollY > 8)
  onScroll()
  window.addEventListener("scroll", onScroll, { passive: true })

  // scroll reveal, staggered within each group
  const groups = [
    ["section:not(.hero) > h2, section:not(.hero) > .label", false],
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
  if ("IntersectionObserver" in window && sections.length) {
    const spy = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + entry.target.id))
      }),
      { rootMargin: "-45% 0px -50% 0px" }
    )
    sections.forEach((s) => spy.observe(s))
  }

  // brief feedback on the download button
  document.querySelectorAll("a.btn[download]").forEach((a) => {
    a.addEventListener("click", () => {
      const original = a.innerHTML
      a.innerHTML = 'Downloading… <span class="arrow" aria-hidden="true">✓</span>'
      setTimeout(() => { a.innerHTML = original }, 2200)
    })
  })

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
