// OpenStreetMap road reference loader.
// Fetches existing road geometry from the Overpass API.

const OVERPASS_URL =
  'https://overpass-api.de/api/interpreter'

function validateNumber(value, name) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    throw new Error(`Invalid ${name}`)
  }

  return number
}

// Fetch roads inside a campus bounding box.
//
// south / west / north / east are decimal GPS coordinates.
export async function fetchOsmRoads({
  south,
  west,
  north,
  east,
}) {
  south = validateNumber(south, 'south')
  west = validateNumber(west, 'west')
  north = validateNumber(north, 'north')
  east = validateNumber(east, 'east')

  if (south >= north) {
    throw new Error(
      'South latitude must be smaller than north latitude'
    )
  }

  if (west >= east) {
    throw new Error(
      'West longitude must be smaller than east longitude'
    )
  }

  const query = `
    [out:json][timeout:25];

    (
      way["highway"](${south},${west},${north},${east});
    );

    out geom;
  `

  const response = await fetch(
    `${OVERPASS_URL}?data=${encodeURIComponent(query)}`
  )

  if (!response.ok) {
    throw new Error(
      `OpenStreetMap request failed (${response.status})`
    )
  }

  const data = await response.json()

  return (data.elements || [])
    .filter(
      (element) =>
        element.type === 'way' &&
        Array.isArray(element.geometry) &&
        element.geometry.length >= 2
    )
    .map((element) => ({
      id: element.id,

      name:
        element.tags?.name ||
        'Unnamed road',

      highway:
        element.tags?.highway ||
        'road',

      geometry: element.geometry.map(
        (point) => [
          point.lat,
          point.lon,
        ]
      ),
    }))
}