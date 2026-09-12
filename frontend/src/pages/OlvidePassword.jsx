import { useState } from "react"
import { Link } from "react-router-dom"
import logo from "../assets/images/logo/logo.png"
import { ApiError, forgotPassword } from "../lib/api"

function OlvidePassword() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")
    setMessage("")
    setIsSubmitting(true)

    try {
      const data = await forgotPassword({ email })
      setMessage(data.mensaje)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar la solicitud. Intenta de nuevo.")
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
          <h1 className="text-center text-2xl font-bold text-mg-navy-900">¿Olvidaste tu contraseña?</h1>
          <p className="mt-1 text-center text-sm text-mg-navy-700">
            Ingresa tu correo y te enviaremos instrucciones para restablecerla.
          </p>

          {message && (
            <div className="mt-6 rounded-lg border border-mg-safe-500/30 bg-mg-safe-500/10 px-4 py-3 text-sm font-medium text-mg-safe-500">
              {message}
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-mg-accent-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-mg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Cargando..." : "Enviar instrucciones"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-mg-navy-700">
            ¿Ya la recordaste?{" "}
            <Link to="/login" className="font-semibold text-mg-accent-500 hover:text-mg-accent-600">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default OlvidePassword
