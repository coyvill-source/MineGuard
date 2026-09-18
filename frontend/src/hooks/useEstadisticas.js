import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError, obtenerEstadisticasResumen } from "../lib/api"

export function useEstadisticas(token) {
  const [datos, setDatos] = useState(null)
  const [isLoading, setIsLoading] = useState(() => Boolean(token))
  const [error, setError] = useState("")
  const activoRef = useRef(true)

  const cargar = useCallback(async () => {
    if (!token) return

    setIsLoading(true)
    try {
      const data = await obtenerEstadisticasResumen(token)
      if (!activoRef.current) return
      setDatos(data)
      setError("")
    } catch (err) {
      if (!activoRef.current) return
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar las estadísticas.")
    } finally {
      if (activoRef.current) setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    activoRef.current = true
    if (!token) return

    cargar()

    return () => {
      activoRef.current = false
    }
  }, [token, cargar])

  return { datos, isLoading, error, recargar: cargar }
}
