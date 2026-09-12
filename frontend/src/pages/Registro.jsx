import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import logo from "../assets/images/logo/logo.png"
import { ApiError, register } from "../lib/api"

const TIPOS_DOCUMENTO = [
  { value: "CC", label: "Cédula de Ciudadanía" },
  { value: "CE", label: "Cédula de Extranjería" },
  { value: "PASAPORTE", label: "Pasaporte" },
]

function Registro() {
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [nombre, setNombre] = useState("")
  const [apellidos, setApellidos] = useState("")
  const [telefono, setTelefono] = useState("")
  const [tipoDocumento, setTipoDocumento] = useState(TIPOS_DOCUMENTO[0].value)
  const [numeroDocumento, setNumeroDocumento] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")

    const camposObligatorios = { email, password, nombre, apellidos, telefono, numeroDocumento }
    const hayCampoVacio = Object.values(camposObligatorios).some((valor) => valor.trim() === "")
    if (hayCampoVacio) {
      setError("Todos los campos son obligatorios.")
      return
    }

    setIsSubmitting(true)

    try {
      await register({
        email,
        password,
        nombre,
        apellidos,
        telefono,
        tipoDocumento,
        numeroDocumento,
      })
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
          <img src={logo} alt="MineGuard" className="h-[5.4rem] w-auto object-contain" />
        </Link>

        <div className="rounded-2xl bg-white p-8 shadow-lg shadow-mg-navy-900/5">
          <h1 className="text-center text-2xl font-bold text-mg-navy-900">Crear cuenta</h1>
          <p className="mt-1 text-center text-sm text-mg-navy-700">Regístrate con tu correo y contraseña.</p>

          {error && (
            <div className="mt-6 rounded-lg border border-mg-danger-500/30 bg-mg-danger-500/10 px-4 py-3 text-sm font-medium text-mg-danger-500">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="nombre" className="block text-sm font-medium text-mg-navy-800">
                  Nombre
                </label>
                <input
                  id="nombre"
                  type="text"
                  required
                  autoComplete="given-name"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
                  placeholder="Tu nombre"
                />
              </div>

              <div>
                <label htmlFor="apellidos" className="block text-sm font-medium text-mg-navy-800">
                  Apellidos
                </label>
                <input
                  id="apellidos"
                  type="text"
                  required
                  autoComplete="family-name"
                  value={apellidos}
                  onChange={(event) => setApellidos(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
                  placeholder="Tus apellidos"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="tipoDocumento" className="block text-sm font-medium text-mg-navy-800">
                  Tipo de documento
                </label>
                <select
                  id="tipoDocumento"
                  value={tipoDocumento}
                  onChange={(event) => setTipoDocumento(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
                >
                  {TIPOS_DOCUMENTO.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="numeroDocumento" className="block text-sm font-medium text-mg-navy-800">
                  Número de documento
                </label>
                <input
                  id="numeroDocumento"
                  type="text"
                  required
                  autoComplete="off"
                  value={numeroDocumento}
                  onChange={(event) => setNumeroDocumento(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
                  placeholder="Sin puntos ni espacios"
                />
              </div>
            </div>

            <div>
              <label htmlFor="telefono" className="block text-sm font-medium text-mg-navy-800">
                Teléfono
              </label>
              <input
                id="telefono"
                type="tel"
                required
                autoComplete="tel"
                value={telefono}
                onChange={(event) => setTelefono(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
                placeholder="300 000 0000"
              />
            </div>

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
