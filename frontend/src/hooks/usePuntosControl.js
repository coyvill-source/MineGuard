import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError, listarPuntosControl } from "../lib/api"

export function usePuntosControl(token) {
  const [puntos, setPuntos] = useState([])
  const [isLoading, setIsLoading] = useState(() => Boolean(token))
  const [error, setError] = useState("")
  const activoRef = useRef(true)

  const cargar = useCallback(async () => {
    if (!token) return

    setIsLoading(true)
    try {
      const data = await listarPuntosControl(token)
      if (!activoRef.current) return
      setPuntos(data)
      setError("")
    } catch (err) {
      if (!activoRef.current) return
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los puntos de control.")
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

  return { puntos, isLoading, error, recargar: cargar }
}
