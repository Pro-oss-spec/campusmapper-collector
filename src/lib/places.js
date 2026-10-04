import { supabase } from './supabase'
import { uploadPhoto, removePhotos, removePlaceFolder, photoPath } from './storage'
import { COVER_PRIORITY, PHOTO_TYPES, isToday } from './location'

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  // Fallback for older browsers
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const h = [...bytes].map((b) => b.toString(16).padStart(2, '0'))
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`
}

function normalize(row) {
  const { campuses, place_photos, ...rest } = row
  const photos = [...(place_photos || [])].sort(
    (a, b) => COVER_PRIORITY.indexOf(a.photo_type) - COVER_PRIORITY.indexOf(b.photo_type)
  )
  return { ...rest, campus: campuses || null, photos }
}

function orEmpty(text) {
  const t = (text || '').trim()
  return t ? t : null
}

// ---------- Reference data ----------
export async function fetchCampuses() {
  const { data, error } = await supabase.from('campuses').select('*').order('name')
  if (error) throw error
  return data
}

export async function fetchCategories() {
  const { data, error } = await supabase.from('categories').select('*').order('created_at')
  if (error) throw error
  return data
}

// ---------- Reading places ----------
export async function fetchPlaces() {
  const { data, error } = await supabase
    .from('places')
    .select('*, campuses(id, name, center_lat, center_lng), place_photos(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(normalize)
}

export async function fetchPlace(id) {
  const { data, error } = await supabase
    .from('places')
    .select('*, campuses(id, name, center_lat, center_lng), place_photos(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return normalize(data)
}

export async function fetchPlaceStats() {
  const { data, error } = await supabase
    .from('places')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return {
    total: data.length,
    today: data.filter((p) => isToday(p.created_at)).length,
    latest: data[0] || null,
  }
}

// ---------- Creating ----------
// photos is an object like { front: { file }, sign: { file } }.
// Order of work: upload photos, then save the place, then save photo rows.
// If anything fails we clean up so no half-saved data is left behind.
export async function createPlace(values, photos, onProgress) {
  const placeId = newId()
  const uploaded = []
  const toUpload = PHOTO_TYPES.map((t) => t.key).filter((k) => photos[k]?.file)

  try {
    for (const type of toUpload) {
      const up = await uploadPhoto(values.campusId, placeId, type, photos[type].file)
      uploaded.push({ type, ...up })
      if (onProgress) onProgress(uploaded.length, toUpload.length)
    }

    const coverType = COVER_PRIORITY.find((t) => uploaded.some((u) => u.type === t))
    const coverUrl = uploaded.find((u) => u.type === coverType)?.url ?? null

    const { error } = await supabase.from('places').insert({
      id: placeId,
      campus_id: values.campusId,
      name: values.name.trim(),
      category: values.category,
      description: orEmpty(values.description),
      latitude: values.latitude,
      longitude: values.longitude,
      gps_accuracy: values.gpsAccuracy,
      field_notes: orEmpty(values.fieldNotes),
      cover_image: coverUrl,
    })
    if (error) throw error

    if (uploaded.length) {
      const { error: photoError } = await supabase.from('place_photos').insert(
        uploaded.map((u) => ({
          place_id: placeId,
          image_url: u.url,
          photo_type: u.type,
          is_cover: u.type === coverType,
        }))
      )
      if (photoError) throw photoError
    }

    return placeId
  } catch (err) {
    await removePhotos(uploaded.map((u) => u.path)).catch(() => {})
    await supabase.from('places').delete().eq('id', placeId)
    throw err
  }
}

// ---------- Editing ----------
// photos: slot with a file = new or replaced photo
//         slot with only a previewUrl = existing photo, keep as is
//         no slot = photo was removed
export async function updatePlace(existing, values, photos, onProgress) {
  const campusId = existing.campus_id
  const byType = Object.fromEntries(existing.photos.map((p) => [p.photo_type, p]))
  const toUpload = PHOTO_TYPES.map((t) => t.key).filter((k) => photos[k]?.file)
  const toRemove = Object.keys(byType).filter((k) => !photos[k])

  const finalUrls = {}
  Object.keys(byType).forEach((k) => {
    if (photos[k]) finalUrls[k] = byType[k].image_url
  })

  let done = 0
  for (const type of toUpload) {
    const up = await uploadPhoto(campusId, existing.id, type, photos[type].file)
    finalUrls[type] = up.url
    if (byType[type]) {
      const { error } = await supabase.from('place_photos').update({ image_url: up.url }).eq('id', byType[type].id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('place_photos')
        .insert({ place_id: existing.id, image_url: up.url, photo_type: type, is_cover: false })
      if (error) throw error
    }
    done += 1
    if (onProgress) onProgress(done, toUpload.length)
  }

  if (toRemove.length) {
    await removePhotos(toRemove.map((t) => photoPath(campusId, existing.id, t))).catch(() => {})
    const { error } = await supabase
      .from('place_photos')
      .delete()
      .in('id', toRemove.map((t) => byType[t].id))
    if (error) throw error
  }

  // Re-pick the cover so it is always the best available photo
  const coverType = COVER_PRIORITY.find((t) => finalUrls[t])
  await supabase.from('place_photos').update({ is_cover: false }).eq('place_id', existing.id)
  if (coverType) {
    await supabase.from('place_photos').update({ is_cover: true }).eq('place_id', existing.id).eq('photo_type', coverType)
  }

  const { error } = await supabase
    .from('places')
    .update({
      name: values.name.trim(),
      category: values.category,
      description: orEmpty(values.description),
      latitude: values.latitude,
      longitude: values.longitude,
      gps_accuracy: values.gpsAccuracy,
      field_notes: orEmpty(values.fieldNotes),
      cover_image: coverType ? finalUrls[coverType] : null,
    })
    .eq('id', existing.id)
  if (error) throw error
}

// ---------- Deleting ----------
export async function deletePlace(place) {
  await removePlaceFolder(place.campus_id, place.id).catch(() => {})
  const { error } = await supabase.from('places').delete().eq('id', place.id)
  if (error) throw error
}
