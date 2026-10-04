import { useEffect, useRef } from 'react'
import L from 'leaflet'

// A custom pin drawn with CSS, so we do not depend on Leaflet's image files.
const pinIcon = L.divIcon({
  className: 'cm-pin',
  html: '<span></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 31],
  popupAnchor: [0, -30],
})

function buildPopup(place, onSelect) {
  const wrap = document.createElement('div')
  wrap.className = 'cm-popup'

  if (place.cover_image) {
    const img = document.createElement('img')
    img.src = place.cover_image
    img.alt = ''
    wrap.appendChild(img)
  }
  const title = document.createElement('strong')
  title.textContent = place.name
  wrap.appendChild(title)

  const meta = document.createElement('span')
  meta.textContent = place.category || 'Uncategorised'
  wrap.appendChild(meta)

  if (onSelect) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = 'Open record'
    btn.addEventListener('click', () => onSelect(place))
    wrap.appendChild(btn)
  }
  return wrap
}

// places: array of place records
// center: [lat, lng] used when there are no places yet
export default function MapView({ places, center, height = '60vh', onSelect }) {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)

  // Create the map once
  useEffect(() => {
    const map = L.map(elRef.current).setView(center || [0, 0], 16)

    const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    })
    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Imagery &copy; Esri' }
    )
    street.addTo(map)
    L.control.layers({ Street: street, Satellite: satellite }, null, { position: 'topright' }).addTo(map)

    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redraw markers whenever the list of places changes
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    layer.clearLayers()
    const showLabels = places.length <= 30

    places.forEach((place) => {
      const marker = L.marker([place.latitude, place.longitude], { icon: pinIcon, title: place.name })
      marker.bindTooltip(place.name, {
        permanent: showLabels,
        direction: 'top',
        offset: [0, -32],
        className: 'cm-label',
      })
      marker.bindPopup(buildPopup(place, onSelect), { minWidth: 180 })
      marker.addTo(layer)
    })

    if (places.length > 1) {
      const bounds = L.latLngBounds(places.map((p) => [p.latitude, p.longitude]))
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 18 })
    } else if (places.length === 1) {
      map.setView([places[0].latitude, places[0].longitude], 18)
    } else if (center) {
      map.setView(center, 16)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places])

  return <div ref={elRef} className="map" style={{ height }} />
}
