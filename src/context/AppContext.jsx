import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { fetchCampuses, fetchCategories } from '../lib/places'

const AppContext = createContext(null)
const CAMPUS_KEY = 'campusmapper.campusId'

export function AppProvider({ children }) {
  const [campuses, setCampuses] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [campusId, setCampusIdState] = useState(() => localStorage.getItem(CAMPUS_KEY))

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [c, cat] = await Promise.all([fetchCampuses(), fetchCategories()])
      setCampuses(c)
      setCategories(cat)
    } catch (err) {
      setError(err.message || 'Could not load campuses')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const setCampusId = (id) => {
    localStorage.setItem(CAMPUS_KEY, id)
    setCampusIdState(id)
  }

  const currentCampus = campuses.find((c) => c.id === campusId) || campuses[0] || null

  return (
    <AppContext.Provider value={{ campuses, categories, currentCampus, setCampusId, loading, error, reload: load }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
