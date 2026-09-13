import { Link } from "react-router-dom"
import logoBlanco from "../../assets/images/logo/logo_blanco.png"

const ROL_ETIQUETA = {
  trabajador: "Trabajador",
  supervisor: "Supervisor HSE",
  admin: "Administrador",
}

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

          {/* CabeceraDashboard solo se renderiza autenticado (DashboardLayout corta
              antes si no hay token), asi que el logo siempre va al panel, sin
              necesitar leer AuthContext aqui de nuevo. */}
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

export default CabeceraDashboard
