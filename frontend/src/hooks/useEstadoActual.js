import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError, obtenerEstadoActualPuntosControl } from "../lib/api"

const INTERVALO_REFRESCO_MS = 20000

export function useEstadoActual(token) {
  const [puntos, setPuntos] = useState([])
  const [isLoading, setIsLoading] = useState(() => Boolean(token))
  const [error, setError] = useState("")
  const [huboCargaExitosa, setHuboCargaExitosa] = useState(false)
  const activoRef = useRef(true)

  const cargar = useCallback(
    async (mostrarCargando) => {
      if (!token) return

      if (mostrarCargando) setIsLoading(true)

      try {
        const data = await obtenerEstadoActualPuntosControl(token)
        if (!activoRef.current) return
        setPuntos(data)
        setError("")
        setHuboCargaExitosa(true)
      } catch (err) {
        if (!activoRef.current) return
        setError(
          err instanceof ApiError ? err.message : "No se pudo cargar el estado de los puntos de control.",
        )
      } finally {
        if (activoRef.current && mostrarCargando) setIsLoading(false)
      }
    },
    [token],
  )

  useEffect(() => {
    activoRef.current = true

    if (!token) return

    cargar(true)
    const intervalId = window.setInterval(() => cargar(false), INTERVALO_REFRESCO_MS)

    return () => {
      activoRef.current = false
      window.clearInterval(intervalId)
    }
  }, [token, cargar])

  return {
    puntos,
    isLoading,
    error,
    huboCargaExitosa,
    recargar: () => cargar(true),
  }
}
