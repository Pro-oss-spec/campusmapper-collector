import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'

import Header from '../components/Header'
import { useApp } from '../context/AppContext'
import {
  createRoad,
  calculateRouteDistance,
} from '../lib/roads'

const recorderIcon = L.divIcon({
  className: 'road-recorder-marker',
  html: '<span></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

function formatDistance(meters) {
  if (!Number.isFinite(Number(meters))) {
    return '0 m'
  }

  const value = Number(meters)

  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} km`
  }

  return `${Math.round(value)} m`
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

  const [points, setPoints] = useState([])
  const [distance, setDistance] = useState(0)

  const [recording, setRecording] = useState(false)
  const [paused, setPaused] = useState(false)

  const [saving, setSaving] = useState(false)

  const [error, setError] = useState('')
  const [gpsStatus, setGpsStatus] = useState(
    'Ready to record'
  )

  const [form, setForm] = useState({
    name: '',
    roadType: 'Road',
    description: '',
    fieldNotes: '',
  })

  /*
   * CREATE MAP
   */
  useEffect(() => {
    if (
      !mapElementRef.current ||
      mapRef.current
    ) {
      return
    }

    const latitude = Number(
      currentCampus?.center_lat
    )

    const longitude = Number(
      currentCampus?.center_lng
    )

    const center =
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
        ? [latitude, longitude]
        : [5.0336, 7.9286]

    const map = L.map(
      mapElementRef.current,
      {
        zoomControl: false,
        attributionControl: true,
      }
    ).setView(center, 17)

    const street = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution:
          '&copy; OpenStreetMap contributors',
      }
    )

    street.addTo(map)

    routeLineRef.current =
      L.polyline([], {
        color: '#F45B2A',
        weight: 6,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map)

    mapRef.current = map

    L.control
      .zoom({
        position: 'bottomright',
      })
      .addTo(map)

    setTimeout(() => {
      map.invalidateSize()
    }, 150)

    return () => {
      if (
        watchIdRef.current !== null &&
        navigator.geolocation
      ) {
        navigator.geolocation.clearWatch(
          watchIdRef.current
        )
      }

      watchIdRef.current = null

      map.remove()

      mapRef.current = null
      routeLineRef.current = null
      currentMarkerRef.current = null
    }
  }, [])

  /*
   * CHANGE MAP CENTER WHEN CAMPUS CHANGES
   */
  useEffect(() => {
    const map = mapRef.current

    if (
      !map ||
      !currentCampus
    ) {
      return
    }

    const latitude = Number(
      currentCampus.center_lat
    )

    const longitude = Number(
      currentCampus.center_lng
    )

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return
    }

    map.setView(
      [latitude, longitude],
      17
    )
  }, [currentCampus?.id])

  /*
   * CLEAN GPS WATCH ON UNMOUNT
   */
  useEffect(() => {
    return () => {
      stopGpsWatch()
    }
  }, [])

  /*
   * START GPS WATCH
   */
  function startGpsWatch() {
    if (!navigator.geolocation) {
      setError(
        'Your browser does not support GPS location.'
      )
      setGpsStatus(
        'GPS not supported'
      )
      return false
    }

    if (
      watchIdRef.current !== null
    ) {
      return true
    }

    setError('')
    setGpsStatus(
      'Waiting for GPS...'
    )

    const watchId =
      navigator.geolocation.watchPosition(
        handleGpsPosition,
        handleGpsError,
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 20000,
        }
      )

    watchIdRef.current =
      watchId

    return true
  }

  /*
   * STOP GPS WATCH
   */
  function stopGpsWatch() {
    if (
      watchIdRef.current !== null &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(
        watchIdRef.current
      )
    }

    watchIdRef.current = null
  }

  /*
   * GPS SUCCESS
   */
  function handleGpsPosition(
    position
  ) {
    const latitude = Number(
      position.coords.latitude
    )

    const longitude = Number(
      position.coords.longitude
    )

    const accuracy = Number(
      position.coords.accuracy
    )

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return
    }

    const location = [
      latitude,
      longitude,
    ]

    const map = mapRef.current

    if (!map) {
      return
    }

    /*
     * LIVE GPS MARKER
     */
    if (
      !currentMarkerRef.current
    ) {
      currentMarkerRef.current =
        L.marker(
          location,
          {
            icon: recorderIcon,
            zIndexOffset: 1000,
          }
        ).addTo(map)

      currentMarkerRef.current.bindTooltip(
        'Current location',
        {
          direction: 'top',
          offset: [0, -10],
        }
      )
    } else {
      currentMarkerRef.current.setLatLng(
        location
      )
    }

    /*
     * CENTER MAP ON FIRST GPS POSITION
     */
    if (
      pointsRef.current.length ===
      0
    ) {
      map.setView(
        location,
        18
      )
    }

    /*
     * GPS STATUS
     */
    if (
      Number.isFinite(accuracy)
    ) {
      if (accuracy <= 10) {
        setGpsStatus(
          `GPS excellent • ${Math.round(
            accuracy
          )}m`
        )
      } else if (
        accuracy <= 25
      ) {
        setGpsStatus(
          `GPS good • ${Math.round(
            accuracy
          )}m`
        )
      } else if (
        accuracy <= 50
      ) {
        setGpsStatus(
          `GPS fair • ${Math.round(
            accuracy
          )}m`
        )
      } else {
        setGpsStatus(
          `GPS weak • ${Math.round(
            accuracy
          )}m`
        )
      }
    }

    /*
     * DON'T RECORD WHILE PAUSED
     */
    if (
      !recording ||
      paused
    ) {
      return
    }

    /*
     * JITTER FILTER
     *
     * Ignore extremely tiny GPS movements.
     */
    const previous =
      pointsRef.current[
        pointsRef.current.length - 1
      ]

    if (previous) {
      const latDifference =
        Math.abs(
          latitude -
            Number(previous[0])
        )

      const lngDifference =
        Math.abs(
          longitude -
            Number(previous[1])
        )

      if (
        latDifference <
          0.00001 &&
        lngDifference <
          0.00001
      ) {
        return
      }
    }

    const nextPoints = [
      ...pointsRef.current,
      location,
    ]

    pointsRef.current =
      nextPoints

    setPoints(nextPoints)

    const nextDistance =
      calculateRouteDistance(
        nextPoints
      )

    setDistance(
      nextDistance
    )

    if (
      routeLineRef.current
    ) {
      routeLineRef.current.setLatLngs(
        nextPoints
      )
    }
  }

  /*
   * GPS ERROR
   */
  function handleGpsError(
    geoError
  ) {
    if (
      geoError.code === 1
    ) {
      setGpsStatus(
        'GPS permission denied'
      )

      setError(
        'Location permission was denied. Allow location access in your browser.'
      )
    } else if (
      geoError.code === 2
    ) {
      setGpsStatus(
        'GPS unavailable'
      )

      setError(
        'Your current location could not be detected.'
      )
    } else if (
      geoError.code === 3
    ) {
      setGpsStatus(
        'GPS timed out'
      )

      setError(
        'GPS took too long to respond. Try moving outside or into an open area.'
      )
    } else {
      setGpsStatus(
        'GPS error'
      )

      setError(
        'Could not read your GPS location.'
      )
    }
  }

  /*
   * START RECORDING
   */
  function startRecording() {
    setError('')

    if (
      !currentCampus
    ) {
      setError(
        'Please select a campus before recording a road.'
      )
      return
    }

    const gpsStarted =
      startGpsWatch()

    if (!gpsStarted) {
      return
    }

    setRecording(true)
    setPaused(false)
    setGpsStatus(
      'Recording road...'
    )
  }

  /*
   * PAUSE
   */
  function pauseRecording() {
    setPaused(true)

    setGpsStatus(
      'Recording paused'
    )
  }

  /*
   * RESUME
   */
  function resumeRecording() {
    setError('')

    startGpsWatch()

    setPaused(false)

    setGpsStatus(
      'Recording road...'
    )
  }

  /*
   * STOP RECORDING
   */
  function stopRecording() {
    setRecording(false)
    setPaused(false)

    stopGpsWatch()

    setGpsStatus(
      pointsRef.current.length >= 2
        ? 'Route ready to save'
        : 'Recording stopped'
    )
  }

  /*
   * CLEAR RECORDING
   */
  function clearRecording() {
    setRecording(false)
    setPaused(false)

    stopGpsWatch()

    pointsRef.current = []

    setPoints([])
    setDistance(0)

    setGpsStatus(
      'Ready to record'
    )

    setError('')

    if (
      routeLineRef.current
    ) {
      routeLineRef.current.setLatLngs(
        []
      )
    }

    if (
      currentMarkerRef.current
    ) {
      currentMarkerRef.current.remove()

      currentMarkerRef.current =
        null
    }
  }

  /*
   * FORM CHANGE
   */
  function updateForm(
    field,
    value
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  /*
   * SAVE ROAD
   */
  async function saveRoad() {
    setError('')

    if (
      !currentCampus
    ) {
      setError(
        'No campus selected.'
      )
      return
    }

    if (
      pointsRef.current.length <
      2
    ) {
      setError(
        'Record at least two GPS points before saving.'
      )
      return
    }

    if (
      !form.name.trim()
    ) {
      setError(
        'Please enter a road name.'
      )
      return
    }

    setSaving(true)

    try {
      await createRoad({
        campusId:
          currentCampus.id,

        name:
          form.name.trim(),

        roadType:
          form.roadType,

        description:
          form.description.trim(),

        fieldNotes:
          form.fieldNotes.trim(),

        distanceMeters:
          calculateRouteDistance(
            pointsRef.current
          ),

        geometry:
          pointsRef.current,
      })

      navigate(
        '/collection'
      )
    } catch (err) {
      console.error(
        'Could not save road:',
        err
      )

      setError(
        err.message ||
          'Could not save this road.'
      )
    } finally {
      setSaving(false)
    }
  }

  const canSave =
    points.length >= 2 &&
    form.name.trim().length > 0 &&
    !saving

  return (
    <>
      <Header
        title="Road Mapper"
        backTo="/map"
      />

      <main className="road-recorder">
        <section className="road-map-card">
          <div
            ref={mapElementRef}
            className="road-map"
          />

          <div className="road-campus-badge">
            <span>📍</span>

            <div>
              <small>
                Recording for
              </small>

              <strong>
                {currentCampus?.name ||
                  'No campus selected'}
              </strong>
            </div>
          </div>

          <div className="road-gps-status">
            <span className="cm-live-dot" />

            {gpsStatus}
          </div>
        </section>

        <section className="road-stats">
          <div>
            <strong>
              {formatDistance(
                distance
              )}
            </strong>

            <span>
              Distance recorded
            </span>
          </div>

          <div>
            <strong>
              {points.length}
            </strong>

            <span>
              GPS points
            </span>
          </div>

          <div>
            <strong>
              {recording
                ? paused
                  ? 'Paused'
                  : 'Live'
                : 'Stopped'}
            </strong>

            <span>
              Status
            </span>
          </div>
        </section>

        <section className="road-controls">
          {!recording &&
            points.length === 0 && (
              <button
                type="button"
                className="road-primary-button"
                onClick={
                  startRecording
                }
              >
                📍 Start Recording
              </button>
            )}

          {recording &&
            !paused && (
              <>
                <button
                  type="button"
                  className="road-secondary-button"
                  onClick={
                    pauseRecording
                  }
                >
                  ⏸ Pause
                </button>

                <button
                  type="button"
                  className="road-danger-button"
                  onClick={
                    stopRecording
                  }
                >
                  ■ Stop
                </button>
              </>
            )}

          {recording &&
            paused && (
              <>
                <button
                  type="button"
                  className="road-primary-button"
                  onClick={
                    resumeRecording
                  }
                >
                  ▶ Resume
                </button>

                <button
                  type="button"
                  className="road-danger-button"
                  onClick={
                    stopRecording
                  }
                >
                  ■ Stop
                </button>
              </>
            )}

          {!recording &&
            points.length > 0 && (
              <>
                <button
                  type="button"
                  className="road-primary-button"
                  onClick={
                    resumeRecording
                  }
                >
                  ▶ Continue
                </button>

                <button
                  type="button"
                  className="road-danger-button"
                  onClick={
                    clearRecording
                  }
                >
                  🗑 Clear
                </button>
              </>
            )}
        </section>

        {error && (
          <div
            className="road-error"
            role="alert"
          >
            <strong>
              Road Mapper
            </strong>

            <span>
              {error}
            </span>
          </div>
        )}

        {points.length >= 2 &&
          !recording && (
            <section className="road-form">
              <div className="road-form-heading">
                <div>
                  <small>
                    Route recorded
                  </small>

                  <h2>
                    Save this road
                  </h2>
                </div>

                <span>
                  {formatDistance(
                    distance
                  )}
                </span>
              </div>

              <label>
                <span>
                  Road name *
                </span>

                <input
                  type="text"
                  value={
                    form.name
                  }
                  onChange={(
                    event
                  ) =>
                    updateForm(
                      'name',
                      event.target
                        .value
                    )
                  }
                  placeholder="e.g. Main Campus Road"
                />
              </label>

              <label>
                <span>
                  Road type
                </span>

                <select
                  value={
                    form.roadType
                  }
                  onChange={(
                    event
                  ) =>
                    updateForm(
                      'roadType',
                      event.target
                        .value
                    )
                  }
                >
                  <option value="Road">
                    Road
                  </option>

                  <option value="Walkway">
                    Walkway
                  </option>

                  <option value="Path">
                    Footpath
                  </option>

                  <option value="Driveway">
                    Driveway
                  </option>

                  <option value="Parking">
                    Parking route
                  </option>

                  <option value="Other">
                    Other
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Description
                </span>

                <textarea
                  value={
                    form.description
                  }
                  onChange={(
                    event
                  ) =>
                    updateForm(
                      'description',
                      event.target
                        .value
                    )
                  }
                  placeholder="Describe where this road leads."
                  rows={3}
                />
              </label>

              <label>
                <span>
                  Field notes
                </span>

                <textarea
                  value={
                    form.fieldNotes
                  }
                  onChange={(
                    event
                  ) =>
                    updateForm(
                      'fieldNotes',
                      event.target
                        .value
                    )
                  }
                  placeholder="Add useful notes from the field."
                  rows={3}
                />
              </label>

              <div className="road-save-actions">
                <button
                  type="button"
                  className="road-save-button"
                  onClick={
                    saveRoad
                  }
                  disabled={
                    !canSave
                  }
                >
                  {saving
                    ? 'Saving road...'
                    : '💾 Save Road'}
                </button>

                <button
                  type="button"
                  className="road-cancel-button"
                  onClick={
                    clearRecording
                  }
                  disabled={
                    saving
                  }
                >
                  Discard
                </button>
              </div>
            </section>
          )}

        <section className="road-help">
          <strong>
            🛣️ How Road Mapper works
          </strong>

          <p>
            Walk or drive along the campus
            road while CampusMapper records
            your GPS path. Stop when you reach
            the end, then save the road with
            its name and notes.
          </p>

          <div>
            <span>
              1
            </span>

            <span>
              Start recording
            </span>

            <span>
              →
            </span>

            <span>
              2
            </span>

            <span>
              Follow the road
            </span>

            <span>
              →
            </span>

            <span>
              3
            </span>

            <span>
              Stop & save
            </span>
          </div>
        </section>
      </main>
    </>
  )
}