const ARRIVAL_DISTANCE_METERS = 15

export function getCurrentPosition() {
  return new Promise(
    (resolve, reject) => {
      if (!navigator.geolocation) {
        reject(
          new Error(
            'Your browser does not support GPS location.'
          )
        )
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude:
              position.coords.latitude,
            longitude:
              position.coords.longitude,
            accuracy:
              position.coords.accuracy,
          })
        },
        (error) => {
          if (error.code === 1) {
            reject(
              new Error(
                'Location permission was denied. Allow GPS access and try again.'
              )
            )
          } else if (error.code === 2) {
            reject(
              new Error(
                'Your device could not determine your location.'
              )
            )
          } else {
            reject(
              new Error(
                'GPS timed out. Move to an open area and try again.'
              )
            )
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 20000,
        }
      )
    }
  )
}

export function watchCurrentPosition(
  onPosition,
  onError
) {
  if (!navigator.geolocation) {
    onError?.(
      new Error(
        'Your browser does not support GPS location.'
      )
    )

    return () => {}
  }

  const watchId =
    navigator.geolocation.watchPosition(
      (position) => {
        onPosition({
          latitude:
            position.coords.latitude,
          longitude:
            position.coords.longitude,
          accuracy:
            position.coords.accuracy,
        })
      },
      (error) => {
        if (error.code === 1) {
          onError?.(
            new Error(
              'Location permission was denied.'
            )
          )
        } else if (error.code === 2) {
          onError?.(
            new Error(
              'Your device could not determine your location.'
            )
          )
        } else {
          onError?.(
            new Error(
              'GPS timed out.'
            )
          )
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000,
      }
    )

  return () => {
    navigator.geolocation.clearWatch(
      watchId
    )
  }
}

export function isArrived(
  current,
  destination
) {
  if (
    !current ||
    !destination
  ) {
    return false
  }

  const lat1 =
    (current.latitude *
      Math.PI) /
    180

  const lat2 =
    (destination.latitude *
      Math.PI) /
    180

  const deltaLat =
    ((destination.latitude -
      current.latitude) *
      Math.PI) /
    180

  const deltaLng =
    ((destination.longitude -
      current.longitude) *
      Math.PI) /
    180

  const sinLat =
    Math.sin(deltaLat / 2)

  const sinLng =
    Math.sin(deltaLng / 2)

  const value =
    sinLat * sinLat +
    Math.cos(lat1) *
      Math.cos(lat2) *
      sinLng *
      sinLng

  const earthRadius = 6371000

  const distance =
    earthRadius *
    2 *
    Math.atan2(
      Math.sqrt(value),
      Math.sqrt(1 - value)
    )

  return (
    distance <=
    ARRIVAL_DISTANCE_METERS
  )
}

export function formatDistance(
  meters
) {
  if (!Number.isFinite(meters)) {
    return '—'
  }

  if (meters >= 1000) {
    return `${(
      meters / 1000
    ).toFixed(2)} km`
  }

  return `${Math.round(
    meters
  )} m`
}

export function formatWalkingTime(
  minutes
) {
  if (
    !Number.isFinite(minutes)
  ) {
    return '—'
  }

  if (minutes < 60) {
    return `${Math.max(
      1,
      Math.round(minutes)
    )} min`
  }

  const hours =
    Math.floor(minutes / 60)

  const remaining =
    Math.round(minutes % 60)

  return `${hours} hr ${
    remaining
      ? `${remaining} min`
      : ''
  }`.trim()
}