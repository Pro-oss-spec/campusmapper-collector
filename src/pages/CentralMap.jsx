import { useEffect, useRef, useState } from 'react'
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
    const kilometers = (meters / 1000).toFixed(2)
    return kilometers + ' km'
  }

  return Math.round(meters) + ' m'
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
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
      setSearchQuery('')
    } catch (err) {
      setError(
        err.message || 'Could not load campus map data'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMapData()
  }, [currentCampus?.id])

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return
    }

    const campusLat = Number(currentCampus?.center_lat)
    const campusLng = Number(currentCampus?.center_lng)

    const center =
      Number.isFinite(campusLat) &&
      Number.isFinite(campusLng)
        ? [campusLat, campusLng]
        : [0, 0]

    const map = L.map(mapElementRef.current).setView(
      center,
      16
    )

    const street = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution:
          '&copy; OpenStreetMap contributors',
      }
    )

    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Imagery &copy; Esri',
      }
    )

    street.addTo(map)

    L.control
      .layers(
        {
          '🗺️ Street Map': street,
          '🛰️ Satellite': satellite,
        },
        null,
        {
          position: 'topright',
        }
      )
      .addTo(map)

    buildingLayerRef.current =
      L.layerGroup().addTo(map)

    roadLayerRef.current =
      L.layerGroup().addTo(map)

    mapRef.current = map

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
      destinationMarkerRef.current = null
      placeMarkersRef.current.clear()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current

    if (!map || !currentCampus) {
      return
    }

    const latitude = Number(currentCampus.center_lat)
    const longitude = Number(currentCampus.center_lng)

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
            Number.isFinite(accuracy) && accuracy > 0
              ? accuracy
              : 10

          const userLocation = [
            latitude,
            longitude,
          ]

          lastUserLocationRef.current =
            userLocation

          setLocationStatus(
            'Location detected'
          )

          if (!userMarkerRef.current) {
            userMarkerRef.current =
              L.circleMarker(
                userLocation,
                {
                  radius: 9,
                  color: '#ffffff',
                  weight: 3,
                  fillColor: '#1976ff',
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

          if (!userAccuracyRef.current) {
            userAccuracyRef.current =
              L.circle(
                userLocation,
                {
                  radius: Math.max(
                    safeAccuracy,
                    5
                  ),
                  color: '#1976ff',
                  weight: 1,
                  fillColor: '#1976ff',
                  fillOpacity: 0.08,
                }
              ).addTo(map)
          } else {
            userAccuracyRef.current.setLatLng(
              userLocation
            )

            userAccuracyRef.current.setRadius(
              Math.max(safeAccuracy, 5)
            )
          }

          if (
            !hasFittedUserLocationRef.current &&
            currentCampus
          ) {
            const campusLat = Number(
              currentCampus.center_lat
            )

            const campusLng = Number(
              currentCampus.center_lng
            )

            if (
              Number.isFinite(campusLat) &&
              Number.isFinite(campusLng)
            ) {
              const bounds =
                L.latLngBounds([
                  [campusLat, campusLng],
                  userLocation,
                ])

              map.fitBounds(bounds, {
                padding: [70, 70],
                maxZoom: 16,
              })

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

          if (geoError.code === 1) {
            setLocationStatus(
              'Location permission was denied.'
            )
          } else if (geoError.code === 2) {
            setLocationStatus(
              'Your location could not be determined.'
            )
          } else if (geoError.code === 3) {
            setLocationStatus(
              'Location request timed out.'
            )
          } else {
            setLocationStatus(
              'Could not detect your location.'
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

      lastUserLocationRef.current = null
      hasFittedUserLocationRef.current = false
    }
  }, [currentCampus])

  useEffect(() => {
    const layer = buildingLayerRef.current

    if (!layer) {
      return
    }

    layer.clearLayers()
    placeMarkersRef.current.clear()

    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove()
      destinationMarkerRef.current = null
    }

    if (!showBuildings) {
      return
    }

    places.forEach((place) => {
      if (
        !Number.isFinite(Number(place.latitude)) ||
        !Number.isFinite(Number(place.longitude))
      ) {
        return
      }

      const marker = L.marker(
        [
          Number(place.latitude),
          Number(place.longitude),
        ],
        {
          icon: pinIcon,
          title: place.name,
        }
      )

      marker.bindTooltip(
        place.name,
        {
          permanent: places.length <= 30,
          direction: 'top',
          offset: [0, -32],
          className: 'cm-label',
        }
      )

      const popup =
        document.createElement('div')

      popup.className = 'cm-popup'

      if (place.cover_image) {
        const image =
          document.createElement('img')

        image.src = place.cover_image
        image.alt = place.name || 'Location'

        popup.appendChild(image)
      }

      const title =
        document.createElement('strong')

      title.textContent = place.name

      popup.appendChild(title)

      const category =
        document.createElement('span')

      category.textContent =
        place.category || 'Location'

      popup.appendChild(category)

      const link =
        document.createElement('a')

      link.href =
        '#/location/' + place.id

      link.textContent =
        'Open location'

      link.className =
        'cm-popup-link'

      popup.appendChild(link)

      marker.bindPopup(
        popup,
        {
          minWidth: 180,
        }
      )

      marker.addTo(layer)

      placeMarkersRef.current.set(
        place.id,
        marker
      )
    })
  }, [places, showBuildings])

  useEffect(() => {
    const layer = roadLayerRef.current

    if (!layer) {
      return
    }

    layer.clearLayers()

    if (!showRoads) {
      return
    }

    roads.forEach((road) => {
      if (
        !Array.isArray(road.geometry) ||
        road.geometry.length < 2
      ) {
        return
      }

      const validPoints =
        road.geometry.filter(
          (point) =>
            Array.isArray(point) &&
            point.length >= 2 &&
            Number.isFinite(Number(point[0])) &&
            Number.isFinite(Number(point[1]))
        )

      if (validPoints.length < 2) {
        return
      }

      const line =
        L.polyline(
          validPoints,
          {
            weight: 6,
            opacity: 0.9,
          }
        )

      line.bindTooltip(
        '🛣️ ' +
          (road.name ||
            'CampusMapper Road'),
        {
          sticky: true,
          className: 'cm-label',
        }
      )

      const popup =
        document.createElement('div')

      popup.className =
        'cm-popup'

      const title =
        document.createElement('strong')

      title.textContent =
        '🛣️ ' +
        (road.name ||
          'Unnamed Road')

      popup.appendChild(title)

      const type =
        document.createElement('span')

      type.textContent =
        road.road_type ||
        'Road'

      popup.appendChild(type)

      const distance =
        document.createElement('span')

      distance.textContent =
        formatDistance(
          road.distance_meters
        )

      popup.appendChild(distance)

      if (road.description) {
        const description =
          document.createElement('p')

        description.textContent =
          road.description

        popup.appendChild(
          description
        )
      }

      line.bindPopup(
        popup,
        {
          minWidth: 180,
        }
      )

      line.addTo(layer)
    })
  }, [roads, showRoads])

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
          place.id === destinationId
      )

    if (!destination) {
      return
    }

    const latitude = Number(
      destination.latitude
    )

    const longitude = Number(
      destination.longitude
    )

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return
    }

    setSelectedPlace(destination)

    if (!showBuildings) {
      setShowBuildings(true)
      return
    }

    const existingMarker =
      placeMarkersRef.current.get(
        destination.id
      )

    if (!existingMarker) {
      return
    }

    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove()
      destinationMarkerRef.current = null
    }

    const destinationMarker =
      L.marker(
        [latitude, longitude],
        {
          icon: destinationIcon,
          zIndexOffset: 1000,
          title:
            'Destination: ' +
            destination.name,
        }
      )

    destinationMarker.bindTooltip(
      'Destination',
      {
        direction: 'top',
        offset: [0, -38],
        className: 'cm-label',
      }
    )

    destinationMarker.addTo(map)

    destinationMarkerRef.current =
      destinationMarker

    map.flyTo(
      [latitude, longitude],
      18,
      {
        animate: true,
        duration: 0.9,
      }
    )

    const openPopup = () => {
      const marker =
        placeMarkersRef.current.get(
          destination.id
        )

      if (marker) {
        marker.openPopup()
      }
    }

    const timer =
      window.setTimeout(
        openPopup,
        950
      )

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    destinationId,
    places,
    showBuildings,
  ])

  const normalizedQuery =
    normalizeSearchText(searchQuery)

  const searchResults =
    normalizedQuery.length === 0
      ? []
      : places
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

            let score = 0

            if (name === normalizedQuery) {
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
            (item) => item.score > 0
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
            (item) => item.place
          )

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
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return
    }

    setSelectedPlace(place)

    if (!showBuildings) {
      setShowBuildings(true)
    }

    map.flyTo(
      [latitude, longitude],
      18,
      {
        animate: true,
        duration: 0.8,
      }
    )

    const openMarker = () => {
      const marker =
        placeMarkersRef.current.get(
          place.id
        )

      if (marker) {
        marker.openPopup()
      }
    }

    setTimeout(
      openMarker,
      850
    )
  }

  function clearSearch() {
    setSearchQuery('')
    setSelectedPlace(null)
  }

  function fitCampus() {
    const map = mapRef.current

    if (!map) {
      return
    }

    const points = []

    if (showBuildings) {
      places.forEach((place) => {
        if (
          Number.isFinite(
            Number(place.latitude)
          ) &&
          Number.isFinite(
            Number(place.longitude)
          )
        ) {
          points.push([
            Number(place.latitude),
            Number(place.longitude),
          ])
        }
      })
    }

    if (showRoads) {
      roads.forEach((road) => {
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
              Array.isArray(point) &&
              Number.isFinite(
                Number(point[0])
              ) &&
              Number.isFinite(
                Number(point[1])
              )
            ) {
              points.push([
                Number(point[0]),
                Number(point[1]),
              ])
            }
          }
        )
      })
    }

    if (points.length > 0) {
      const bounds =
        L.latLngBounds(points)

      map.fitBounds(
        bounds,
        {
          padding: [50, 50],
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

    map.setView(
      location,
      18,
      {
        animate: true,
      }
    )
  }

  return (
    <>
      <Header
        title="Central Campus Map"
        backTo="/"
        action={
          <Link
            to="/roads/new"
            className="header-link"
          >
            + Road
          </Link>
        }
      />

      <main className="page">
        <section className="panel">
          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <strong>
                {currentCampus?.name ||
                  'Campus Map'}
              </strong>

              <p
                className="muted"
                style={{
                  margin: '4px 0 0',
                }}
              >
                {places.length} locations •{' '}
                {roads.length} mapped roads
              </p>

              <p
                className="muted"
                style={{
                  margin: '4px 0 0',
                }}
              >
                📍 {locationStatus}
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={goToMyLocation}
              >
                📍 My Location
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={fitCampus}
              >
                Fit Campus
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <strong>
            Search Campus
          </strong>

          <div
            style={{
              position: 'relative',
              marginTop: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
              }}
            >
              <input
                type="search"
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(
                    e.target.value
                  )
                }
                placeholder="Search buildings, departments, halls..."
                aria-label="Search campus locations"
                style={{
                  width: '100%',
                  minHeight: '44px',
                  padding:
                    '10px 42px 10px 14px',
                  border:
                    '1px solid var(--line-dark)',
                  borderRadius: '10px',
                  background:
                    'var(--surface)',
                  color: 'var(--ink)',
                  fontSize: '16px',
                  outline: 'none',
                  boxSizing:
                    'border-box',
                }}
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear search"
                  style={{
                    position:
                      'absolute',
                    right: '10px',
                    top: '50%',
                    transform:
                      'translateY(-50%)',
                    border: 'none',
                    background:
                      'transparent',
                    color:
                      'var(--ink-soft)',
                    cursor: 'pointer',
                    fontSize: '20px',
                    lineHeight: 1,
                    width: '36px',
                    height: '36px',
                  }}
                >
                  ×
                </button>
              )}
            </div>

            {normalizedQuery && (
              <div
                style={{
                  marginTop: '8px',
                  border:
                    '1px solid var(--line)',
                  borderRadius: '10px',
                  background:
                    'var(--surface)',
                  overflow: 'hidden',
                }}
              >
                {searchResults.length > 0 ? (
                  <>
                    {searchResults.map(
                      (place) => (
                        <button
                          key={place.id}
                          type="button"
                          onClick={() =>
                            selectPlace(
                              place
                            )
                          }
                          style={{
                            display:
                              'block',
                            width: '100%',
                            textAlign:
                              'left',
                            border: 'none',
                            borderBottom:
                              '1px solid var(--line)',
                            background:
                              selectedPlace?.id ===
                              place.id
                                ? 'var(--primary-soft)'
                                : 'transparent',
                            color:
                              'var(--ink)',
                            padding:
                              '12px 14px',
                            cursor:
                              'pointer',
                          }}
                        >
                          <strong
                            style={{
                              display:
                                'block',
                              marginBottom:
                                '3px',
                            }}
                          >
                            📍 {place.name}
                          </strong>

                          <span
                            className="muted"
                            style={{
                              fontSize:
                                '13px',
                            }}
                          >
                            {place.category ||
                              'Location'}
                          </span>
                        </button>
                      )
                    )}

                    {searchResults.length ===
                      8 && (
                      <p
                        className="muted"
                        style={{
                          margin: 0,
                          padding:
                            '9px 14px',
                          fontSize:
                            '12px',
                          borderTop:
                            '1px solid var(--line)',
                        }}
                      >
                        Showing the best
                        matches. Keep typing
                        to narrow your search.
                      </p>
                    )}
                  </>
                ) : (
                  <p
                    className="muted"
                    style={{
                      margin: 0,
                      padding: '14px',
                    }}
                  >
                    No matching locations
                    found in{' '}
                    {currentCampus?.name ||
                      'this campus'}.
                  </p>
                )}
              </div>
            )}
          </div>

          <p
            className="muted"
            style={{
              marginTop: '10px',
              marginBottom: 0,
            }}
          >
            Try searching for a building,
            department, library, hall, bank,
            health centre, or category.
          </p>
        </section>

        <section className="panel">
          <strong>
            Map Layers
          </strong>

          <div
            style={{
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
              marginTop: '12px',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <input
                type="checkbox"
                checked={showBuildings}
                onChange={(e) =>
                  setShowBuildings(
                    e.target.checked
                  )
                }
              />

              🏢 Buildings
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <input
                type="checkbox"
                checked={showRoads}
                onChange={(e) =>
                  setShowRoads(
                    e.target.checked
                  )
                }
              />

              🛣️ CampusMapper Roads
            </label>
          </div>

          <p
            className="muted"
            style={{
              marginTop: '10px',
              marginBottom: 0,
            }}
          >
            The reference map shows existing
            mapped roads. CampusMapper roads
            are drawn on top.
          </p>
        </section>

        {loading && (
          <p className="muted">
            Loading campus map...
          </p>
        )}

        {error && (
          <div
            className="banner banner-error"
            role="alert"
          >
            {error}

            <button
              type="button"
              className="link-btn"
              onClick={loadMapData}
            >
              Try again
            </button>
          </div>
        )}

        <div
          ref={mapElementRef}
          className="map"
          style={{
            height: '70vh',
            minHeight: '500px',
          }}
        />
      </main>
    </>
  )
}