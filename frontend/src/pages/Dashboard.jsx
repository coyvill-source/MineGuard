import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { ApiError, me } from "../lib/api"

function Dashboard() {
  const { token } = useAuth()
  const [rol, setRol] = useState(null)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    me(token)
      .then((data) => {
        if (!cancelled) setRol(data.rol)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "No se pudo cargar tu información.")
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token])

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mg-surface-50 px-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg shadow-mg-navy-900/5">
          <h1 className="text-xl font-bold text-mg-navy-900">Sesión no iniciada</h1>
          <p className="mt-2 text-sm text-mg-navy-700">Debes iniciar sesión para ver tu panel.</p>
          <Link
            to="/login"
            className="mt-6 inline-block rounded-lg bg-mg-accent-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-mg-accent-600"
          >
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-mg-surface-50 px-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg shadow-mg-navy-900/5">
        {isLoading ? (
          <p className="text-sm text-mg-navy-700">Cargando...</p>
        ) : error ? (
          <p className="text-sm font-medium text-mg-danger-500">{error}</p>
        ) : (
          <h1 className="text-xl font-bold text-mg-navy-900">Bienvenido, tu rol es: {rol}</h1>
        )}
      </div>
    </div>
  )
}

export default Dashboard
