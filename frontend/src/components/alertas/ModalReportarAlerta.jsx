import { useState } from "react"
import { ApiError, crearAlerta } from "../../lib/api"
import Modal from "../Modal"

function validar(telemetriaId, observacion) {
  if (telemetriaId === "" || Number.isNaN(Number(telemetriaId)) || Number(telemetriaId) <= 0) {
    return "Ingresa un ID de telemetría válido."
  }
  if (observacion.trim() === "") return "La observación es obligatoria."
  return null
}

// Nota (limitación conocida, ver docs/PROJECT_CONTEXT.md): no existe un
// endpoint amigable para listar/buscar telemetrias individuales, por eso el
// ID se ingresa como numero simple en vez de un selector - mejorar cuando
// exista ese endpoint.
function ModalReportarAlerta({ token, onCerrar, onExito }) {
  const [telemetriaId, setTelemetriaId] = useState("")
  const [observacion, setObservacion] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(evento) {
    evento.preventDefault()
    const mensajeError = validar(telemetriaId, observacion)
    if (mensajeError) {
      setError(mensajeError)
      return
    }

    setError("")
    setEnviando(true)
    try {
      await crearAlerta(token, {
        telemetria_id: Number(telemetriaId),
        observacion_hse: observacion.trim(),
      })
      onExito(`Alerta reportada sobre la telemetría #${telemetriaId}.`)
    } catch (err) {
      // El backend ya explica bien los casos 404/409 - se muestra tal cual.
      setError(err instanceof ApiError ? err.message : "No se pudo reportar la alerta.")
      setEnviando(false)
    }
  }

  return (
    <Modal onCerrar={onCerrar} titulo="Reportar alerta manual">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <div className="rounded-lg border border-mg-danger-500/30 bg-mg-danger-500/10 px-4 py-3 text-sm font-medium text-mg-danger-500">
            {error}
          </div>
        )}

        <p className="text-xs text-mg-navy-700/70">
          Nota: por ahora el ID de telemetría se ingresa manualmente — todavía no existe un buscador
          amigable de lecturas.
        </p>

        <div>
          <label htmlFor="campo-telemetria-id" className="block text-sm font-medium text-mg-navy-800">
            ID de telemetría
          </label>
          <input
            id="campo-telemetria-id"
            type="number"
            min="1"
            step="1"
            value={telemetriaId}
            onChange={(evento) => setTelemetriaId(evento.target.value)}
            placeholder="Requerido"
            className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
          />
        </div>

        <div>
          <label htmlFor="campo-observacion" className="block text-sm font-medium text-mg-navy-800">
            Observación HSE
          </label>
          <textarea
            id="campo-observacion"
            value={observacion}
            onChange={(evento) => setObservacion(evento.target.value)}
            placeholder="Requerido"
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg px-4 py-2 text-sm font-medium text-mg-navy-700 transition hover:bg-mg-surface-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="rounded-lg bg-mg-accent-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-mg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? "Enviando..." : "Reportar alerta"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default ModalReportarAlerta
