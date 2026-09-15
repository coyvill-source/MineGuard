import { useState } from "react"
import { ApiError, escalarAlerta, mutearAlerta, resolverAlerta } from "../../lib/api"

// Paleta distinta a la del semaforo de nivel_alerta (verde/amarillo/rojo del
// Dashboard) a proposito, para no confundir "estado de la lectura" con
// "estado de gestion de la alerta" - ver docs/PROJECT_CONTEXT.md.
const ESTILO_ESTADO = {
  activa: "bg-mg-accent-500/10 text-mg-accent-600",
  muteada: "bg-purple-100 text-purple-700",
  resuelta: "bg-slate-200 text-slate-600",
}

const ETIQUETA_ESTADO = { activa: "Activa", muteada: "Muteada", resuelta: "Resuelta" }

const ETIQUETA_ACCION = { mutear: "muteada", escalar: "escalada", resolver: "resuelta" }

function FilaAlerta({ alerta, esGestor, token, onCambio }) {
  const [accionActiva, setAccionActiva] = useState(null) // null | "mutear" | "escalar" | "resolver"
  const [observacion, setObservacion] = useState("")
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState("")

  function abrirAccion(accion) {
    setAccionActiva(accion)
    setObservacion("")
    setError("")
  }

  function cerrarAccion() {
    setAccionActiva(null)
    setObservacion("")
    setError("")
  }

  async function confirmar() {
    if (accionActiva === "resolver" && observacion.trim() === "") {
      setError("La observación es obligatoria para resolver una alerta.")
      return
    }

    setError("")
    setProcesando(true)
    try {
      const obsOpcional = observacion.trim() || undefined
      if (accionActiva === "mutear") await mutearAlerta(token, alerta.id, obsOpcional)
      else if (accionActiva === "escalar") await escalarAlerta(token, alerta.id, obsOpcional)
      else await resolverAlerta(token, alerta.id, observacion.trim())

      onCambio(`Alerta #${alerta.id} ${ETIQUETA_ACCION[accionActiva]}.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo procesar la acción.")
      setProcesando(false)
    }
  }

  return (
    <tr className="border-b border-mg-surface-100 last:border-0 align-top">
      <td className="px-4 py-3 text-sm font-medium text-mg-navy-900">{alerta.id}</td>
      <td className="px-4 py-3 text-sm text-mg-navy-700">#{alerta.telemetria_id}</td>
      <td className="px-4 py-3 text-sm">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ESTILO_ESTADO[alerta.estado]}`}>
          {ETIQUETA_ESTADO[alerta.estado] ?? alerta.estado}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-mg-navy-700">{alerta.observacion_hse || "—"}</td>
      {esGestor && (
        <td className="px-4 py-3 text-right text-sm">
          {alerta.estado === "resuelta" ? (
            <span className="text-xs text-mg-navy-700/40">—</span>
          ) : accionActiva ? (
            <div className="w-64 space-y-2 text-left">
              <textarea
                value={observacion}
                onChange={(evento) => setObservacion(evento.target.value)}
                placeholder={
                  accionActiva === "resolver" ? "Observación (obligatoria)" : "Observación (opcional)"
                }
                rows={2}
                className="w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-3 py-2 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
              />
              {error && <p className="text-xs font-medium text-mg-danger-500">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cerrarAccion}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-mg-navy-700 hover:bg-mg-surface-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={procesando}
                  onClick={confirmar}
                  className="rounded-lg bg-mg-accent-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-mg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {procesando ? "Enviando..." : "Confirmar"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => abrirAccion("mutear")}
                className="text-xs font-semibold text-mg-navy-700 hover:underline"
              >
                Mutear
              </button>
              <button
                type="button"
                onClick={() => abrirAccion("escalar")}
                className="text-xs font-semibold text-mg-accent-500 hover:underline"
              >
                Escalar
              </button>
              <button
                type="button"
                onClick={() => abrirAccion("resolver")}
                className="text-xs font-semibold text-mg-safe-500 hover:underline"
              >
                Resolver
              </button>
            </div>
          )}
        </td>
      )}
    </tr>
  )
}

function TablaAlertas({ alertas, esGestor, token, onCambio }) {
  if (alertas.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-mg-surface-100 bg-white p-6 text-center text-sm text-mg-navy-700">
        No hay alertas para mostrar.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-mg-surface-100 bg-white">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-mg-surface-100 text-xs font-semibold tracking-wide text-mg-navy-700/70 uppercase">
            <th className="px-4 py-3">ID</th>
            <th className="px-4 py-3">Telemetría</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Observación</th>
            {esGestor && <th className="px-4 py-3 text-right">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {alertas.map((alerta) => (
            <FilaAlerta key={alerta.id} alerta={alerta} esGestor={esGestor} token={token} onCambio={onCambio} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default TablaAlertas
