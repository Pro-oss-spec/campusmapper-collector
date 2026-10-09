
import { supabase } from './supabase'

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function checkSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Check your .env settings.'
    )
  }
}

function normalizeRoad(row) {
  if (!row) return null

  return {
    ...row,
    campus: row.campuses || null,
  }
}

function validateRoadId(id) {
  if (id === undefined || id === null || id === '') {
    throw new Error('A valid road ID is required.')
  }
}

function prepareRoadValues(values) {
  if (!values || typeof values !== 'object') {
    throw new Error('Road information is missing.')
  }

  const name = String(values.name || '').trim()

  if (!name) {
    throw new Error('Enter a name for this road.')
  }

  if (!values.campusId) {
    throw new Error('Select a campus before saving the road.')
  }

  if (
    !Array.isArray(values.geometry) ||
    values.geometry.length < 2
  ) {
    throw new Error(
      'Record at least two GPS points before saving the road.'
    )
  }

  const geometry = values.geometry.map((point) => {
    if (
      !Array.isArray(point) ||
      point.length < 2 ||
      !Number.isFinite(Number(point[0])) ||
      !Number.isFinite(Number(point[1]))
    ) {
      throw new Error('The road contains an invalid GPS point.')
    }

    const lat = Number(point[0])
    const lng = Number(point[1])

    if (
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      throw new Error('A GPS point is outside valid coordinates.')
    }

    return [lat, lng]
  })

  const distance = Number(values.distanceMeters ?? 0)

  return {
    campus_id: values.campusId,
    name,
    road_type: String(values.roadType || 'Road'),
    description: String(values.description || '').trim() || null,
    field_notes: String(values.fieldNotes || '').trim() || null,
    distance_meters:
      Number.isFinite(distance) && distance >= 0 ? distance : 0,
    geometry,
  }
}

function reportError(action, error) {
  console.error(`[Roads] ${action} failed:`, error)
  throw error
}

// --------------------------------------------------
// GET ALL ROADS
// --------------------------------------------------

export async function fetchRoads() {
  try {
    checkSupabase()

    const { data, error } = await supabase
      .from('road_segments')
      .select(`
        *,
        campuses (
          id,
          name,
          center_lat,
          center_lng
        )
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (Array.isArray(data) ? data : [])
      .map(normalizeRoad)
      .filter(Boolean)
  } catch (error) {
    reportError('Fetching roads', error)
  }
}

// --------------------------------------------------
// GET ONE ROAD
// --------------------------------------------------

export async function fetchRoad(id) {
  try {
    checkSupabase()
    validateRoadId(id)

    const { data, error } = await supabase
      .from('road_segments')
      .select(`
        *,
        campuses (
          id,
          name,
          center_lat,
          center_lng
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    return normalizeRoad(data)
  } catch (error) {
    reportError('Fetching road', error)
  }
}

// --------------------------------------------------
// CREATE ROAD
// --------------------------------------------------

export async function createRoad(values) {
  try {
    checkSupabase()

    const roadValues = prepareRoadValues(values)

    const { data, error } = await supabase
      .from('road_segments')
      .insert(roadValues)
      .select()
      .single()

    if (error) throw error

    return data
  } catch (error) {
    reportError('Creating road', error)
  }
}

// --------------------------------------------------
// UPDATE ROAD
// --------------------------------------------------

export async function updateRoad(id, values) {
  try {
    checkSupabase()
    validateRoadId(id)

    const roadValues = prepareRoadValues(values)

    const { data, error } = await supabase
      .from('road_segments')
      .update(roadValues)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return data
  } catch (error) {
    reportError('Updating road', error)
  }
}

// --------------------------------------------------
// DELETE ROAD
// --------------------------------------------------

export async function deleteRoad(id) {
  try {
    checkSupabase()
    validateRoadId(id)

    const { error } = await supabase
      .from('road_segments')
      .delete()
      .eq('id', id)

    if (error) throw error
  } catch (error) {
    reportError('Deleting road', error)
  }
}

// --------------------------------------------------
// HAVERSINE DISTANCE
// Points use [latitude, longitude].
// --------------------------------------------------

export function distanceBetweenPoints(a, b) {
  if (
    !Array.isArray(a) ||
    !Array.isArray(b) ||
    a.length < 2 ||
    b.length < 2
  ) {
    return 0
  }

  const latA = Number(a[0])
  const lngA = Number(a[1])
  const latB = Number(b[0])
  const lngB = Number(b[1])

  if (
    ![latA, lngA, latB, lngB].every(Number.isFinite) ||
    Math.abs(latA) > 90 ||
    Math.abs(latB) > 90 ||
    Math.abs(lngA) > 180 ||
    Math.abs(lngB) > 180
  ) {
    return 0
  }

  const earthRadius = 6371000
  const toRadians = (degrees) => (degrees * Math.PI) / 180

  const deltaLat = toRadians(latB - latA)
  const deltaLng = toRadians(lngB - lngA)

  const lat1 = toRadians(latA)
  const lat2 = toRadians(latB)

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) ** 2

  const safeValue = Math.max(0, Math.min(1, haversine))

  return (
    2 *
    earthRadius *
    Math.atan2(
      Math.sqrt(safeValue),
      Math.sqrt(1 - safeValue)
    )
  )
}

// --------------------------------------------------
// TOTAL ROUTE DISTANCE
// --------------------------------------------------

export function calculateRouteDistance(points) {
  if (!Array.isArray(points) || points.length < 2) {
    return 0
  }

  let total = 0

  for (let i = 1; i < points.length; i++) {
    total += distanceBetweenPoints(points[i - 1], points[i])
  }

  return Math.round(total * 10) / 10
}
