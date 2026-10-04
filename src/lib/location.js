// Shared constants, GPS helpers and formatting helpers.

// ---------- Photo slots ----------
export const PHOTO_TYPES = [
  { key: 'front', label: 'Front / Exterior', hint: 'Stand back so the whole building fits in the frame.' },
  { key: 'entrance', label: 'Main Entrance', hint: 'The door most people use to go in.' },
  { key: 'surroundings', label: 'Wider Surroundings', hint: 'Paths, landmarks and neighbouring buildings.' },
  { key: 'sign', label: 'Building Sign', hint: 'Any name board or sign on the building.' },
  { key: 'other', label: 'Other', hint: 'Anything else worth recording.' },
]

export const PHOTO_LABELS = Object.fromEntries(PHOTO_TYPES.map((t) => [t.key, t.label]))

// The first photo found in this order becomes the cover image.
export const COVER_PRIORITY = ['front', 'entrance', 'surroundings', 'sign', 'other']

// ---------- GPS quality ----------
export const GOOD_ACCURACY_M = 10
export const FAIR_ACCURACY_M = 25

export function accuracyLevel(meters) {
  if (meters == null) return 'unknown'
  if (meters <= GOOD_ACCURACY_M) return 'good'
  if (meters <= FAIR_ACCURACY_M) return 'fair'
  return 'poor'
}

export function gpsErrorMessage(code) {
  switch (code) {
    case 'DENIED':
      return 'Location permission is blocked. Allow location for this site in your browser settings, then tap Capture GPS again.'
    case 'UNAVAILABLE':
      return 'Your phone could not work out a position. Check that Location is switched on and try again, ideally outdoors.'
    case 'TIMEOUT':
      return 'Timed out waiting for a GPS fix. Move to open sky and try again.'
    case 'INSECURE':
      return 'Location only works on secure (HTTPS) pages. Open the app using its https:// address.'
    case 'UNSUPPORTED':
      return 'This browser does not support location. Try Chrome or Safari.'
    default:
      return 'Something went wrong while reading your location. Please try again.'
  }
}

// Watches the GPS for a few seconds and keeps the most accurate reading.
// Phones usually start with a rough position and improve it, so one quick
// reading is often 30 m or more off. Watching gives better data.
//
// Returns { promise, cancel, finishNow }.
//  - promise resolves with { latitude, longitude, accuracy }
//  - promise rejects with { code } where code is DENIED, UNAVAILABLE, TIMEOUT,
//    INSECURE, UNSUPPORTED or CANCELLED
export function startGpsCapture({ settleMs = 10000, maxWaitMs = 30000, goodEnoughM = 5, onProgress } = {}) {
  let controls = { cancel() {}, finishNow() {} }

  const promise = new Promise((resolve, reject) => {
    if (!window.isSecureContext) return reject({ code: 'INSECURE' })
    if (!('geolocation' in navigator)) return reject({ code: 'UNSUPPORTED' })

    let best = null
    let lastError = null
    let done = false
    let watchId = null
    let settleTimer = null
    const maxTimer = setTimeout(() => finish(), maxWaitMs)

    function cleanup() {
      done = true
      clearTimeout(settleTimer)
      clearTimeout(maxTimer)
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    }

    function finish() {
      if (done) return
      cleanup()
      if (best) resolve(best)
      else reject(lastError || { code: 'TIMEOUT' })
    }

    controls = {
      cancel() {
        if (done) return
        cleanup()
        reject({ code: 'CANCELLED' })
      },
      finishNow: finish,
    }

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (done) return
        const reading = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }
        if (!best || reading.accuracy < best.accuracy) {
          best = reading
          if (onProgress) onProgress(best)
        }
        // Start the countdown from the first real reading, so slow
        // permission prompts do not eat into the sampling time.
        if (!settleTimer) settleTimer = setTimeout(finish, settleMs)
        if (best.accuracy <= goodEnoughM) finish()
      },
      (err) => {
        const code = err.code === 1 ? 'DENIED' : err.code === 2 ? 'UNAVAILABLE' : 'TIMEOUT'
        lastError = { code }
        if (code === 'DENIED') finish()
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    )
  })

  return { promise, cancel: () => controls.cancel(), finishNow: () => controls.finishNow() }
}

// ---------- Formatting ----------
export function formatCoord(n) {
  return Number(n).toFixed(6)
}

export function formatAccuracy(meters) {
  if (meters == null) return 'unknown'
  return `±${Math.round(meters)} m`
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function isToday(iso) {
  return new Date(iso).toDateString() === new Date().toDateString()
}

export function mapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}
