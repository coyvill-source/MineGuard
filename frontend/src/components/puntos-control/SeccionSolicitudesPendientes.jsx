import { useState } from "react"
import { ApiError, aprobarSolicitudCambio, rechazarSolicitudCambio } from "../../lib/api"

const ETIQUETA_TIPO = { crear: "Crear", editar: "Editar", eliminar: "Eliminar" }

function formatearFecha(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })
}

function resumenPropuesta(solicitud) {
  if (solicitud.tipo === "eliminar") return `Marcar el punto #${solicitud.punto_control_id} como inactivo`

  const partes = Object.entries(solicitud.datos_propuestos).map(([campo, valor]) => `${campo}: ${valor}`)
  return partes.length > 0 ? partes.join(" · ") : "(sin campos)"
}

function FilaSolicitud({ solicitud, token, onCambio }) {
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState("")
  const [rechazando, setRechazando] = useState(false)
  const [comentario, setComentario] = useState("")

  async function handleAprobar() {
    setError("")
    setProcesando(true)
    try {
      await aprobarSolicitudCambio(token, solicitud.id)
      onCambio(`Solicitud #${solicitud.id} aprobada y aplicada.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo aprobar la solicitud.")
      setProcesando(false)
    }
  }

  async function handleRechazar() {
    if (!comentario.trim()) {
      setError("Escribe un comentario explicando el motivo del rechazo.")
      return
    }
    setError("")
    setProcesando(true)
    try {
      await rechazarSolicitudCambio(token, solicitud.id, comentario.trim())
      onCambio(`Solicitud #${solicitud.id} rechazada.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo rechazar la solicitud.")
      setProcesando(false)
    }
  }

  return (
    <li className="rounded-xl border border-mg-surface-100 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-mg-navy-900">
            {ETIQUETA_TIPO[solicitud.tipo]}
            {solicitud.punto_control_id ? ` · punto #${solicitud.punto_control_id}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-mg-navy-700">{resumenPropuesta(solicitud)}</p>
          <p className="mt-1 text-[11px] text-mg-navy-700/60">
            Propuesta por usuario #{solicitud.creado_por_id} · {formatearFecha(solicitud.fecha_creacion)}
          </p>
        </div>

        {!rechazando && (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={procesando}
              onClick={handleAprobar}
              className="rounded-lg bg-mg-safe-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-mg-safe-500/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Aprobar
            </button>
            <button
              type="button"
              disabled={procesando}
              onClick={() => setRechazando(true)}
              className="rounded-lg border border-mg-danger-500 px-3 py-1.5 text-xs font-semibold text-mg-danger-500 transition hover:bg-mg-danger-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Rechazar
            </button>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-xs font-medium text-mg-danger-500">{error}</p>}

      {rechazando && (
        <div className="mt-3 space-y-2">
          <textarea
            value={comentario}
            onChange={(evento) => setComentario(evento.target.value)}
            placeholder="Motivo del rechazo (obligatorio)"
            rows={2}
            className="w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-3 py-2 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setRechazando(false)
                setComentario("")
                setError("")
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-mg-navy-700 hover:bg-mg-surface-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={procesando}
              onClick={handleRechazar}
              className="rounded-lg bg-mg-danger-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-mg-danger-500/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {procesando ? "Enviando..." : "Confirmar rechazo"}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

function SeccionSolicitudesPendientes({ solicitudes, isLoading, error, token, onCambio }) {
  return (
    <div className="mt-8">
      <h2 className="text-lg font-bold text-mg-navy-900">Solicitudes pendientes</h2>

      {isLoading ? (
        <p className="mt-3 text-sm text-mg-navy-700">Cargando solicitudes...</p>
      ) : error ? (
        <p className="mt-3 text-sm font-medium text-mg-danger-500">{error}</p>
      ) : solicitudes.length === 0 ? (
        <p className="mt-3 text-sm text-mg-navy-700">No hay solicitudes pendientes.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {solicitudes.map((solicitud) => (
            <FilaSolicitud key={solicitud.id} solicitud={solicitud} token={token} onCambio={onCambio} />
          ))}
        </ul>
      )}
    </div>
  )
}

export default SeccionSolicitudesPendientes
