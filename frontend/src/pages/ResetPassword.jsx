import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import logo from "../assets/images/logo/logo.png"
import { ApiError, resetPassword } from "../lib/api"

function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")

  const [nuevaPassword, setNuevaPassword] = useState("")
  const [confirmarPassword, setConfirmarPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")

    if (nuevaPassword !== confirmarPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setIsSubmitting(true)

    try {
      await resetPassword({ token, nuevaPassword })
      navigate("/login", { state: { successMessage: "Contraseña actualizada, inicia sesión" } })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo restablecer la contraseña. Intenta de nuevo.")
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
          <h1 className="text-center text-2xl font-bold text-mg-navy-900">Restablecer contraseña</h1>
          <p className="mt-1 text-center text-sm text-mg-navy-700">Ingresa tu nueva contraseña.</p>

          {!token ? (
            <div className="mt-6 rounded-lg border border-mg-danger-500/30 bg-mg-danger-500/10 px-4 py-3 text-center text-sm font-medium text-mg-danger-500">
              El enlace es inválido o está incompleto.{" "}
              <Link to="/olvide-password" className="font-semibold underline">
                Solicita uno nuevo
              </Link>
              .
            </div>
          ) : (
            <>
              {error && (
                <div className="mt-6 rounded-lg border border-mg-danger-500/30 bg-mg-danger-500/10 px-4 py-3 text-center text-sm font-medium text-mg-danger-500">
                  {error}{" "}
                  <Link to="/olvide-password" className="font-semibold underline">
                    Solicita uno nuevo
                  </Link>
                  .
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
                <div>
                  <label htmlFor="nuevaPassword" className="block text-sm font-medium text-mg-navy-800">
                    Nueva contraseña
                  </label>
                  <input
                    id="nuevaPassword"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={nuevaPassword}
                    onChange={(event) => setNuevaPassword(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>

                <div>
                  <label htmlFor="confirmarPassword" className="block text-sm font-medium text-mg-navy-800">
                    Confirmar contraseña
                  </label>
                  <input
                    id="confirmarPassword"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmarPassword}
                    onChange={(event) => setConfirmarPassword(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
                    placeholder="Repite tu nueva contraseña"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-mg-accent-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-mg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Cargando..." : "Restablecer contraseña"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ResetPassword
