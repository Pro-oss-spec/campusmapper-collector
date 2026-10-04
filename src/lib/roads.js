import { supabase } from './supabase'

// Convert a database row into a convenient app object.
function normalizeRoad(row) {
  return {
    ...row,
    campus: row.campuses || null,
  }
}

// --------------------------------------------------
// GET ALL ROADS
// --------------------------------------------------

export async function fetchRoads() {
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

  return data.map(normalizeRoad)
}

// --------------------------------------------------
// GET ONE ROAD
// --------------------------------------------------

export async function fetchRoad(id) {
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
}

// --------------------------------------------------
// CREATE ROAD
// --------------------------------------------------

export async function createRoad(values) {
  const { data, error } = await supabase
    .from('road_segments')
    .insert({
      campus_id: values.campusId,
      name: values.name.trim(),
      road_type: values.roadType || 'Road',
      description: values.description?.trim() || null,
      field_notes: values.fieldNotes?.trim() || null,
      distance_meters: values.distanceMeters || 0,
      geometry: values.geometry,
    })
    .select()
    .single()

  if (error) throw error

  return data
}

// --------------------------------------------------
// UPDATE ROAD
// --------------------------------------------------

export async function updateRoad(id, values) {
  const { data, error } = await supabase
    .from('road_segments')
    .update({
      name: values.name.trim(),
      road_type: values.roadType || 'Road',
      description: values.description?.trim() || null,
      field_notes: values.fieldNotes?.trim() || null,
      distance_meters: values.distanceMeters || 0,
      geometry: values.geometry,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  return data
}

// --------------------------------------------------
// DELETE ROAD
// --------------------------------------------------

export async function deleteRoad(id) {
  const { error } = await supabase
    .from('road_segments')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// --------------------------------------------------
// HAVERSINE DISTANCE
// --------------------------------------------------

export function distanceBetweenPoints(a, b) {
  const R = 6371000

  const lat1 = (a[0] * Math.PI) / 180
  const lat2 = (b[0] * Math.PI) / 180

  const deltaLat = ((b[0] - a[0]) * Math.PI) / 180
  const deltaLng = ((b[1] - a[1]) * Math.PI) / 180

  const sinLat = Math.sin(deltaLat / 2)
  const sinLng = Math.sin(deltaLng / 2)

  const value =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng

  const c =
    2 * Math.atan2(
      Math.sqrt(value),
      Math.sqrt(1 - value)
    )

  return R * c
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
    total += distanceBetweenPoints(
      points[i - 1],
      points[i]
    )
  }

  return Math.round(total * 10) / 10
}