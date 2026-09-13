import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import logoBlanco from "../assets/images/logo/logo_blanco.png"
import ErrorBoundary from "../components/ErrorBoundary"
import MenuLateral from "../components/dashboard/MenuLateral"
import PlanoPuntosControl from "../components/dashboard/PlanoPuntosControl"
import { useAuth } from "../context/AuthContext"
import { useEstadoActual } from "../hooks/useEstadoActual"
import { me } from "../lib/api"

const ROL_ETIQUETA = {
  trabajador: "Trabajador",
  supervisor: "Supervisor HSE",
  admin: "Administrador",
}

const LEYENDA = [
  { color: "bg-mg-safe-500", etiqueta: "Óptimo" },
  { color: "bg-mg-alert-500", etiqueta: "Alerta" },
  { color: "bg-mg-danger-500", etiqueta: "Crítico" },
  { color: "bg-slate-400", etiqueta: "Sin datos" },
]

function CabeceraDashboard({ usuario, onCerrarSesion, onAbrirMenu }) {
  return (
    <header className="bg-mg-navy-900">
      <div className="flex items-center justify-between gap-4 px-6 py-3 sm:px-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onAbrirMenu}
            aria-label="Abrir menú de navegación"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white transition hover:bg-white/10 lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </button>

          {/* CabeceraDashboard solo se renderiza autenticado (Dashboard corta antes
              si no hay token), asi que el logo siempre va al panel, sin necesitar
              leer AuthContext aqui de nuevo. */}
          <Link to="/dashboard" className="flex shrink-0 items-center">
            <img src={logoBlanco} alt="MineGuard" className="h-9 w-auto object-contain" />
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {usuario && (
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-white">{usuario.nombre}</p>
              <p className="text-xs text-mg-accent-300">{ROL_ETIQUETA[usuario.rol] ?? usuario.rol}</p>
            </div>
          )}
          <button
            type="button"
            onClick={onCerrarSesion}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-mg-accent-300"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  )
}

function AvisoCalibracionPendiente() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-mg-accent-300 bg-mg-accent-300/10 px-4 py-3.5 text-sm text-mg-navy-800">
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
        className="mt-0.5 h-5 w-5 shrink-0 text-mg-accent-500"
      >
        <path
          fillRule="evenodd"
          d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zM9 9a1 1 0 012 0v4a1 1 0 11-2 0V9zm1-4a1.25 1.25 0 100 2.5A1.25 1.25 0 0010 5z"
          clipRule="evenodd"
        />
      </svg>
      <p>
        El sistema de clasificación de niveles de alerta está <strong>pendiente de calibración</strong> con
        datos reales de campo. Por ahora, todos los puntos con lecturas muestran el nivel{" "}
        <strong>"Óptimo"</strong> como valor de referencia — esto{" "}
        <strong>no significa que la mina esté verificada como segura</strong>, es un valor por defecto sin
        lógica de clasificación real todavía.
      </p>
    </div>
  )
}

function LeyendaSemaforo() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-mg-navy-700">
      {LEYENDA.map((item) => (
        <div key={item.etiqueta} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} aria-hidden="true" />
          {item.etiqueta}
        </div>
      ))}
    </div>
  )
}

function Dashboard() {
  const navigate = useNavigate()
  const { token, logout } = useAuth()
  const [usuario, setUsuario] = useState(null)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const { puntos, isLoading, error, huboCargaExitosa, recargar } = useEstadoActual(token)

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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-bold text-mg-navy-900">Plano de puntos de control</h1>
            </div>

            <div className="mt-4">
              <AvisoCalibracionPendiente />
            </div>

            {isLoading ? (
              <div className="mt-6 flex aspect-[4/3] items-center justify-center rounded-2xl border border-mg-surface-100 bg-white text-sm text-mg-navy-700 xl:aspect-[16/9]">
                Cargando estado de los puntos de control...
              </div>
            ) : error && !huboCargaExitosa ? (
              <div className="mt-6 rounded-2xl border border-mg-danger-500/30 bg-mg-danger-500/10 p-6 text-center">
                <p className="text-sm font-medium text-mg-danger-500">{error}</p>
                <button
                  type="button"
                  onClick={recargar}
                  className="mt-4 rounded-lg bg-mg-accent-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-mg-accent-600"
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <>
                {error && (
                  <p className="mt-4 text-xs font-medium text-mg-danger-500">
                    No se pudo actualizar (se muestran los últimos datos disponibles): {error}
                  </p>
                )}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <LeyendaSemaforo />
                  <p className="text-xs text-mg-navy-700/70">
                    Pasa el mouse o toca un punto para ver el detalle. Se actualiza automáticamente.
                  </p>
                </div>

                <div className="mt-3">
                  <ErrorBoundary>
                    <PlanoPuntosControl puntos={puntos} />
                  </ErrorBoundary>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default Dashboard
