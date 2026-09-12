import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import logo from "../assets/images/logo/logo.png"
import { ApiError, register } from "../lib/api"

const ROLES = [
  { value: "trabajador", label: "Trabajador" },
  { value: "supervisor", label: "Supervisor HSE" },
  { value: "admin", label: "Administrador" },
]

function Registro() {
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rol, setRol] = useState(ROLES[0].value)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      await register({ email, password, rol })
      navigate("/login", { state: { successMessage: "Registro exitoso, inicia sesión" } })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo completar el registro. Intenta de nuevo.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-mg-surface-50 px-6 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex justify-center">
          <img src={logo} alt="MineGuard" className="h-12 w-auto object-contain" />
        </Link>

        <div className="rounded-2xl bg-white p-8 shadow-lg shadow-mg-navy-900/5">
          <h1 className="text-2xl font-bold text-mg-navy-900">Crear cuenta</h1>
          <p className="mt-1 text-sm text-mg-navy-700">Regístrate con tu correo y contraseña.</p>

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
              <label htmlFor="password" className="block text-sm font-medium text-mg-navy-800">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            <div>
              <label htmlFor="rol" className="block text-sm font-medium text-mg-navy-800">
                Rol
              </label>
              <select
                id="rol"
                value={rol}
                onChange={(event) => setRol(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
              >
                {ROLES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-mg-accent-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-mg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Cargando..." : "Crear cuenta"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-mg-navy-700">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="font-semibold text-mg-accent-500 hover:text-mg-accent-600">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Registro
