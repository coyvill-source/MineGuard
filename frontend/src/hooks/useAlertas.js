import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError, listarAlertas } from "../lib/api"

export function useAlertas(token, estado) {
  const [alertas, setAlertas] = useState([])
  const [isLoading, setIsLoading] = useState(() => Boolean(token))
  const [error, setError] = useState("")
  const activoRef = useRef(true)

  const cargar = useCallback(async () => {
    if (!token) return

    setIsLoading(true)
    try {
      const data = await listarAlertas(token, estado)
      if (!activoRef.current) return
      setAlertas(data)
      setError("")
    } catch (err) {
      if (!activoRef.current) return
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar las alertas.")
    } finally {
      if (activoRef.current) setIsLoading(false)
    }
  }, [token, estado])

  useEffect(() => {
    activoRef.current = true
    if (!token) return

    cargar()

    return () => {
      activoRef.current = false
    }
  }, [token, estado, cargar])

  return { alertas, isLoading, error, recargar: cargar }
}
