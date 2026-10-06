// CampusMapper road matching utilities.
// This first version compares GPS routes against reference
// road geometry using point-to-segment distance.

const EARTH_RADIUS = 6371000

function toRadians(value) {
  return (value * Math.PI) / 180
}

// Distance between two latitude/longitude points.
export function distanceBetweenPoints(a, b) {
  const lat1 = toRadians(a[0])
  const lat2 = toRadians(b[0])

  const deltaLat = toRadians(b[0] - a[0])
  const deltaLng = toRadians(b[1] - a[1])

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

  return EARTH_RADIUS * c
}

// Approximate a lat/lng coordinate in local metres.
function projectPoint(point, referenceLat) {
  const lat = toRadians(point[0])
  const lng = toRadians(point[1])
  const refLat = toRadians(referenceLat)

  return {
    x: lng * EARTH_RADIUS * Math.cos(refLat),
    y: lat * EARTH_RADIUS,
  }
}

// Distance from a GPS point to a reference road segment.
export function pointToSegmentDistance(
  point,
  start,
  end
) {
  const referenceLat = point[0]

  const p = projectPoint(
    point,
    referenceLat
  )

  const a = projectPoint(
    start,
    referenceLat
  )

  const b = projectPoint(
    end,
    referenceLat
  )

  const dx = b.x - a.x
  const dy = b.y - a.y

  if (dx === 0 && dy === 0) {
    return Math.sqrt(
      (p.x - a.x) ** 2 +
        (p.y - a.y) ** 2
    )
  }

  const t =
    ((p.x - a.x) * dx +
      (p.y - a.y) * dy) /
    (dx * dx + dy * dy)

  const clampedT = Math.max(
    0,
    Math.min(1, t)
  )

  const closestX =
    a.x + clampedT * dx

  const closestY =
    a.y + clampedT * dy

  return Math.sqrt(
    (p.x - closestX) ** 2 +
      (p.y - closestY) ** 2
  )
}

// Find the closest distance from one GPS point
// to an entire reference road.
export function pointToRoadDistance(
  point,
  roadGeometry
) {
  if (
    !Array.isArray(roadGeometry) ||
    roadGeometry.length < 2
  ) {
    return Infinity
  }

  let minimum = Infinity

  for (
    let i = 1;
    i < roadGeometry.length;
    i++
  ) {
    const distance =
      pointToSegmentDistance(
        point,
        roadGeometry[i - 1],
        roadGeometry[i]
      )

    if (distance < minimum) {
      minimum = distance
    }
  }

  return minimum
}

// Analyse a recorded GPS route against reference roads.
//
// thresholdMeters:
// Maximum distance at which a GPS point is considered
// to overlap an existing road.
export function analyseRoadOverlap(
  recordedPoints,
  referenceRoads,
  thresholdMeters = 12
) {
  if (
    !Array.isArray(recordedPoints) ||
    recordedPoints.length === 0
  ) {
    return {
      totalPoints: 0,
      matchedPoints: 0,
      unmatchedPoints: 0,
      overlapPercent: 0,
      newPercent: 0,
      matchedPointsList: [],
      unmatchedPointsList: [],
    }
  }

  const matchedPointsList = []
  const unmatchedPointsList = []

  recordedPoints.forEach((point) => {
    let closestDistance = Infinity

    for (const road of referenceRoads || []) {
      const distance =
        pointToRoadDistance(
          point,
          road.geometry
        )

      if (distance < closestDistance) {
        closestDistance = distance
      }
    }

    if (
      closestDistance <= thresholdMeters
    ) {
      matchedPointsList.push({
        point,
        distanceMeters:
          Math.round(
            closestDistance * 10
          ) / 10,
      })
    } else {
      unmatchedPointsList.push({
        point,
        distanceMeters:
          Math.round(
            closestDistance * 10
          ) / 10,
      })
    }
  })

  const totalPoints =
    recordedPoints.length

  const matchedPoints =
    matchedPointsList.length

  const unmatchedPoints =
    unmatchedPointsList.length

  const overlapPercent =
    totalPoints > 0
      ? Math.round(
          (matchedPoints /
            totalPoints) *
            1000
        ) / 10
      : 0

  const newPercent =
    Math.round(
      (100 - overlapPercent) *
        10
    ) / 10

  return {
    totalPoints,
    matchedPoints,
    unmatchedPoints,
    overlapPercent,
    newPercent,
    matchedPointsList,
    unmatchedPointsList,
  }
}

// Extract the unmatched GPS points.
//
// These are the points that are potentially new
// road geometry.
export function extractNewRoadPoints(
  analysis
) {
  if (
    !analysis ||
    !Array.isArray(
      analysis.unmatchedPointsList
    )
  ) {
    return []
  }

  return analysis.unmatchedPointsList.map(
    (item) => item.point
  )
}