import { useEffect, useRef, useState } from "react"
import { Route, Routes, useNavigate, useSearchParams } from "react-router-dom"
import Landing from "./pages/Landing"
import Login from "./pages/Login"
import Registro from "./pages/Registro"
import Dashboard from "./pages/Dashboard"
import PuntosControl from "./pages/PuntosControl"
import Alertas from "./pages/Alertas"
import Estadisticas from "./pages/Estadisticas"
import OlvidePassword from "./pages/OlvidePassword"
import ResetPassword from "./pages/ResetPassword"
import CompletarRegistroGoogle from "./pages/CompletarRegistroGoogle"
import { useAuth } from "./context/AuthContext"
import { exchangeCodigo } from "./lib/api"

const ERROR_EXCHANGE_LOGIN =
  "No se pudo completar el inicio de sesión con Google. Intenta de nuevo."

/**
 * Envuelve una ruta que puede recibir un `?code=` de un solo uso desde el
 * callback de Google OAuth (ver GET /api/auth/google/callback en el
 * backend, caso "usuario ya existente"). Si hay `code`, lo canjea por el
 * JWT real via POST /api/auth/exchange, lo guarda en AuthContext y limpia
 * el `code` de la URL con un `navigate(..., {replace:true})`. Si no hay
 * `code` (navegacion normal a la ruta), no hace nada y renderiza los
 * `children` de inmediato.
 */
function ConCodigoGoogle({ children }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login: setAuthToken } = useAuth()
  const codigo = searchParams.get("code")
  const [intercambiando, setIntercambiando] = useState(Boolean(codigo))

  // Guarda para que el canje solo dispare UNA petición real por código,
  // incluso bajo React.StrictMode (invoca cada efecto dos veces en
  // desarrollo). Un flag `cancelado` en el cleanup no alcanza: el fetch ya
  // sale hacia el backend en la invocación fantasma y el código de un
  // solo uso ya queda consumido antes de que la invocación "real" llegue
  // a usarlo - hubo un bug exacto de este patrón en
  // CompletarRegistroGoogle.jsx, ver DECISION en docs/PROJECT_CONTEXT.md.
  const codigoYaCanjeadoRef = useRef(null)

  useEffect(() => {
    if (!codigo) return
    if (codigoYaCanjeadoRef.current === codigo) return
    codigoYaCanjeadoRef.current = codigo

    exchangeCodigo(codigo)
      .then((data) => {
        if (data.resultado !== "login" || !data.access_token) {
          throw new Error("Respuesta inesperada del servidor al canjear el codigo")
        }
        setAuthToken(data.access_token)
        navigate("/dashboard", { replace: true })
      })
      .catch(() => {
        navigate("/login", { replace: true, state: { errorMessage: ERROR_EXCHANGE_LOGIN } })
      })
      .finally(() => setIntercambiando(false))
    // Solo debe correr cuando cambia el `codigo` de la URL (ver limpieza
    // de la URL arriba), no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo])

  if (intercambiando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mg-surface-50 text-sm text-mg-navy-700">
        Completando inicio de sesión...
      </div>
    )
  }

  return children
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
      <Route
        path="/dashboard"
        element={
          <ConCodigoGoogle>
            <Dashboard />
          </ConCodigoGoogle>
        }
      />
      <Route path="/puntos-control" element={<PuntosControl />} />
      <Route path="/alertas" element={<Alertas />} />
      <Route path="/estadisticas" element={<Estadisticas />} />
      <Route path="/olvide-password" element={<OlvidePassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/completar-registro-google" element={<CompletarRegistroGoogle />} />
    </Routes>
  )
}

export default App
