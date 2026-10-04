import { supabase } from './supabase'

export const BUCKET = 'campus-photos'

// Folder layout:  campus-photos/<campus-id>/<place-id>/<photo-type>.jpg
export function photoPath(campusId, placeId, type) {
  return `${campusId}/${placeId}/${type}.jpg`
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read this image'))
    }
    img.src = url
  })
}

// Phone cameras produce 3 to 10 MB photos. Shrinking them to 1600 px on the
// long side keeps them sharp enough for mapping and makes uploads far
// faster on mobile data. If anything fails we upload the original instead.
export async function compressImage(file, maxSide = 1600, quality = 0.82) {
  try {
    const img = await loadImage(file)
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const width = Math.round(img.naturalWidth * scale)
    const height = Math.round(img.naturalHeight * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(img, 0, 0, width, height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    return blob || file
  } catch {
    return file
  }
}

// Uploads one photo and returns { path, url }.
// upsert: true means retaking a photo replaces the old file.
export async function uploadPhoto(campusId, placeId, type, file) {
  const body = await compressImage(file)
  const path = photoPath(campusId, placeId, type)
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    upsert: true,
    contentType: body.type || 'image/jpeg',
    cacheControl: '3600',
  })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  // ?v= makes sure the browser fetches the new picture after a retake
  return { path, url: `${data.publicUrl}?v=${Date.now()}` }
}

export async function removePhotos(paths) {
  if (!paths.length) return
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) throw error
}

// Deletes every file inside <campus-id>/<place-id>/
export async function removePlaceFolder(campusId, placeId) {
  const folder = `${campusId}/${placeId}`
  const { data, error } = await supabase.storage.from(BUCKET).list(folder)
  if (error) throw error
  if (data && data.length) {
    await removePhotos(data.map((f) => `${folder}/${f.name}`))
  }
}
