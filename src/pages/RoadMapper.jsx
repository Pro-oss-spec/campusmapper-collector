
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import Header from '../components/Header'
import { useApp } from '../context/AppContext'
import { createRoad, calculateRouteDistance } from '../lib/roads'

export default function RoadMapper() {
  const { currentCampus } = useApp()
  const navigate = useNavigate()

  const mapElementRef = useRef(null)
  const mapRef = useRef(null)
  const routeLineRef = useRef(null)
  const positionMarkerRef = useRef(null)
  const watchRef = useRef(null)
  const pausedRef = useRef(false)

  const [recording, setRecording] = useState(false)
  const [paused, setPaused] = useState(false)
  const [points, setPoints] = useState([])
  const [accuracy, setAccuracy] = useState(null)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [roadType, setRoadType] = useState('Road')
  const [description, setDescription] = useState('')
  const [fieldNotes, setFieldNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const distance = calculateRouteDistance(points)

  // Create the Leaflet map once.
  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return
    }

    const startCenter = currentCampus
      ? [currentCampus.center_lat, currentCampus.center_lng]
      : [0, 0]

    const map = L.map(mapElementRef.current).setView(
      startCenter,
      17
    )

    const street = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap contributors',
      }
    )

    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 20,
        attribution: 'Imagery &copy; Esri',
      }
    )

    street.addTo(map)

    L.control
      .layers(
        {
          Street: street,
          Satellite: satellite,
        },
        null,
        {
          position: 'topright',
        }
      )
      .addTo(map)

    routeLineRef.current = L.polyline([], {
      color: '#ff5a1f',
      weight: 6,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      routeLineRef.current = null
      positionMarkerRef.current = null
    }
  }, [currentCampus])

  // Update the route line whenever GPS points change.
  useEffect(() => {
    const map = mapRef.current
    const routeLine = routeLineRef.current

    if (!map || !routeLine) {
      return
    }

    routeLine.setLatLngs(points)

    if (points.length === 1) {
      map.setView(points[0], 18)
    }

    if (points.length > 1) {
      map.fitBounds(routeLine.getBounds(), {
        padding: [40, 40],
        maxZoom: 19,
      })
    }
  }, [points])

  function updatePositionMarker(latitude, longitude) {
    const map = mapRef.current

    if (!map) {
      return
    }

    if (!positionMarkerRef.current) {
      positionMarkerRef.current = L.circleMarker(
        [latitude, longitude],
        {
          radius: 8,
          color: '#123428',
          weight: 3,
          fillColor: '#ff5a1f',
          fillOpacity: 1,
        }
      ).addTo(map)
    } else {
      positionMarkerRef.current.setLatLng([
        latitude,
        longitude,
      ])
    }
  }

  function startRecording() {
    setError('')

    if (!navigator.geolocation) {
      setError(
        'Your browser does not support GPS location.'
      )
      return
    }

    if (!currentCampus) {
      setError('No campus is selected.')
      return
    }

    pausedRef.current = false
    setPaused(false)
    setRecording(true)

    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const {
          latitude,
          longitude,
          accuracy: gpsAccuracy,
        } = position.coords

        setAccuracy(gpsAccuracy)

        updatePositionMarker(
          latitude,
          longitude
        )

        if (pausedRef.current) {
          return
        }

        setPoints((previous) => {
          const nextPoint = [
            latitude,
            longitude,
          ]

          if (previous.length > 0) {
            const last =
              previous[previous.length - 1]

            const latDiff = Math.abs(
              last[0] - latitude
            )

            const lngDiff = Math.abs(
              last[1] - longitude
            )

            // Ignore tiny GPS jitter.
            if (
              latDiff < 0.00001 &&
              lngDiff < 0.00001
            ) {
              return previous
            }
          }

          return [...previous, nextPoint]
        })
      },
      (gpsError) => {
        if (gpsError.code === 1) {
          setError(
            'Location permission was denied. Allow GPS access and try again.'
          )
        } else if (gpsError.code === 2) {
          setError(
            'Your device could not determine your location.'
          )
        } else {
          setError(
            'GPS timed out. Move to an open area and try again.'
          )
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000,
      }
    )
  }

  function stopRecording() {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(
        watchRef.current
      )

      watchRef.current = null
    }

    pausedRef.current = false
    setPaused(false)
    setRecording(false)
  }

  function togglePause() {
    const nextPaused = !pausedRef.current

    pausedRef.current = nextPaused
    setPaused(nextPaused)
  }

  function resetRecording() {
    stopRecording()

    setPoints([])
    setAccuracy(null)
    setName('')
    setRoadType('Road')
    setDescription('')
    setFieldNotes('')
    setError('')

    if (routeLineRef.current) {
      routeLineRef.current.setLatLngs([])
    }

    if (positionMarkerRef.current) {
      positionMarkerRef.current.remove()
      positionMarkerRef.current = null
    }

    if (mapRef.current && currentCampus) {
      mapRef.current.setView(
        [
          currentCampus.center_lat,
          currentCampus.center_lng,
        ],
        17
      )
    }
  }

  async function saveRoad() {
    if (!currentCampus) {
      setError('No campus is selected.')
      return
    }

    if (!name.trim()) {
      setError('Enter a name for this road.')
      return
    }

    if (points.length < 2) {
      setError(
        'Record at least two GPS points before saving.'
      )
      return
    }

    setSaving(true)
    setError('')

    try {
      await createRoad({
        campusId: currentCampus.id,
        name,
        roadType,
        description,
        fieldNotes,
        distanceMeters: distance,
        geometry: points,
      })

      navigate('/collection')
    } catch (err) {
      setError(
        err.message || 'Could not save this road.'
      )
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(
          watchRef.current
        )
      }
    }
  }, [])

  return (
    <>
      <Header
        title="Road Mapper"
        backTo="/"
      />

      <main className="page">
        <section className="road-recorder">
          <div className="road-status">
            <div>
              <span
                className={`status-dot ${
                  recording ? 'active' : ''
                }`}
              />

              {recording
                ? paused
                  ? 'Recording paused'
                  : 'Recording road'
                : points.length > 0
                  ? 'Recording stopped'
                  : 'Ready to record'}
            </div>

            {accuracy !== null && (
              <span className="road-gps-accuracy">
                GPS ±{Math.round(accuracy)}m
              </span>
            )}
          </div>

          <div
            ref={mapElementRef}
            className="road-map"
            aria-label="Live road mapping map"
          />

          <div className="road-stats">
            <div className="road-stat">
              <strong>{points.length}</strong>
              <span>GPS points</span>
            </div>

            <div className="road-stat">
              <strong>
                {distance >= 1000
                  ? `${(
                      distance / 1000
                    ).toFixed(2)} km`
                  : `${Math.round(distance)} m`}
              </strong>

              <span>Distance</span>
            </div>
          </div>

          <div className="road-controls">
            {!recording &&
              points.length === 0 && (
                <button
                  type="button"
                  className="btn btn-flag btn-lg"
                  onClick={startRecording}
                >
                  Start Recording
                </button>
              )}

            {recording && (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={togglePause}
                >
                  {paused
                    ? 'Resume'
                    : 'Pause'}
                </button>

                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={stopRecording}
                >
                  Stop
                </button>
              </>
            )}

            {!recording &&
              points.length > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={resetRecording}
                >
                  Start Over
                </button>
              )}
          </div>

          {points.length > 0 &&
            !recording && (
              <div className="road-form">
                <h2 className="section-title">
                  Save Road
                </h2>

                <label>
                  Road name
                  <input
                    type="text"
                    value={name}
                    placeholder="e.g. Science Road"
                    onChange={(e) =>
                      setName(e.target.value)
                    }
                  />
                </label>

                <label>
                  Road type
                  <select
                    value={roadType}
                    onChange={(e) =>
                      setRoadType(e.target.value)
                    }
                  >
                    <option>Road</option>
                    <option>Major Road</option>
                    <option>Minor Road</option>
                    <option>Footpath</option>
                    <option>Walkway</option>
                    <option>Driveway</option>
                    <option>Access Road</option>
                    <option>Other</option>
                  </select>
                </label>

                <label>
                  Description
                  <textarea
                    value={description}
                    placeholder="Describe this road..."
                    rows="3"
                    onChange={(e) =>
                      setDescription(
                        e.target.value
                      )
                    }
                  />
                </label>

                <label>
                  Field notes
                  <textarea
                    value={fieldNotes}
                    placeholder="Anything the mapping team should know..."
                    rows="3"
                    onChange={(e) =>
                      setFieldNotes(
                        e.target.value
                      )
                    }
                  />
                </label>

                <div className="road-save-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={resetRecording}
                    disabled={saving}
                  >
                    Discard
                  </button>

                  <button
                    type="button"
                    className="btn btn-flag btn-grow"
                    onClick={saveRoad}
                    disabled={saving}
                  >
                    {saving
                      ? 'Saving road...'
                      : 'Save Road'}
                  </button>
                </div>
              </div>
            )}

          {error && (
            <div
              className="banner banner-error"
              role="alert"
            >
              {error}
            </div>
          )}
        </section>

        <section className="road-help">
          <h2 className="section-title">
            How to map a road
          </h2>

          <ol>
            <li>
              Stand at the beginning of the road.
            </li>
            <li>
              Tap <strong>Start Recording</strong>.
            </li>
            <li>
              Wait for your GPS accuracy to settle.
            </li>
            <li>
              Walk or drive along the road.
            </li>
            <li>
              Watch the orange line follow your route.
            </li>
            <li>
              Tap <strong>Stop</strong> at the end.
            </li>
            <li>
              Name the road and save it.
            </li>
          </ol>

          <p className="muted">
            For better accuracy, stay outdoors
            with a clear view of the sky.
          </p>
        </section>
      </main>
    </>
  )
}

