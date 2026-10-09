import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'

import Header from '../components/Header'
import { useApp } from '../context/AppContext'
import {
  createRoad,
  calculateRouteDistance,
} from '../lib/roads'

const DEFAULT_CENTER = [5.0336, 7.9286]
const DEFAULT_ZOOM = 17

const recorderIcon = L.divIcon({
  className: 'road-recorder-marker',
  html: '<span></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

function formatDistance(meters) {
  const value = Number(meters)

  if (!Number.isFinite(value) || value < 0) {
    return '0 m'
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} km`
  }

  return `${Math.round(value)} m`
}

function getCampusCenter(campus) {
  const latitude = Number(campus?.center_lat)
  const longitude = Number(campus?.center_lng)

  if (
    campus?.center_lat != null &&
    campus?.center_lng != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  ) {
    return [latitude, longitude]
  }

  return DEFAULT_CENTER
}

export default function RoadMapper() {
  const navigate = useNavigate()
  const { currentCampus } = useApp()

  const mapElementRef = useRef(null)
  const mapRef = useRef(null)
  const routeLineRef = useRef(null)
  const currentMarkerRef = useRef(null)
  const watchIdRef = useRef(null)
  const pointsRef = useRef([])

  const recordingRef = useRef(false)
  const pausedRef = useRef(false)
  const gpsCenteredRef = useRef(false)

  const [points, setPoints] = useState([])
  const [distance, setDistance] = useState(0)
  const [recording, setRecording] = useState(false)
  const [paused, setPaused] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [gpsStatus, setGpsStatus] = useState('Ready to record')

  const [form, setForm] = useState({
    name: '',
    roadType: 'Road',
    description: '',
    fieldNotes: '',
  })

  const stopGpsWatch = useCallback(() => {
    if (
      watchIdRef.current !== null &&
      typeof navigator !== 'undefined' &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }

    watchIdRef.current = null
  }, [])

  // Initialize Leaflet once for this page instance.
  useEffect(() => {
    const element = mapElementRef.current

    if (!element || mapRef.current) {
      return undefined
    }

    let map

    try {
      map = L.map(element, {
        zoomControl: false,
        attributionControl: true,
      }).setView(getCampusCenter(currentCampus), DEFAULT_ZOOM)

      mapRef.current = map

      L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }
      ).addTo(map)

      routeLineRef.current = L.polyline([], {
        color: '#F45B2A',
        weight: 6,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map)

      L.control.zoom({
        position: 'bottomright',
      }).addTo(map)

      requestAnimationFrame(() => {
        if (mapRef.current === map) {
          map.invalidateSize()
        }
      })
    } catch (err) {
      console.error('Road Mapper map initialization failed:', err)

      if (map) {
        map.remove()
      }

      mapRef.current = null
      routeLineRef.current = null

      setError(
        'The map could not be initialized. Check your connection and reload the page.'
      )
    }

    return () => {
      stopGpsWatch()

      recordingRef.current = false
      pausedRef.current = false

      if (mapRef.current) {
        mapRef.current.remove()
      }

      mapRef.current = null
      routeLineRef.current = null
      currentMarkerRef.current = null
      gpsCenteredRef.current = false
    }
  }, [stopGpsWatch])

  // Update the map when the selected campus changes.
  useEffect(() => {
    const map = mapRef.current

    if (!map || gpsCenteredRef.current) {
      return
    }

    map.setView(getCampusCenter(currentCampus), DEFAULT_ZOOM)
  }, [
    currentCampus?.id,
    currentCampus?.center_lat,
    currentCampus?.center_lng,
  ])

  const handleGpsPosition = useCallback((position) => {
    const latitude = Number(position.coords.latitude)
    const longitude = Number(position.coords.longitude)
    const accuracy = Number(position.coords.accuracy)

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return
    }

    const location = [latitude, longitude]
    const map = mapRef.current

    if (!map) {
      return
    }

    if (!currentMarkerRef.current) {
      currentMarkerRef.current = L.marker(location, {
        icon: recorderIcon,
        zIndexOffset: 1000,
      }).addTo(map)

      currentMarkerRef.current.bindTooltip('Current location', {
        direction: 'top',
        offset: [0, -10],
      })
    } else {
      currentMarkerRef.current.setLatLng(location)
    }

    if (!gpsCenteredRef.current) {
      map.setView(location, 18)
      gpsCenteredRef.current = true
    }

    if (Number.isFinite(accuracy)) {
      const roundedAccuracy = Math.round(accuracy)

      if (accuracy <= 10) {
        setGpsStatus(`GPS excellent • ${roundedAccuracy} m`)
      } else if (accuracy <= 25) {
        setGpsStatus(`GPS good • ${roundedAccuracy} m`)
      } else if (accuracy <= 50) {
        setGpsStatus(`GPS fair • ${roundedAccuracy} m`)
      } else {
        setGpsStatus(`GPS weak • ${roundedAccuracy} m`)
      }
    }

    if (!recordingRef.current || pausedRef.current) {
      return
    }

    // Avoid recording GPS fixes with poor accuracy.
    if (!Number.isFinite(accuracy) || accuracy > 50) {
      return
    }

    const previous = pointsRef.current[pointsRef.current.length - 1]

    if (previous) {
      const movement = calculateRouteDistance([
        previous,
        location,
      ])

      // Ignore GPS jitter and very small movements.
      if (movement < 2) {
        return
      }
    }

    const nextPoints = [...pointsRef.current, location]

    pointsRef.current = nextPoints
    setPoints(nextPoints)
    setDistance(calculateRouteDistance(nextPoints))

    if (routeLineRef.current) {
      routeLineRef.current.setLatLngs(nextPoints)
    }
  }, [])

  const handleGpsError = useCallback((geoError) => {
    // Prevent a failed GPS watch from blocking future attempts.
    stopGpsWatch()

    recordingRef.current = false
    pausedRef.current = false

    setRecording(false)
    setPaused(false)

    if (geoError.code === 1) {
      setGpsStatus('GPS permission denied')
      setError(
        'Location permission was denied. Allow location access in your browser settings.'
      )
    } else if (geoError.code === 2) {
      setGpsStatus('GPS unavailable')
      setError(
        'Your location could not be detected. Check your device location settings.'
      )
    } else if (geoError.code === 3) {
      setGpsStatus('GPS timed out')
      setError(
        'GPS took too long to respond. Move to an open area and try again.'
      )
    } else {
      setGpsStatus('GPS error')
      setError('Could not read your GPS location.')
    }
  }, [stopGpsWatch])

  const startGpsWatch = useCallback(() => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.geolocation
    ) {
      setError('Your browser does not support GPS location.')
      setGpsStatus('GPS not supported')
      return false
    }

    if (watchIdRef.current !== null) {
      return true
    }

    setError('')
    setGpsStatus('Waiting for GPS...')

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleGpsPosition,
        handleGpsError,
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 20000,
        }
      )

      return true
    } catch (err) {
      console.error('Could not start GPS tracking:', err)

      watchIdRef.current = null
      setGpsStatus('GPS error')
      setError('Could not start GPS tracking. Please try again.')

      return false
    }
  }, [handleGpsPosition, handleGpsError])

  function startRecording() {
    setError('')

    if (!currentCampus) {
      setError('Please select a campus before recording a road.')
      return
    }

    if (!startGpsWatch()) {
      return
    }

    recordingRef.current = true
    pausedRef.current = false

    setRecording(true)
    setPaused(false)
    setGpsStatus('Recording road...')
  }

  function pauseRecording() {
    pausedRef.current = true

    setPaused(true)
    setGpsStatus('Recording paused')
  }

  function resumeRecording() {
    setError('')

    if (!currentCampus) {
      setError('Please select a campus before recording a road.')
      return
    }

    if (!startGpsWatch()) {
      return
    }

    recordingRef.current = true
    pausedRef.current = false

    setRecording(true)
    setPaused(false)
    setGpsStatus('Recording road...')
  }

  function stopRecording() {
    recordingRef.current = false
    pausedRef.current = false

    setRecording(false)
    setPaused(false)

    stopGpsWatch()

    setGpsStatus(
      pointsRef.current.length >= 2
        ? 'Route ready to save'
        : 'Recording stopped'
    )
  }

  function clearRecording() {
    recordingRef.current = false
    pausedRef.current = false

    stopGpsWatch()

    setRecording(false)
    setPaused(false)

    pointsRef.current = []
    gpsCenteredRef.current = false

    setPoints([])
    setDistance(0)
    setError('')
    setGpsStatus('Ready to record')

    setForm({
      name: '',
      roadType: 'Road',
      description: '',
      fieldNotes: '',
    })

    if (routeLineRef.current) {
      routeLineRef.current.setLatLngs([])
    }

    if (currentMarkerRef.current) {
      currentMarkerRef.current.remove()
      currentMarkerRef.current = null
    }

    if (mapRef.current) {
      mapRef.current.setView(
        getCampusCenter(currentCampus),
        DEFAULT_ZOOM
      )
    }
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function saveRoad() {
    setError('')

    if (recordingRef.current) {
      setError('Stop recording before saving the road.')
      return
    }

    if (!currentCampus) {
      setError('No campus selected.')
      return
    }

    const routePoints = pointsRef.current

    if (routePoints.length < 2) {
      setError('Record at least two GPS points before saving.')
      return
    }

    if (!form.name.trim()) {
      setError('Please enter a road name.')
      return
    }

    setSaving(true)

    try {
      await createRoad({
        campusId: currentCampus.id,
        name: form.name.trim(),
        roadType: form.roadType,
        description: form.description.trim(),
        fieldNotes: form.fieldNotes.trim(),
        distanceMeters: calculateRouteDistance(routePoints),
        geometry: routePoints,
      })

      // Open the saved-roads list after a successful save.
      navigate('/saved-roads')
    } catch (err) {
      console.error('Could not save road:', err)

      setError(
        err?.message || 'Could not save this road. Please try again.'
      )
    } finally {
      setSaving(false)
    }
  }

  const canSave =
    points.length >= 2 &&
    form.name.trim().length > 0 &&
    !recording &&
    !saving

  return (
    <>
      <Header title="Road Mapper" backTo="/map" />

      <main className="road-recorder">
        <section className="road-map-card">
          <div
            ref={mapElementRef}
            className="road-map"
            aria-label="Road recording map"
          />

          <div className="road-campus-badge">
            <span>📍</span>

            <div>
              <small>Recording for</small>
              <strong>
                {currentCampus?.name || 'No campus selected'}
              </strong>
            </div>
          </div>

          <div className="road-gps-status" role="status">
            <span className="cm-live-dot" />
            {gpsStatus}
          </div>
        </section>

        <section className="road-stats">
          <div>
            <strong>{formatDistance(distance)}</strong>
            <span>Distance recorded</span>
          </div>

          <div>
            <strong>{points.length}</strong>
            <span>GPS points</span>
          </div>

          <div>
            <strong>
              {recording
                ? paused
                  ? 'Paused'
                  : 'Live'
                : 'Stopped'}
            </strong>
            <span>Status</span>
          </div>
        </section>

        <section className="road-controls">
          {!recording && points.length === 0 && (
            <button
              type="button"
              className="road-primary-button"
              onClick={startRecording}
              disabled={!currentCampus || saving}
            >
              📍 Start Recording
            </button>
          )}

          {recording && !paused && (
            <>
              <button
                type="button"
                className="road-secondary-button"
                onClick={pauseRecording}
              >
                ⏸ Pause
              </button>

              <button
                type="button"
                className="road-danger-button"
                onClick={stopRecording}
              >
                ■ Stop
              </button>
            </>
          )}

          {recording && paused && (
            <>
              <button
                type="button"
                className="road-primary-button"
                onClick={resumeRecording}
              >
                ▶ Resume
              </button>

              <button
                type="button"
                className="road-danger-button"
                onClick={stopRecording}
              >
                ■ Stop
              </button>
            </>
          )}

          {!recording && points.length > 0 && (
            <>
              <button
                type="button"
                className="road-primary-button"
                onClick={resumeRecording}
                disabled={saving}
              >
                ▶ Continue
              </button>

              <button
                type="button"
                className="road-danger-button"
                onClick={clearRecording}
                disabled={saving}
              >
                🗑 Clear
              </button>
            </>
          )}
        </section>

        {error && (
          <div className="road-error" role="alert">
            <strong>Road Mapper</strong>
            <span>{error}</span>
          </div>
        )}

        {points.length >= 2 && !recording && (
          <section className="road-form">
            <div className="road-form-heading">
              <div>
                <small>Route recorded</small>
                <h2>Save this road</h2>
              </div>

              <span>{formatDistance(distance)}</span>
            </div>

            <label>
              <span>Road name *</span>

              <input
                type="text"
                value={form.name}
                onChange={(event) =>
                  updateForm('name', event.target.value)
                }
                placeholder="e.g. Main Campus Road"
                required
                maxLength={150}
              />
            </label>

            <label>
              <span>Road type</span>

              <select
                value={form.roadType}
                onChange={(event) =>
                  updateForm('roadType', event.target.value)
                }
              >
                <option value="Road">Road</option>
                <option value="Walkway">Walkway</option>
                <option value="Path">Footpath</option>
                <option value="Driveway">Driveway</option>
                <option value="Parking">Parking route</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <label>
              <span>Description</span>

              <textarea
                value={form.description}
                onChange={(event) =>
                  updateForm('description', event.target.value)
                }
                placeholder="Describe where this road leads."
                rows={3}
              />
            </label>

            <label>
              <span>Field notes</span>

              <textarea
                value={form.fieldNotes}
                onChange={(event) =>
                  updateForm('fieldNotes', event.target.value)
                }
                placeholder="Add useful notes from the field."
                rows={3}
              />
            </label>

            <div className="road-save-actions">
              <button
                type="button"
                className="road-save-button"
                onClick={saveRoad}
                disabled={!canSave}
              >
                {saving ? 'Saving road...' : '💾 Save Road'}
              </button>

              <button
                type="button"
                className="road-cancel-button"
                onClick={clearRecording}
                disabled={saving}
              >
                Discard
              </button>
            </div>
          </section>
        )}

        <section className="road-help">
          <strong>🛣️ How Road Mapper works</strong>

          <p>
            Walk along the campus road while CampusMapper records
            your GPS path. Stop when you reach the end, then save
            the road with its name and notes. Good GPS accuracy
            helps produce a more reliable route.
          </p>

          <div>
            <span>1</span>
            <span>Start recording</span>
            <span>→</span>
            <span>2</span>
            <span>Follow the road</span>
            <span>→</span>
            <span>3</span>
            <span>Stop &amp; save</span>
          </div>
        </section>
      </main>
    </>
  )
}