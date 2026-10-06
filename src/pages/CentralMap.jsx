import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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

function formatDistance(meters) {
  if (!meters || meters < 1) {
    return '0 m'
  }

  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`
  }

  return `${Math.round(meters)} m`
}

export default function CentralMap() {
  const { currentCampus } = useApp()

  const mapElementRef = useRef(null)
  const mapRef = useRef(null)

  const buildingLayerRef = useRef(null)
  const roadLayerRef = useRef(null)

  const [places, setPlaces] = useState([])
  const [roads, setRoads] = useState([])

  const [showBuildings, setShowBuildings] = useState(true)
  const [showRoads, setShowRoads] = useState(true)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // --------------------------------------------------
  // LOAD CAMPUS DATA
  // --------------------------------------------------

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

  // --------------------------------------------------
  // CREATE MAP
  // --------------------------------------------------

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return
    }

    const center = currentCampus
      ? [
          currentCampus.center_lat,
          currentCampus.center_lng,
        ]
      : [0, 0]

    const map = L.map(mapElementRef.current).setView(
      center,
      16
    )

    // ----------------------------------------------
    // STREET REFERENCE MAP
    // ----------------------------------------------

    const street = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution:
          '&copy; OpenStreetMap contributors',
      }
    )

    // ----------------------------------------------
    // SATELLITE REFERENCE MAP
    // ----------------------------------------------

    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution:
          'Imagery &copy; Esri',
      }
    )

    street.addTo(map)

    // ----------------------------------------------
    // BASEMAP SWITCHER
    // ----------------------------------------------

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

    // ----------------------------------------------
    // DATA LAYERS
    // ----------------------------------------------

    buildingLayerRef.current =
      L.layerGroup().addTo(map)

    roadLayerRef.current =
      L.layerGroup().addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // --------------------------------------------------
  // DRAW BUILDINGS
  // --------------------------------------------------

  useEffect(() => {
    const layer = buildingLayerRef.current

    if (!layer) {
      return
    }

    layer.clearLayers()

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

      marker.bindTooltip(place.name, {
        permanent: places.length <= 30,
        direction: 'top',
        offset: [0, -32],
        className: 'cm-label',
      })

      const popup = document.createElement('div')
      popup.className = 'cm-popup'

      if (place.cover_image) {
        const image = document.createElement('img')

        image.src = place.cover_image
        image.alt = ''

        popup.appendChild(image)
      }

      const title = document.createElement('strong')

      title.textContent = place.name

      popup.appendChild(title)

      const category = document.createElement('span')

      category.textContent =
        place.category || 'Location'

      popup.appendChild(category)

      const link = document.createElement('a')

      link.href =
        '#/location/' + place.id

      link.textContent = 'Open location'

      link.className = 'cm-popup-link'

      popup.appendChild(link)

      marker.bindPopup(popup, {
        minWidth: 180,
      })

      marker.addTo(layer)
    })
  }, [places, showBuildings])

  // --------------------------------------------------
  // DRAW CAMPUSMAPPER ROADS
  // --------------------------------------------------

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

      const validPoints = road.geometry.filter(
        (point) =>
          Array.isArray(point) &&
          point.length >= 2 &&
          Number.isFinite(Number(point[0])) &&
          Number.isFinite(Number(point[1]))
      )

      if (validPoints.length < 2) {
        return
      }

      const line = L.polyline(validPoints, {
        weight: 6,
        opacity: 0.9,
      })

      line.bindTooltip(
        `🛣️ ${road.name || 'CampusMapper Road'}`,
        {
          sticky: true,
          className: 'cm-label',
        }
      )

      const popup = document.createElement('div')

      popup.className = 'cm-popup'

      const title =
        document.createElement('strong')

      title.textContent =
        '🛣️ ' +
        (road.name || 'Unnamed Road')

      popup.appendChild(title)

      const type =
        document.createElement('span')

      type.textContent =
        road.road_type || 'Road'

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

        popup.appendChild(description)
      }

      line.bindPopup(popup, {
        minWidth: 180,
      })

      line.addTo(layer)
    })
  }, [roads, showRoads])

  // --------------------------------------------------
  // FIT MAP
  // --------------------------------------------------

  function fitCampus() {
    const map = mapRef.current

    if (!map) {
      return
    }

    const points = []

    if (showBuildings) {
      places.forEach((place) => {
        if (
          Number.isFinite(Number(place.latitude)) &&
          Number.isFinite(Number(place.longitude))
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
        if (!Array.isArray(road.geometry)) {
          return
        }

        road.geometry.forEach((point) => {
          if (
            Array.isArray(point) &&
            Number.isFinite(Number(point[0])) &&
            Number.isFinite(Number(point[1]))
          ) {
            points.push([
              Number(point[0]),
              Number(point[1]),
            ])
          }
        })
      })
    }

    if (points.length > 0) {
      const bounds =
        L.latLngBounds(points)

      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 18,
      })

      return
    }

    if (currentCampus) {
      map.setView(
        [
          currentCampus.center_lat,
          currentCampus.center_lng,
        ],
        16
      )
    }
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

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
              justifyContent: 'space-between',
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
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={fitCampus}
            >
              Fit Campus
            </button>
          </div>
        </section>

        {/* ---------------------------------------- */}
        {/* MAP LAYERS */}
        {/* ---------------------------------------- */}

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
            The reference map shows existing mapped
            roads. CampusMapper roads are drawn on top.
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