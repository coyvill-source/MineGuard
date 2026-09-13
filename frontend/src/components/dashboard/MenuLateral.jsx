import { useEffect } from "react"
import { NavLink } from "react-router-dom"

function construirOpciones(rol) {
  const opciones = [
    { id: "plano", etiqueta: "Plano", to: "/dashboard", habilitado: true },
    { id: "puntos-control", etiqueta: "Puntos de Control", to: "/puntos-control", habilitado: true },
    { id: "alertas", etiqueta: "Alertas", habilitado: false },
  ]

  if (rol === "supervisor" || rol === "admin") {
    opciones.push({ id: "aprobaciones", etiqueta: "Aprobaciones", habilitado: false })
  }
  if (rol === "admin") {
    opciones.push({ id: "usuarios", etiqueta: "Gestión de Usuarios", habilitado: false })
  }

  return opciones
}

function ItemMenu({ opcion, onNavegar }) {
  if (!opcion.habilitado) {
    return (
      <button
        type="button"
        disabled
        title="Próximamente"
        className="flex w-full cursor-not-allowed items-center justify-between rounded-lg px-3.5 py-2.5 text-left text-sm font-medium text-mg-navy-700/40"
      >
        {opcion.etiqueta}
        <span className="rounded-full bg-mg-surface-100 px-2 py-0.5 text-[10px] font-semibold text-mg-navy-700/60">
          Próximamente
        </span>
      </button>
    )
  }

  return (
    <NavLink
      to={opcion.to}
      onClick={onNavegar}
      className={({ isActive }) =>
        `block rounded-lg px-3.5 py-2.5 text-sm font-semibold transition ${
          isActive
            ? "bg-mg-accent-500 text-white"
            : "text-mg-navy-800 hover:bg-mg-surface-100 hover:text-mg-accent-500"
        }`
      }
    >
      {opcion.etiqueta}
    </NavLink>
  )
}

function ListaOpciones({ opciones, onNavegar }) {
  return (
    <nav className="flex flex-col gap-1">
      {opciones.map((opcion) => (
        <ItemMenu key={opcion.id} opcion={opcion} onNavegar={onNavegar} />
      ))}
    </nav>
  )
}

function MenuLateral({ rol, abierto, onCerrar }) {
  const opciones = construirOpciones(rol)

  useEffect(() => {
    if (!abierto) return

    const alPresionarTecla = (evento) => {
      if (evento.key === "Escape") onCerrar()
    }

    document.addEventListener("keydown", alPresionarTecla)
    const overflowOriginal = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", alPresionarTecla)
      document.body.style.overflow = overflowOriginal
    }
  }, [abierto, onCerrar])

  return (
    <>
      {/* Panoramico: fijo a la izquierda, siempre visible */}
      <aside className="hidden w-60 shrink-0 border-r border-mg-surface-100 bg-white px-3 py-6 lg:block">
        <ListaOpciones opciones={opciones} />
      </aside>

      {/* Tablet / angosto: drawer deslizable con overlay, activado por hamburguesa */}
      {abierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Fondo decorativo: oculto para lectores de pantalla (redundante con el
              boton X y con Escape, que sí son accesibles) para no duplicar el
              aria-label "Cerrar menú" del boton X real. */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={onCerrar}
            className="absolute inset-0 bg-mg-navy-950/50"
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[80vw] bg-white px-3 py-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between px-3">
              <span className="text-sm font-bold text-mg-navy-900">Menú</span>
              <button
                type="button"
                onClick={onCerrar}
                aria-label="Cerrar menú"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-mg-navy-800 transition hover:bg-mg-surface-100"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <ListaOpciones opciones={opciones} onNavegar={onCerrar} />
          </aside>
        </div>
      )}
    </>
  )
}

export default MenuLateral
