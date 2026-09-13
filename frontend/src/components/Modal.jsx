import { useEffect } from "react"

// Se monta/desmonta condicionalmente desde el llamador (nunca con un prop
// `abierto`) para que el estado interno del formulario que contiene se
// reinicie solo, sin necesitar sincronizarlo a mano con un efecto.
function Modal({ onCerrar, titulo, children }) {
  useEffect(() => {
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
  }, [onCerrar])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onCerrar}
        className="absolute inset-0 bg-mg-navy-950/50"
      />
      <div className="relative max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-mg-navy-900">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-mg-navy-700 transition hover:bg-mg-surface-100"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}

export default Modal
