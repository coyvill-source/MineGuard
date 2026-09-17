import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import logo from "../assets/images/logo/logo.png"
import { useAuth } from "../context/AuthContext"
import { ApiError, completarRegistroGoogle, exchangeCodigo } from "../lib/api"

const TIPOS_DOCUMENTO = [
  { value: "CC", label: "Cédula de Ciudadanía" },
  { value: "CE", label: "Cédula de Extranjería" },
  { value: "PASAPORTE", label: "Pasaporte" },
]

const ERROR_CODIGO =
  "El enlace de registro con Google es inválido o ya expiró. Vuelve a iniciar sesión con Google."

function CompletarRegistroGoogle() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login: setAuthToken } = useAuth()
  const codigo = searchParams.get("code")

  // "cargando" mientras se canjea el `code` por el registro_token,
  // "listo" cuando ya se puede mostrar el formulario, "error" si el
  // codigo es invalido/expiro o la respuesta no fue la esperada.
  const [estado, setEstado] = useState("cargando")
  const [registroToken, setRegistroToken] = useState(null)
  const [email, setEmail] = useState("")

  const [nombre, setNombre] = useState("")
  const [apellidos, setApellidos] = useState("")
  const [telefono, setTelefono] = useState("")
  const [tipoDocumento, setTipoDocumento] = useState(TIPOS_DOCUMENTO[0].value)
  const [numeroDocumento, setNumeroDocumento] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Guarda para que el canje solo dispare UNA petición real por código,
  // incluso bajo React.StrictMode (que en desarrollo invoca cada efecto
  // dos veces a propósito para detectar faltas de limpieza). Un simple
  // flag `cancelado` en el cleanup NO alcanza aquí: solo ignora el
  // resultado de la invocación fantasma, pero el fetch ya salió y el
  // backend ya consumió el código de un solo uso antes de que la
  // invocación "real" pueda usarlo - por eso el guard debe evitar que la
  // petición se DISPARE dos veces, no solo que se IGNORE la segunda
  // respuesta. Ver DECISION en docs/PROJECT_CONTEXT.md.
  const codigoYaCanjeadoRef = useRef(null)

  useEffect(() => {
    if (!codigo) {
      setEstado("error")
      return
    }
    if (codigoYaCanjeadoRef.current === codigo) return
    codigoYaCanjeadoRef.current = codigo

    exchangeCodigo(codigo)
      .then((data) => {
        if (data.resultado !== "registro_pendiente" || !data.registro_token) {
          throw new Error("Respuesta inesperada del servidor al canjear el codigo")
        }
        setRegistroToken(data.registro_token)
        setEmail(data.email ?? "")
        setNombre(data.nombre ?? "")
        setEstado("listo")
      })
      .catch(() => setEstado("error"))
  }, [codigo])

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")

    const camposObligatorios = { nombre, apellidos, telefono, numeroDocumento }
    const hayCampoVacio = Object.values(camposObligatorios).some((valor) => valor.trim() === "")
    if (hayCampoVacio) {
      setError("Todos los campos son obligatorios.")
      return
    }

    setIsSubmitting(true)

    try {
      const data = await completarRegistroGoogle({
        registroToken,
        nombre,
        apellidos,
        telefono,
        tipoDocumento,
        numeroDocumento,
      })
      setAuthToken(data.access_token)
      navigate("/dashboard")
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
          {estado === "cargando" && (
            <p className="text-center text-sm text-mg-navy-700">Verificando tu cuenta de Google...</p>
          )}

          {estado === "error" && (
            <>
              <h1 className="text-center text-2xl font-bold text-mg-navy-900">Enlace inválido</h1>
              <div className="mt-6 rounded-lg border border-mg-danger-500/30 bg-mg-danger-500/10 px-4 py-3 text-center text-sm font-medium text-mg-danger-500">
                {ERROR_CODIGO}
              </div>
              <Link
                to="/login"
                className="mt-6 block w-full rounded-lg bg-mg-accent-500 px-5 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-mg-accent-600"
              >
                Volver a iniciar sesión
              </Link>
            </>
          )}

          {estado === "listo" && (
            <>
              <h1 className="text-center text-2xl font-bold text-mg-navy-900">Completa tu registro</h1>
              <p className="mt-1 text-center text-sm text-mg-navy-700">
                Ya verificamos tu cuenta de Google — solo falta un poco de información.
              </p>

              {error && (
                <div className="mt-6 rounded-lg border border-mg-danger-500/30 bg-mg-danger-500/10 px-4 py-3 text-sm font-medium text-mg-danger-500">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
                <div>
                  <label className="block text-sm font-medium text-mg-navy-800">Correo electrónico</label>
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="mt-1.5 w-full cursor-not-allowed rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-700/70 outline-none"
                  />
                </div>

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

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-mg-accent-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-mg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Cargando..." : "Completar registro"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default CompletarRegistroGoogle
