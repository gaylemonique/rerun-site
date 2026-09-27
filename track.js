// Counts this page view and APK download taps for the owner's stats page.
(() => {
  if (navigator.globalPrivacyControl) return

  const send = (kind) => {
    const body = JSON.stringify({ kind, path: location.pathname, referrer: document.referrer })
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }))
    } else {
      fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {})
    }
  }

  send("view")
  document.addEventListener("click", (e) => {
    const link = e.target.closest && e.target.closest('a[href$="Rerun.apk"]')
    if (link) send("download")
  })
})()
