import { useEffect, useState } from "react"
import { ApiError, crearAlerta, listarPuntosControl, listarTelemetriasRecientes } from "../../lib/api"
import Modal from "../Modal"

function formatearFecha(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })
}

function formatearLectura(lectura) {
  const gas = lectura.gas_corregido != null ? lectura.gas_corregido.toFixed(2) : "sin gas corregido"
  return `${formatearFecha(lectura.timestamp)} — gas corregido: ${gas}`
}

function validar(telemetriaId, observacion) {
  if (!telemetriaId) return "Selecciona una lectura de telemetría."
  if (observacion.trim() === "") return "La observación es obligatoria."
  return null
}

// Busqueda guiada en dos pasos (punto de control -> una de sus ultimas
// lecturas) en vez de pedir el telemetria_id a mano - ver decision en
// docs/PROJECT_CONTEXT.md.
function ModalReportarAlerta({ token, onCerrar, onExito }) {
  const [puntos, setPuntos] = useState([])
  const [cargandoPuntos, setCargandoPuntos] = useState(true)
  const [errorPuntos, setErrorPuntos] = useState("")

  const [puntoControlId, setPuntoControlId] = useState("")
  const [lecturas, setLecturas] = useState([])
  const [cargandoLecturas, setCargandoLecturas] = useState(false)
  const [errorLecturas, setErrorLecturas] = useState("")

  const [telemetriaId, setTelemetriaId] = useState("")
  const [observacion, setObservacion] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelado = false

    listarPuntosControl(token)
      .then((data) => {
        if (!cancelado) setPuntos(data.filter((p) => p.activo))
      })
      .catch((err) => {
        if (!cancelado) {
          setErrorPuntos(
            err instanceof ApiError ? err.message : "No se pudieron cargar los puntos de control.",
          )
        }
      })
      .finally(() => {
        if (!cancelado) setCargandoPuntos(false)
      })

    return () => {
      cancelado = true
    }
  }, [token])

  useEffect(() => {
    if (!puntoControlId) {
      setLecturas([])
      return
    }

    let cancelado = false
    setCargandoLecturas(true)
    setErrorLecturas("")
    setTelemetriaId("")

    listarTelemetriasRecientes(token, puntoControlId)
      .then((data) => {
        if (!cancelado) setLecturas(data)
      })
      .catch((err) => {
        if (!cancelado) {
          setErrorLecturas(err instanceof ApiError ? err.message : "No se pudieron cargar las lecturas.")
        }
      })
      .finally(() => {
        if (!cancelado) setCargandoLecturas(false)
      })

    return () => {
      cancelado = true
    }
  }, [token, puntoControlId])

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

        <div>
          <label htmlFor="campo-punto-control" className="block text-sm font-medium text-mg-navy-800">
            Punto de control
          </label>
          {cargandoPuntos ? (
            <p className="mt-1.5 text-sm text-mg-navy-700">Cargando puntos de control...</p>
          ) : errorPuntos ? (
            <p className="mt-1.5 text-sm font-medium text-mg-danger-500">{errorPuntos}</p>
          ) : (
            <select
              id="campo-punto-control"
              value={puntoControlId}
              onChange={(evento) => setPuntoControlId(evento.target.value)}
              className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
            >
              <option value="">Selecciona un punto</option>
              {puntos.map((punto) => (
                <option key={punto.id} value={punto.id}>
                  {punto.nombre_estacion} (estación #{punto.estacion_id})
                </option>
              ))}
            </select>
          )}
        </div>

        {puntoControlId && (
          <div>
            <label htmlFor="campo-lectura" className="block text-sm font-medium text-mg-navy-800">
              Lectura de telemetría
            </label>
            {cargandoLecturas ? (
              <p className="mt-1.5 text-sm text-mg-navy-700">Cargando lecturas...</p>
            ) : errorLecturas ? (
              <p className="mt-1.5 text-sm font-medium text-mg-danger-500">{errorLecturas}</p>
            ) : lecturas.length === 0 ? (
              <p className="mt-1.5 text-sm text-mg-navy-700">
                Este punto de control no tiene lecturas registradas todavía.
              </p>
            ) : (
              <select
                id="campo-lectura"
                value={telemetriaId}
                onChange={(evento) => setTelemetriaId(evento.target.value)}
                className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
              >
                <option value="">Selecciona una lectura</option>
                {lecturas.map((lectura) => (
                  <option key={lectura.id} value={lectura.id}>
                    {formatearLectura(lectura)}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

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
