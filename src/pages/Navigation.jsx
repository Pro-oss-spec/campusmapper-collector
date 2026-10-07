import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import L from 'leaflet'

import Header from '../components/Header'
import { useApp } from '../context/AppContext'
import { fetchPlace } from '../lib/places'
import { fetchRoads } from '../lib/roads'
import {
  calculateWalkingRoute,
} from '../lib/routeEngine'

const destinationIcon = L.divIcon({
  className: 'cm-nav-destination',
  html: '<span></span>',
  iconSize: [38, 38],
  iconAnchor: [19, 38],
})

function formatDistance(meters) {
  if (!Number.isFinite(Number(meters))) {
    return '--'
  }

  const value = Number(meters)

  if (value < 1000) {
    return `${Math.round(value)} m`
  }

  return `${(value / 1000).toFixed(2)} km`
}

function formatWalkingTime(minutes) {
  if (!Number.isFinite(Number(minutes))) {
    return '--'
  }

  const value = Math.max(1, Math.round(Number(minutes)))

  if (value < 60) {
    return `${value} min`
  }

  const hours = Math.floor(value / 60)
  const remaining = value % 60

  if (remaining === 0) {
    return `${hours} hr`
  }

  return `${hours} hr ${remaining} min`
}

function distanceBetweenPoints(a, b) {
  if (!a || !b) {
    return Infinity
  }

  const R = 6371000

  const lat1 =
    (Number(a[0]) * Math.PI) / 180

  const lat2 =
    (Number(b[0]) * Math.PI) / 180

  const deltaLat =
    ((Number(b[0]) - Number(a[0])) *
      Math.PI) /
    180

  const deltaLng =
    ((Number(b[1]) - Number(a[1])) *
      Math.PI) /
    180

  const sinLat =
    Math.sin(deltaLat / 2)

  const sinLng =
    Math.sin(deltaLng / 2)

  const value =
    sinLat * sinLat +
    Math.cos(lat1) *
      Math.cos(lat2) *
      sinLng *
      sinLng

  const c =
    2 *
    Math.atan2(
      Math.sqrt(value),
      Math.sqrt(1 - value)
    )

  return R * c
}

export default function Navigation() {
  const { currentCampus } = useApp()
  const [searchParams] = useSearchParams()

  const destinationId =
    searchParams.get('place')

  const mapElementRef = useRef(null)
  const mapRef = useRef(null)

  const routeLayerRef = useRef(null)
  const destinationMarkerRef =
    useRef(null)

  const userMarkerRef = useRef(null)
  const userAccuracyRef =
    useRef(null)

  const watchIdRef = useRef(null)

  const currentLocationRef =
    useRef(null)

  const lastRouteCalculationRef =
    useRef(0)

  const [destination, setDestination] =
    useState(null)

  const [roads, setRoads] =
    useState([])

  const [route, setRoute] =
    useState(null)

  const [userLocation, setUserLocation] =
    useState(null)

  const [locationAccuracy, setLocationAccuracy] =
    useState(null)

  const [loading, setLoading] =
    useState(true)

  const [routing, setRouting] =
    useState(false)

  const [navigationStarted, setNavigationStarted] =
    useState(false)

  const [arrived, setArrived] =
    useState(false)

  const [error, setError] =
    useState('')

  const [locationStatus, setLocationStatus] =
    useState(
      'Waiting for your location...'
    )

  /*
   * LOAD DESTINATION + ROADS
   */
  useEffect(() => {
    let cancelled = false

    async function loadNavigationData() {
      if (!destinationId) {
        setError(
          'No destination was selected.'
        )
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const [
          destinationData,
          roadData,
        ] = await Promise.all([
          fetchPlace(destinationId),
          fetchRoads(),
        ])

        if (cancelled) {
          return
        }

        setDestination(
          destinationData
        )

        const campusId =
          currentCampus?.id

        const filteredRoads =
          campusId
            ? roadData.filter(
                (road) =>
                  road.campus_id ===
                  campusId
              )
            : roadData

        setRoads(filteredRoads)
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message ||
              'Could not load navigation data.'
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadNavigationData()

    return () => {
      cancelled = true
    }
  }, [
    destinationId,
    currentCampus?.id,
  ])

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

    const latitude =
      Number(
        currentCampus?.center_lat
      )

    const longitude =
      Number(
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
    ).setView(center, 16)

    const street =
      L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          attribution:
            '&copy; OpenStreetMap contributors',
        }
      )

    street.addTo(map)

    routeLayerRef.current =
      L.layerGroup().addTo(map)

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
      routeLayerRef.current = null

      destinationMarkerRef.current =
        null

      userMarkerRef.current =
        null

      userAccuracyRef.current =
        null
    }
  }, [])

  /*
   * MOVE MAP WHEN CAMPUS CHANGES
   */
  useEffect(() => {
    const map = mapRef.current

    if (
      !map ||
      !currentCampus
    ) {
      return
    }

    const latitude =
      Number(
        currentCampus.center_lat
      )

    const longitude =
      Number(
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
      16
    )
  }, [currentCampus?.id])

  /*
   * DESTINATION MARKER
   */
  useEffect(() => {
    const map = mapRef.current

    if (
      !map ||
      !destination
    ) {
      return
    }

    const latitude =
      Number(
        destination.latitude
      )

    const longitude =
      Number(
        destination.longitude
      )

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return
    }

    if (
      destinationMarkerRef.current
    ) {
      destinationMarkerRef.current.remove()
    }

    const marker =
      L.marker(
        [
          latitude,
          longitude,
        ],
        {
          icon:
            destinationIcon,
          zIndexOffset: 1000,
        }
      )

    marker
      .bindTooltip(
        'Destination',
        {
          direction: 'top',
          offset: [
            0,
            -34,
          ],
          className:
            'cm-label',
        }
      )
      .addTo(map)

    destinationMarkerRef.current =
      marker

    map.flyTo(
      [
        latitude,
        longitude,
      ],
      17,
      {
        animate: true,
        duration: 0.7,
      }
    )

    return () => {
      marker.remove()
    }
  }, [destination])

  /*
   * GPS WATCH
   */
  useEffect(() => {
    if (
      !navigator.geolocation
    ) {
      setLocationStatus(
        'Location is not supported by this browser.'
      )

      return
    }

    function handlePosition(
      position
    ) {
      const latitude =
        Number(
          position.coords.latitude
        )

      const longitude =
        Number(
          position.coords.longitude
        )

      const accuracy =
        Number(
          position.coords.accuracy
        )

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        return
      }

      const safeAccuracy =
        Number.isFinite(
          accuracy
        ) &&
        accuracy > 0
          ? accuracy
          : 10

      const location = [
        latitude,
        longitude,
      ]

      currentLocationRef.current =
        location

      setUserLocation(
        location
      )

      setLocationAccuracy(
        safeAccuracy
      )

      if (
        safeAccuracy <= 20
      ) {
        setLocationStatus(
          'Good GPS accuracy'
        )
      } else if (
        safeAccuracy <= 50
      ) {
        setLocationStatus(
          'Fair GPS accuracy'
        )
      } else {
        setLocationStatus(
          'Low GPS accuracy'
        )
      }

      const map = mapRef.current

      if (!map) {
        return
      }

      /*
       * USER MARKER
       */
      if (
        !userMarkerRef.current
      ) {
        userMarkerRef.current =
          L.circleMarker(
            location,
            {
              radius: 9,
              color: '#ffffff',
              weight: 3,
              fillColor:
                '#1976ff',
              fillOpacity: 1,
            }
          ).addTo(map)

        userMarkerRef.current.bindTooltip(
          'You',
          {
            direction: 'top',
            offset: [
              0,
              -8,
            ],
          }
        )
      } else {
        userMarkerRef.current.setLatLng(
          location
        )
      }

      /*
       * ACCURACY CIRCLE
       */
      if (
        !userAccuracyRef.current
      ) {
        userAccuracyRef.current =
          L.circle(
            location,
            {
              radius:
                Math.max(
                  safeAccuracy,
                  5
                ),
              color:
                '#1976ff',
              weight: 1,
              fillColor:
                '#1976ff',
              fillOpacity:
                0.08,
            }
          ).addTo(map)
      } else {
        userAccuracyRef.current.setLatLng(
          location
        )

        userAccuracyRef.current.setRadius(
          Math.max(
            safeAccuracy,
            5
          )
        )
      }

      /*
       * ARRIVAL CHECK
       */
      if (
        destination
      ) {
        const destinationPoint =
          [
            Number(
              destination.latitude
            ),
            Number(
              destination.longitude
            ),
          ]

        const distance =
          distanceBetweenPoints(
            location,
            destinationPoint
          )

        if (
          distance <= 15
        ) {
          setArrived(true)
          setNavigationStarted(
            false
          )
        }
      }

      /*
       * RECALCULATE ROUTE DURING NAVIGATION
       */
      if (
        navigationStarted &&
        destination &&
        roads.length > 0
      ) {
        const now =
          Date.now()

        if (
          now -
            lastRouteCalculationRef.current >
          5000
        ) {
          calculateRoute(
            location
          )
        }
      }
    }

    function handleError(
      geoError
    ) {
      if (
        geoError.code === 1
      ) {
        setLocationStatus(
          'Location permission denied'
        )
      } else if (
        geoError.code === 2
      ) {
        setLocationStatus(
          'Location unavailable'
        )
      } else if (
        geoError.code === 3
      ) {
        setLocationStatus(
          'GPS request timed out'
        )
      } else {
        setLocationStatus(
          'Could not detect location'
        )
      }
    }

    watchIdRef.current =
      navigator.geolocation.watchPosition(
        handlePosition,
        handleError,
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 15000,
        }
      )

    return () => {
      if (
        watchIdRef.current !== null
      ) {
        navigator.geolocation.clearWatch(
          watchIdRef.current
        )
      }

      watchIdRef.current =
        null
    }
  }, [
    destination,
    roads,
    navigationStarted,
  ])

  /*
   * CALCULATE ROUTE
   */
  async function calculateRoute(
    startLocation
  ) {
    if (
      !startLocation ||
      !destination ||
      !roads.length
    ) {
      return
    }

    setRouting(true)
    setError('')

    lastRouteCalculationRef.current =
      Date.now()

    try {
      const start = [
        Number(
          startLocation[0]
        ),
        Number(
          startLocation[1]
        ),
      ]

      const end = [
        Number(
          destination.latitude
        ),
        Number(
          destination.longitude
        ),
      ]

      const result =
        await calculateWalkingRoute(
          roads,
          start,
          end
        )

      if (!result) {
        throw new Error(
          'No walking route could be found.'
        )
      }

      setRoute(result)

      drawRoute(result)
    } catch (err) {
      console.error(
        'Route calculation failed:',
        err
      )

      setError(
        err.message ||
          'Could not calculate a walking route.'
      )
    } finally {
      setRouting(false)
    }
  }

  /*
   * DRAW ROUTE
   */
  function drawRoute(
    routeResult
  ) {
    const map = mapRef.current
    const layer =
      routeLayerRef.current

    if (
      !map ||
      !layer ||
      !routeResult
    ) {
      return
    }

    layer.clearLayers()

    const points =
      routeResult.path ||
      routeResult.geometry ||
      routeResult.route

    if (
      !Array.isArray(points) ||
      points.length < 2
    ) {
      return
    }

    const line =
      L.polyline(
        points,
        {
          color:
            '#29945E',
          weight: 7,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }
      )

    line.addTo(layer)
  }

  /*
   * START NAVIGATION
   */
  async function startNavigation() {
    setArrived(false)

    const location =
      currentLocationRef.current

    if (!location) {
      setLocationStatus(
        'Waiting for your GPS location...'
      )

      return
    }

    if (!destination) {
      return
    }

    setNavigationStarted(
      true
    )

    await calculateRoute(
      location
    )

    const map = mapRef.current

    if (map) {
      map.flyTo(
        location,
        18,
        {
          animate: true,
          duration: 0.6,
        }
      )
    }
  }

  /*
   * STOP NAVIGATION
   */
  function stopNavigation() {
    setNavigationStarted(
      false
    )

    const layer =
      routeLayerRef.current

    if (layer) {
      layer.clearLayers()
    }

    setRoute(null)
  }

  /*
   * CENTER ON USER
   */
  function centerOnUser() {
    const map = mapRef.current
    const location =
      currentLocationRef.current

    if (
      !map ||
      !location
    ) {
      setLocationStatus(
        'Waiting for your location...'
      )

      return
    }

    map.flyTo(
      location,
      18,
      {
        animate: true,
        duration: 0.5,
      }
    )
  }

  /*
   * LOADING
   */
  if (loading) {
    return (
      <>
        <Header
          title="Navigation"
          backTo="/map"
        />

        <main className="cm-navigation-page">
          <div className="cm-navigation-loading">
            <span className="cm-navigation-spinner" />

            <strong>
              Preparing your route...
            </strong>

            <small>
              Loading campus navigation data
            </small>
          </div>
        </main>
      </>
    )
  }

  /*
   * ERROR WITHOUT DESTINATION
   */
  if (
    error &&
    !destination
  ) {
    return (
      <>
        <Header
          title="Navigation"
          backTo="/map"
        />

        <main className="cm-navigation-page">
          <div className="cm-navigation-error">
            <span>🧭</span>

            <h2>
              Navigation unavailable
            </h2>

            <p>
              {error}
            </p>

            <Link
              to="/map"
              className="cm-navigation-primary"
            >
              ← Back to Map
            </Link>
          </div>
        </main>
      </>
    )
  }

  const routeDistance =
    route?.distance ??
    route?.distanceMeters ??
    null

  const walkingTime =
    route?.walkingTime ??
    route?.walkingTimeMinutes ??
    null

  return (
    <>
      <Header
        title="Navigation"
        backTo="/map"
      />

      <main className="cm-navigation-page">
        <section className="cm-navigation-map-shell">
          <div
            ref={mapElementRef}
            className="cm-navigation-map"
          />

          {/* TOP DESTINATION */}
          <div className="cm-navigation-destination">
            <span className="cm-navigation-destination-icon">
              🧭
            </span>

            <div>
              <small>
                {navigationStarted
                  ? 'Walking to'
                  : 'Destination'}
              </small>

              <strong>
                {destination?.name ||
                  'Destination'}
              </strong>
            </div>
          </div>

          {/* RECENTER */}
          <button
            type="button"
            className="cm-navigation-recenter"
            onClick={
              centerOnUser
            }
            aria-label="Center on my location"
          >
            📍
          </button>

          {/* GPS STATUS */}
          <div className="cm-navigation-gps">
            <span className="cm-live-dot" />

            {locationStatus}

            {locationAccuracy && (
              <span>
                {Math.round(
                  locationAccuracy
                )}
                m
              </span>
            )}
          </div>

          {/* ARRIVED */}
          {arrived && (
            <div className="cm-navigation-arrived">
              <div className="cm-arrived-icon">
                ✓
              </div>

              <div>
                <strong>
                  You've arrived
                </strong>

                <small>
                  You are at{' '}
                  {destination?.name}
                </small>
              </div>
            </div>
          )}
        </section>

        {/* BOTTOM NAVIGATION PANEL */}
        <section className="cm-navigation-panel">
          <div className="cm-navigation-handle" />

          <div className="cm-navigation-place">
            <div className="cm-navigation-place-icon">
              🏢
            </div>

            <div>
              <small>
                {destination?.category ||
                  'Campus location'}
              </small>

              <h1>
                {destination?.name ||
                  'Destination'}
              </h1>
            </div>
          </div>

          {/* ROUTE SUMMARY */}
          {route && !arrived && (
            <div className="cm-route-stats">
              <div>
                <strong>
                  {formatDistance(
                    routeDistance
                  )}
                </strong>

                <span>
                  Distance
                </span>
              </div>

              <div className="cm-route-divider" />

              <div>
                <strong>
                  {formatWalkingTime(
                    walkingTime
                  )}
                </strong>

                <span>
                  Walking
                </span>
              </div>
            </div>
          )}

          {/* BEFORE NAVIGATION */}
          {!navigationStarted &&
            !arrived && (
              <>
                <div className="cm-navigation-message">
                  <span>
                    🚶
                  </span>

                  <div>
                    <strong>
                      Ready to navigate?
                    </strong>

                    <small>
                      CampusMapper will guide
                      you along the mapped
                      campus roads.
                    </small>
                  </div>
                </div>

                {error && (
                  <div className="cm-navigation-inline-error">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  className="cm-navigation-primary cm-navigation-start"
                  onClick={
                    startNavigation
                  }
                  disabled={
                    routing ||
                    !userLocation
                  }
                >
                  {routing ? (
                    <>
                      <span className="cm-small-spinner" />
                      Finding route...
                    </>
                  ) : (
                    <>
                      🧭 Start Navigation
                    </>
                  )}
                </button>
              </>
            )}

          {/* ACTIVE NAVIGATION */}
          {navigationStarted &&
            !arrived && (
              <>
                <div className="cm-navigation-active">
                  <div className="cm-active-indicator">
                    <span />
                  </div>

                  <div>
                    <strong>
                      Navigation active
                    </strong>

                    <small>
                      Follow the green route
                      on the map.
                    </small>
                  </div>
                </div>

                {routing && (
                  <div className="cm-rerouting">
                    Recalculating route...
                  </div>
                )}

                {error && (
                  <div className="cm-navigation-inline-error">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  className="cm-navigation-stop"
                  onClick={
                    stopNavigation
                  }
                >
                  Stop Navigation
                </button>
              </>
            )}

          {/* ARRIVED */}
          {arrived && (
            <>
              <div className="cm-arrival-message">
                <strong>
                  🎉 You have arrived!
                </strong>

                <span>
                  You're at{' '}
                  {destination?.name}.
                </span>
              </div>

              <Link
                to={`/location/${destination?.id}`}
                className="cm-navigation-primary"
              >
                View Location
              </Link>
            </>
          )}

          <Link
            to="/map"
            className="cm-navigation-back"
          >
            ← Back to Map
          </Link>
        </section>
      </main>
    </>
  )
}