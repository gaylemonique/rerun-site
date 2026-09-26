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
    [".shots li", true],
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
})()
