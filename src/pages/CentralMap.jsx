import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import L from 'leaflet'

import Header from '../components/Header'
import { useApp } from '../context/AppContext'
import { fetchPlaces } from '../lib/places'
import { fetchRoads } from '../lib/roads'

const pinIcon = L.divIcon({
  className: 'cm-pin',
  html: '<span></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 31],
  popupAnchor: [0, -30],
})

const destinationIcon = L.divIcon({
  className: 'cm-destination-pin',
  html: '<span></span>',
  iconSize: [34, 34],
  iconAnchor: [17, 39],
  popupAnchor: [0, -36],
})

function formatDistance(meters) {
  if (!meters || meters < 1) {
    return '0 m'
  }

  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`
  }

  return `${Math.round(meters)} m`
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
}

function calculateStraightLineDistance(a, b) {
  if (!a || !b) return null

  const R = 6371000

  const lat1 = (Number(a[0]) * Math.PI) / 180
  const lat2 = (Number(b[0]) * Math.PI) / 180

  const deltaLat =
    ((Number(b[0]) - Number(a[0])) * Math.PI) / 180

  const deltaLng =
    ((Number(b[1]) - Number(a[1])) * Math.PI) / 180

  const sinLat = Math.sin(deltaLat / 2)
  const sinLng = Math.sin(deltaLng / 2)

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

export default function CentralMap() {
  const { currentCampus } = useApp()
  const [searchParams] = useSearchParams()

  const destinationId = searchParams.get('place')

  const mapElementRef = useRef(null)
  const mapRef = useRef(null)

  const buildingLayerRef = useRef(null)
  const roadLayerRef = useRef(null)

  const placeMarkersRef = useRef(new Map())
  const destinationMarkerRef = useRef(null)

  const userMarkerRef = useRef(null)
  const userAccuracyRef = useRef(null)
  const lastUserLocationRef = useRef(null)

  const hasFittedUserLocationRef = useRef(false)

  const [places, setPlaces] = useState([])
  const [roads, setRoads] = useState([])

  const [showBuildings, setShowBuildings] = useState(true)
  const [showRoads, setShowRoads] = useState(true)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlace, setSelectedPlace] = useState(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [locationStatus, setLocationStatus] = useState(
    'Detecting your location...'
  )

  const [showSearch, setShowSearch] = useState(false)
  const [showLayers, setShowLayers] = useState(false)

  async function loadMapData() {
    setLoading(true)
    setError('')

    try {
      const [placeData, roadData] = await Promise.all([
        fetchPlaces(),
        fetchRoads(),
      ])

      const campusId = currentCampus?.id

      const filteredPlaces = campusId
        ? placeData.filter(
            (place) => place.campus_id === campusId
          )
        : placeData

      const filteredRoads = campusId
        ? roadData.filter(
            (road) => road.campus_id === campusId
          )
        : roadData

      setPlaces(filteredPlaces)
      setRoads(filteredRoads)
      setSelectedPlace(null)
    } catch (err) {
      setError(
        err.message ||
          'Could not load campus map data'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMapData()
  }, [currentCampus?.id])

  /*
   * CREATE MAP
   */
  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return
    }

    const campusLat = Number(
      currentCampus?.center_lat
    )

    const campusLng = Number(
      currentCampus?.center_lng
    )

    const center =
      Number.isFinite(campusLat) &&
      Number.isFinite(campusLng)
        ? [campusLat, campusLng]
        : [5.0336, 7.9286]

    const map = L.map(
      mapElementRef.current,
      {
        zoomControl: false,
        attributionControl: true,
      }
    ).setView(center, 16)

    /*
     * STREET MAP
     */
    const street = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution:
          '&copy; OpenStreetMap contributors',
      }
    )

    /*
     * SATELLITE MAP
     */
    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Imagery &copy; Esri',
      }
    )

    street.addTo(map)

    /*
     * LAYERS
     */
    buildingLayerRef.current =
      L.layerGroup().addTo(map)

    roadLayerRef.current =
      L.layerGroup().addTo(map)

    mapRef.current = map

    /*
     * CUSTOM MAP ZOOM CONTROL
     */
    L.control
      .zoom({
        position: 'bottomright',
      })
      .addTo(map)

    /*
     * CUSTOM BASE MAP SWITCHER
     */
    const BaseMapControl =
      L.Control.extend({
        options: {
          position: 'topright',
        },

        onAdd() {
          const container =
            L.DomUtil.create(
              'div',
              'cm-map-control'
            )

          container.innerHTML = `
            <button
              type="button"
              class="cm-map-control-button"
              title="Change map style"
              aria-label="Change map style"
            >
              🗺️
            </button>
          `

          const button =
            container.querySelector(
              'button'
            )

          button.addEventListener(
            'click',
            () => {
              if (
                map.hasLayer(street)
              ) {
                map.removeLayer(street)
                satellite.addTo(map)
                button.textContent =
                  '🛰️'
              } else {
                map.removeLayer(
                  satellite
                )
                street.addTo(map)
                button.textContent =
                  '🗺️'
              }
            }
          )

          L.DomEvent.disableClickPropagation(
            container
          )

          return container
        },
      })

    map.addControl(
      new BaseMapControl()
    )

    setTimeout(() => {
      map.invalidateSize()
    }, 100)

    return () => {
      map.remove()

      mapRef.current = null
      buildingLayerRef.current = null
      roadLayerRef.current = null

      userMarkerRef.current = null
      userAccuracyRef.current = null
      destinationMarkerRef.current =
        null

      placeMarkersRef.current.clear()
    }
  }, [])

  /*
   * MOVE MAP WHEN CAMPUS CHANGES
   */
  useEffect(() => {
    const map = mapRef.current

    if (!map || !currentCampus) {
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

    map.flyTo(
      [latitude, longitude],
      16,
      {
        animate: true,
        duration: 0.7,
      }
    )

    hasFittedUserLocationRef.current =
      false
  }, [currentCampus?.id])

  /*
   * LIVE GPS
   */
  useEffect(() => {
    const map = mapRef.current

    if (!map) {
      return
    }

    if (!navigator.geolocation) {
      setLocationStatus(
        'Location is not supported by this browser.'
      )
      return
    }

    const watchId =
      navigator.geolocation.watchPosition(
        (position) => {
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

          const safeAccuracy =
            Number.isFinite(accuracy) &&
            accuracy > 0
              ? accuracy
              : 10

          const userLocation = [
            latitude,
            longitude,
          ]

          lastUserLocationRef.current =
            userLocation

          setLocationStatus(
            safeAccuracy <= 20
              ? 'Good location accuracy'
              : safeAccuracy <= 50
                ? 'Fair location accuracy'
                : 'Low location accuracy'
          )

          /*
           * USER DOT
           */
          if (!userMarkerRef.current) {
            userMarkerRef.current =
              L.circleMarker(
                userLocation,
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
              'You are here',
              {
                direction: 'top',
                offset: [0, -8],
              }
            )
          } else {
            userMarkerRef.current.setLatLng(
              userLocation
            )
          }

          /*
           * GPS ACCURACY CIRCLE
           */
          if (!userAccuracyRef.current) {
            userAccuracyRef.current =
              L.circle(
                userLocation,
                {
                  radius:
                    Math.max(
                      safeAccuracy,
                      5
                    ),
                  color: '#1976ff',
                  weight: 1,
                  fillColor:
                    '#1976ff',
                  fillOpacity: 0.08,
                }
              ).addTo(map)
          } else {
            userAccuracyRef.current.setLatLng(
              userLocation
            )

            userAccuracyRef.current.setRadius(
              Math.max(
                safeAccuracy,
                5
              )
            )
          }

          /*
           * FIRST GPS FIX
           */
          if (
            !hasFittedUserLocationRef.current &&
            currentCampus
          ) {
            const campusLat =
              Number(
                currentCampus.center_lat
              )

            const campusLng =
              Number(
                currentCampus.center_lng
              )

            if (
              Number.isFinite(
                campusLat
              ) &&
              Number.isFinite(
                campusLng
              )
            ) {
              const bounds =
                L.latLngBounds([
                  [
                    campusLat,
                    campusLng,
                  ],
                  userLocation,
                ])

              map.fitBounds(
                bounds,
                {
                  padding: [
                    70,
                    70,
                  ],
                  maxZoom: 16,
                }
              )

              hasFittedUserLocationRef.current =
                true
            }
          }
        },
        (geoError) => {
          console.warn(
            'Could not get user location:',
            geoError.message
          )

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
              'Location request timed out'
            )
          } else {
            setLocationStatus(
              'Could not detect location'
            )
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000,
        }
      )

    return () => {
      navigator.geolocation.clearWatch(
        watchId
      )

      if (userMarkerRef.current) {
        userMarkerRef.current.remove()
        userMarkerRef.current = null
      }

      if (userAccuracyRef.current) {
        userAccuracyRef.current.remove()
        userAccuracyRef.current = null
      }

      lastUserLocationRef.current =
        null

      hasFittedUserLocationRef.current =
        false
    }
  }, [currentCampus])

  /*
   * BUILDING MARKERS
   */
  useEffect(() => {
    const layer =
      buildingLayerRef.current

    if (!layer) {
      return
    }

    layer.clearLayers()
    placeMarkersRef.current.clear()

    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove()
      destinationMarkerRef.current =
        null
    }

    if (!showBuildings) {
      return
    }

    places.forEach((place) => {
      const latitude = Number(
        place.latitude
      )

      const longitude = Number(
        place.longitude
      )

      if (
        !Number.isFinite(
          latitude
        ) ||
        !Number.isFinite(
          longitude
        )
      ) {
        return
      }

      const marker = L.marker(
        [latitude, longitude],
        {
          icon: pinIcon,
          title: place.name,
        }
      )

      /*
       * ONLY SHOW LABELS WHEN THERE
       * ARE NOT TOO MANY BUILDINGS.
       */
      if (places.length <= 30) {
        marker.bindTooltip(
          place.name,
          {
            permanent: true,
            direction: 'top',
            offset: [
              0,
              -32,
            ],
            className:
              'cm-label',
          }
        )
      }

      marker.on(
        'click',
        () => {
          setSelectedPlace(place)
          setSearchQuery('')
        }
      )

      marker.addTo(layer)

      placeMarkersRef.current.set(
        place.id,
        marker
      )
    })
  }, [
    places,
    showBuildings,
  ])

  /*
   * ROAD LAYER
   */
  useEffect(() => {
    const layer =
      roadLayerRef.current

    if (!layer) {
      return
    }

    layer.clearLayers()

    if (!showRoads) {
      return
    }

    roads.forEach((road) => {
      if (
        !Array.isArray(
          road.geometry
        ) ||
        road.geometry.length < 2
      ) {
        return
      }

      const validPoints =
        road.geometry.filter(
          (point) =>
            Array.isArray(point) &&
            point.length >= 2 &&
            Number.isFinite(
              Number(point[0])
            ) &&
            Number.isFinite(
              Number(point[1])
            )
        )

      if (
        validPoints.length < 2
      ) {
        return
      }

      const line =
        L.polyline(
          validPoints,
          {
            weight: 5,
            opacity: 0.85,
          }
        )

      line.bindTooltip(
        `🛣️ ${
          road.name ||
          'CampusMapper Road'
        }`,
        {
          sticky: true,
          className:
            'cm-label',
        }
      )

      line.on(
        'click',
        () => {
          setSelectedPlace(null)
        }
      )

      line.addTo(layer)
    })
  }, [
    roads,
    showRoads,
  ])

  /*
   * DESTINATION
   */
  useEffect(() => {
    const map = mapRef.current

    if (
      !map ||
      !destinationId ||
      !places.length
    ) {
      return
    }

    const destination =
      places.find(
        (place) =>
          place.id ===
          destinationId
      )

    if (!destination) {
      return
    }

    setSelectedPlace(
      destination
    )

    const latitude = Number(
      destination.latitude
    )

    const longitude = Number(
      destination.longitude
    )

    if (
      !Number.isFinite(
        latitude
      ) ||
      !Number.isFinite(
        longitude
      )
    ) {
      return
    }

    if (!showBuildings) {
      setShowBuildings(true)
      return
    }

    if (
      destinationMarkerRef.current
    ) {
      destinationMarkerRef.current.remove()
    }

    const destinationMarker =
      L.marker(
        [
          latitude,
          longitude,
        ],
        {
          icon:
            destinationIcon,
          zIndexOffset: 1000,
          title:
            `Destination: ${destination.name}`,
        }
      )

    destinationMarker.bindTooltip(
      'Destination',
      {
        direction: 'top',
        offset: [
          0,
          -38,
        ],
        className:
          'cm-label',
      }
    )

    destinationMarker.addTo(
      map
    )

    destinationMarkerRef.current =
      destinationMarker

    map.flyTo(
      [
        latitude,
        longitude,
      ],
      18,
      {
        animate: true,
        duration: 0.9,
      }
    )
  }, [
    destinationId,
    places,
    showBuildings,
  ])

  /*
   * SEARCH
   */
  const normalizedQuery =
    normalizeSearchText(
      searchQuery
    )

  const searchResults =
    useMemo(() => {
      if (
        normalizedQuery.length ===
        0
      ) {
        return []
      }

      return places
        .map((place) => {
          const name =
            normalizeSearchText(
              place.name
            )

          const category =
            normalizeSearchText(
              place.category
            )

          const description =
            normalizeSearchText(
              place.description
            )

          const fieldNotes =
            normalizeSearchText(
              place.field_notes
            )

          const faculty =
            normalizeSearchText(
              place.faculty
            )

          const department =
            normalizeSearchText(
              place.department
            )

          let score = 0

          if (
            name ===
            normalizedQuery
          ) {
            score += 100
          }

          if (
            name.startsWith(
              normalizedQuery
            )
          ) {
            score += 60
          }

          if (
            name.includes(
              normalizedQuery
            )
          ) {
            score += 40
          }

          if (
            category.includes(
              normalizedQuery
            )
          ) {
            score += 25
          }

          if (
            faculty.includes(
              normalizedQuery
            )
          ) {
            score += 25
          }

          if (
            department.includes(
              normalizedQuery
            )
          ) {
            score += 25
          }

          if (
            description.includes(
              normalizedQuery
            )
          ) {
            score += 10
          }

          if (
            fieldNotes.includes(
              normalizedQuery
            )
          ) {
            score += 5
          }

          return {
            place,
            score,
          }
        })
        .filter(
          (item) =>
            item.score > 0
        )
        .sort(
          (a, b) =>
            b.score - a.score ||
            a.place.name.localeCompare(
              b.place.name
            )
        )
        .slice(0, 8)
        .map(
          (item) =>
            item.place
        )
    }, [
      places,
      normalizedQuery,
    ])

  /*
   * SELECT BUILDING
   */
  function selectPlace(place) {
    const map = mapRef.current

    if (!map) {
      return
    }

    const latitude = Number(
      place.latitude
    )

    const longitude = Number(
      place.longitude
    )

    if (
      !Number.isFinite(
        latitude
      ) ||
      !Number.isFinite(
        longitude
      )
    ) {
      return
    }

    setSelectedPlace(place)
    setSearchQuery('')
    setShowSearch(false)

    if (!showBuildings) {
      setShowBuildings(true)
    }

    map.flyTo(
      [
        latitude,
        longitude,
      ],
      18,
      {
        animate: true,
        duration: 0.7,
      }
    )

    setTimeout(() => {
      const marker =
        placeMarkersRef.current.get(
          place.id
        )

      if (marker) {
        marker.openTooltip()
      }
    }, 700)
  }

  /*
   * FIT CAMPUS
   */
  function fitCampus() {
    const map = mapRef.current

    if (!map) {
      return
    }

    const points = []

    if (showBuildings) {
      places.forEach(
        (place) => {
          const lat = Number(
            place.latitude
          )

          const lng = Number(
            place.longitude
          )

          if (
            Number.isFinite(
              lat
            ) &&
            Number.isFinite(
              lng
            )
          ) {
            points.push([
              lat,
              lng,
            ])
          }
        }
      )
    }

    if (showRoads) {
      roads.forEach(
        (road) => {
          if (
            !Array.isArray(
              road.geometry
            )
          ) {
            return
          }

          road.geometry.forEach(
            (point) => {
              if (
                Array.isArray(
                  point
                ) &&
                Number.isFinite(
                  Number(
                    point[0]
                  )
                ) &&
                Number.isFinite(
                  Number(
                    point[1]
                  )
                )
              ) {
                points.push([
                  Number(
                    point[0]
                  ),
                  Number(
                    point[1]
                  ),
                ])
              }
            }
          )
        }
      )
    }

    if (points.length > 0) {
      map.fitBounds(
        L.latLngBounds(points),
        {
          padding: [
            50,
            50,
          ],
          maxZoom: 18,
        }
      )

      return
    }

    if (currentCampus) {
      map.setView(
        [
          Number(
            currentCampus.center_lat
          ),
          Number(
            currentCampus.center_lng
          ),
        ],
        16
      )
    }
  }

  /*
   * MY LOCATION
   */
  function goToMyLocation() {
    const map = mapRef.current

    const location =
      lastUserLocationRef.current

    if (!map) {
      return
    }

    if (!location) {
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
        duration: 0.7,
      }
    )
  }

  /*
   * SELECTED PLACE DISTANCE
   */
  const selectedDistance =
    selectedPlace &&
    lastUserLocationRef.current
      ? calculateStraightLineDistance(
          lastUserLocationRef.current,
          [
            Number(
              selectedPlace.latitude
            ),
            Number(
              selectedPlace.longitude
            ),
          ]
        )
      : null

  /*
   * CLOSE SELECTED PLACE
   */
  function closeSelectedPlace() {
    setSelectedPlace(null)

    if (
      destinationMarkerRef.current
    ) {
      destinationMarkerRef.current.remove()
      destinationMarkerRef.current =
        null
    }
  }

  return (
    <>
      <Header
        title="CampusMapper"
        backTo="/"
        action={
          <Link
            to="/road-mapper"
            className="header-link"
          >
            + Road
          </Link>
        }
      />

      <main className="cm-map-page">
        {/* TOP CAMPUS BAR */}
        <div className="cm-map-topbar">
          <div className="cm-campus-context">
            <span className="cm-campus-pin">
              📍
            </span>

            <div>
              <span className="cm-campus-label">
                Campus
              </span>

              <strong>
                {currentCampus?.name ||
                  'Campus Map'}
              </strong>
            </div>
          </div>

          <button
            type="button"
            className="cm-search-trigger"
            onClick={() =>
              setShowSearch(true)
            }
            aria-label="Search campus"
          >
            🔎
          </button>
        </div>

        {/* MAP */}
        <section className="cm-map-shell">
          <div
            ref={mapElementRef}
            className="cm-main-map"
          />

          {/* SEARCH OVERLAY */}
          {showSearch && (
            <div className="cm-search-overlay">
              <div className="cm-search-box">
                <button
                  type="button"
                  className="cm-search-back"
                  onClick={() => {
                    setShowSearch(false)
                    setSearchQuery('')
                  }}
                  aria-label="Close search"
                >
                  ←
                </button>

                <input
                  autoFocus
                  type="search"
                  value={searchQuery}
                  onChange={(event) =>
                    setSearchQuery(
                      event.target.value
                    )
                  }
                  placeholder="Where are you going?"
                  aria-label="Search campus locations"
                />

                {searchQuery && (
                  <button
                    type="button"
                    className="cm-search-clear"
                    onClick={() =>
                      setSearchQuery('')
                    }
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>

              {normalizedQuery && (
                <div className="cm-search-results">
                  {searchResults.length > 0 ? (
                    searchResults.map(
                      (place) => (
                        <button
                          key={place.id}
                          type="button"
                          className="cm-search-result"
                          onClick={() =>
                            selectPlace(
                              place
                            )
                          }
                        >
                          <span className="cm-result-icon">
                            🏢
                          </span>

                          <span>
                            <strong>
                              {place.name}
                            </strong>

                            <small>
                              {place.category ||
                                'Location'}

                              {place.department
                                ? ` • ${place.department}`
                                : ''}
                            </small>
                          </span>

                          <span className="cm-result-arrow">
                            →
                          </span>
                        </button>
                      )
                    )
                  ) : (
                    <div className="cm-no-results">
                      <span>🔎</span>

                      <strong>
                        No matching locations
                      </strong>

                      <small>
                        Try a building,
                        department, hall or
                        landmark.
                      </small>
                    </div>
                  )}
                </div>
              )}

              {!normalizedQuery && (
                <div className="cm-search-hint">
                  <span>
                    🔎
                  </span>

                  <div>
                    <strong>
                      Find your way around campus
                    </strong>

                    <small>
                      Search for buildings,
                      departments, halls,
                      libraries and more.
                    </small>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FLOATING CONTROLS */}
          {!showSearch && (
            <div className="cm-floating-controls">
              <button
                type="button"
                className="cm-floating-button"
                onClick={
                  goToMyLocation
                }
                title="My location"
                aria-label="Go to my location"
              >
                📍
              </button>

              <button
                type="button"
                className="cm-floating-button"
                onClick={
                  fitCampus
                }
                title="Fit campus"
                aria-label="Fit campus"
              >
                ⛶
              </button>

              <button
                type="button"
                className={
                  `cm-floating-button ${
                    showLayers
                      ? 'is-active'
                      : ''
                  }`
                }
                onClick={() =>
                  setShowLayers(
                    (value) =>
                      !value
                  )
                }
                title="Map layers"
                aria-label="Map layers"
              >
                ☰
              </button>
            </div>
          )}

          {/* LAYERS MENU */}
          {showLayers && (
            <div className="cm-layer-menu">
              <strong>
                Map
              </strong>

              <label>
                <input
                  type="checkbox"
                  checked={
                    showBuildings
                  }
                  onChange={(event) =>
                    setShowBuildings(
                      event.target.checked
                    )
                  }
                />

                <span>
                  🏢 Buildings
                </span>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={
                    showRoads
                  }
                  onChange={(event) =>
                    setShowRoads(
                      event.target.checked
                    )
                  }
                />

                <span>
                  🛣️ Campus roads
                </span>
              </label>

              <div className="cm-layer-status">
                <span className="cm-live-dot" />
                {locationStatus}
              </div>
            </div>
          )}

          {/* MAP STATUS */}
          {loading && (
            <div className="cm-map-loading">
              <span className="cm-spinner" />
              Loading campus...
            </div>
          )}

          {error && (
            <div
              className="cm-map-error"
              role="alert"
            >
              <strong>
                Could not load campus
              </strong>

              <button
                type="button"
                onClick={
                  loadMapData
                }
              >
                Try again
              </button>
            </div>
          )}

          {/* SELECTED BUILDING CARD */}
          {selectedPlace && (
            <div className="cm-place-card">
              <button
                type="button"
                className="cm-place-close"
                onClick={
                  closeSelectedPlace
                }
                aria-label="Close building card"
              >
                ×
              </button>

              {selectedPlace.cover_image && (
                <img
                  src={
                    selectedPlace.cover_image
                  }
                  alt={
                    selectedPlace.name
                  }
                  className="cm-place-image"
                />
              )}

              <div className="cm-place-content">
                <div className="cm-place-heading">
                  <span className="cm-place-icon">
                    🏢
                  </span>

                  <div>
                    <strong>
                      {selectedPlace.name}
                    </strong>

                    <span>
                      {selectedPlace.category ||
                        'Campus location'}
                    </span>
                  </div>
                </div>

                <div className="cm-place-meta">
                  {selectedDistance !==
                    null && (
                    <span>
                      📍{' '}
                      {formatDistance(
                        selectedDistance
                      )}{' '}
                      away
                    </span>
                  )}

                  {selectedPlace.faculty && (
                    <span>
                      🎓{' '}
                      {
                        selectedPlace.faculty
                      }
                    </span>
                  )}
                </div>

                <div className="cm-place-actions">
                  <Link
                    to={`/navigation?place=${selectedPlace.id}`}
                    className="cm-direction-button"
                  >
                    🧭 Get Directions
                  </Link>

                  <Link
                    to={`/location/${selectedPlace.id}`}
                    className="cm-details-button"
                  >
                    Details →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* SMALL INFORMATION BAR */}
        <div className="cm-map-info">
          <span>
            <strong>
              {places.length}
            </strong>{' '}
            locations
          </span>

          <span className="cm-info-divider">
            •
          </span>

          <span>
            <strong>
              {roads.length}
            </strong>{' '}
            mapped roads
          </span>

          <span className="cm-info-spacer" />

          <span
            className={
              locationStatus
                .toLowerCase()
                .includes('good')
                ? 'cm-location-good'
                : ''
            }
          >
            <span className="cm-live-dot" />
            {locationStatus}
          </span>
        </div>
      </main>
    </>
  )
}