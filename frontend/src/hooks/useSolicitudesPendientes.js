import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError, listarSolicitudesCambio } from "../lib/api"

export function useSolicitudesPendientes(token, habilitado) {
  const [solicitudes, setSolicitudes] = useState([])
  const [isLoading, setIsLoading] = useState(() => Boolean(token) && habilitado)
  const [error, setError] = useState("")
  const activoRef = useRef(true)

  const cargar = useCallback(async () => {
    if (!token || !habilitado) return

    setIsLoading(true)
    try {
      const data = await listarSolicitudesCambio(token, "pendiente")
      if (!activoRef.current) return
      setSolicitudes(data)
      setError("")
    } catch (err) {
      if (!activoRef.current) return
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar las solicitudes pendientes.")
    } finally {
      if (activoRef.current) setIsLoading(false)
    }
  }, [token, habilitado])

  useEffect(() => {
    activoRef.current = true
    if (!token || !habilitado) {
      setIsLoading(false)
      return
    }

    cargar()

    return () => {
      activoRef.current = false
    }
  }, [token, habilitado, cargar])

  return { solicitudes, isLoading, error, recargar: cargar }
}
