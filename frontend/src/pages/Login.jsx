import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import logo from "../assets/images/logo/logo.png"
import { API_BASE_URL } from "../config"
import { useAuth } from "../context/AuthContext"
import { ApiError, login } from "../lib/api"

function IconoGoogle() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-5 w-5 shrink-0">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20.4H24v7.2h11.3C33.6 32 29.2 34.9 24 34.9c-6.1 0-11.1-4.9-11.1-11s5-11 11.1-11c2.8 0 5.4 1.1 7.3 2.8l5.1-5.1C33.3 6.9 28.9 5 24 5 13.5 5 5 13.5 5 24s8.5 19 19 19 19-8.5 19-19c0-1.2-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 5.9 4.3C13.8 15.5 18.5 12.1 24 12.1c2.8 0 5.4 1.1 7.3 2.8l5.1-5.1C33.3 6.9 28.9 5 24 5c-7.4 0-13.8 4.2-17 10.3z"
      />
      <path
        fill="#4CAF50"
        d="M24 43c4.8 0 9.2-1.8 12.5-4.9l-5.8-4.9C28.9 34.7 26.6 35.5 24 35.5c-5.2 0-9.6-3.5-11.2-8.3l-6 4.6C10.1 38.7 16.5 43 24 43z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20.4H24v7.2h11.3c-.8 2.4-2.4 4.4-4.5 5.7l5.8 4.9C40.3 35.3 43 30.1 43 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  )
}

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login: setAuthToken } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(location.state?.errorMessage ?? "")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const successMessage = location.state?.successMessage ?? null

  function handleGoogleLogin() {
    // Navegacion completa (no una ruta de react-router): el backend inicia
    // el flujo OAuth y redirige a Google, fuera del SPA por completo.
    window.location.href = `${API_BASE_URL}/api/auth/google/login`
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      const data = await login({ email, password })
      setAuthToken(data.access_token)
      navigate("/dashboard")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión. Intenta de nuevo.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-mg-surface-50 px-6 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex justify-center">
          <img src={logo} alt="MineGuard" className="h-[5.4rem] w-auto object-contain" />
        </Link>

        <div className="rounded-2xl bg-white p-8 shadow-lg shadow-mg-navy-900/5">
          <h1 className="text-center text-2xl font-bold text-mg-navy-900">Iniciar sesión</h1>
          <p className="mt-1 text-center text-sm text-mg-navy-700">Ingresa con tu correo y contraseña.</p>

          {successMessage && (
            <div className="mt-6 rounded-lg border border-mg-safe-500/30 bg-mg-safe-500/10 px-4 py-3 text-sm font-medium text-mg-safe-500">
              {successMessage}
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-lg border border-mg-danger-500/30 bg-mg-danger-500/10 px-4 py-3 text-sm font-medium text-mg-danger-500">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-mg-navy-800">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
                placeholder="tucorreo@ejemplo.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-mg-navy-800">
                  Contraseña
                </label>
                <Link to="/olvide-password" className="text-xs font-semibold text-mg-accent-500 hover:text-mg-accent-600">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-mg-accent-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-mg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Cargando..." : "Iniciar sesión"}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-mg-surface-100" />
            <span className="text-xs font-medium text-mg-navy-700/70">o continúa con</span>
            <div className="h-px flex-1 bg-mg-surface-100" />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="mt-4 flex w-full items-center justify-center gap-3 rounded-lg border border-mg-surface-100 bg-white px-5 py-2.5 text-sm font-semibold text-mg-navy-800 transition hover:bg-mg-surface-50"
          >
            <IconoGoogle />
            Iniciar sesión con Google
          </button>

          <p className="mt-6 text-center text-sm text-mg-navy-700">
            ¿No tienes cuenta?{" "}
            <Link to="/registro" className="font-semibold text-mg-accent-500 hover:text-mg-accent-600">
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
