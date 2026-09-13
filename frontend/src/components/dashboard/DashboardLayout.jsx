import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { me } from "../../lib/api"
import CabeceraDashboard from "./CabeceraDashboard"
import MenuLateral from "./MenuLateral"

/**
 * Layout compartido por todas las paginas autenticadas del panel (Dashboard,
 * Puntos de Control, y las que sigan): header + menu lateral + gate de sesion.
 * `children` puede ser un nodo normal, o una funcion `(usuario) => nodo` para
 * paginas que necesitan el rol del usuario (viene del mismo `me(token)` que
 * ya se usaba antes en Dashboard.jsx, ahora centralizado aqui).
 */
function DashboardLayout({ titulo, children }) {
  const navigate = useNavigate()
  const { token, logout } = useAuth()
  const [usuario, setUsuario] = useState(null)
  const [menuAbierto, setMenuAbierto] = useState(false)

  useEffect(() => {
    if (!token) return

    let cancelado = false
    me(token).then((data) => {
      if (!cancelado) setUsuario(data)
    })

    return () => {
      cancelado = true
    }
  }, [token])

  function handleCerrarSesion() {
    logout()
    navigate("/login")
  }

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
    <div className="min-h-screen bg-mg-surface-50">
      <CabeceraDashboard
        usuario={usuario}
        onCerrarSesion={handleCerrarSesion}
        onAbrirMenu={() => setMenuAbierto(true)}
      />

      <div className="flex">
        <MenuLateral rol={usuario?.rol} abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />

        <main className="min-w-0 flex-1 px-6 py-8 sm:px-10">
          <div className="mx-auto max-w-[1600px]">
            {titulo && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-mg-navy-900">{titulo}</h1>
              </div>
            )}
            {typeof children === "function" ? children(usuario) : children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
