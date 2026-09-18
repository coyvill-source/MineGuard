import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError, listarUsuarios } from "../lib/api"

export function useUsuarios(token) {
  const [usuarios, setUsuarios] = useState([])
  const [isLoading, setIsLoading] = useState(() => Boolean(token))
  const [error, setError] = useState("")
  const activoRef = useRef(true)

  const cargar = useCallback(async () => {
    if (!token) return

    setIsLoading(true)
    try {
      const data = await listarUsuarios(token)
      if (!activoRef.current) return
      setUsuarios(data)
      setError("")
    } catch (err) {
      if (!activoRef.current) return
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los usuarios.")
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

  return { usuarios, isLoading, error, recargar: cargar }
}
