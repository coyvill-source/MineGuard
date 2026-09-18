import { useEffect, useMemo, useState } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ApiError, obtenerHistorialTelemetria } from "../../lib/api"

// Grosor uniforme de las 4 lineas: mas presencia visual que el default de
// recharts (1px) sin volverse un bloque solido dificil de leer donde dos
// lineas se cruzan.
const GROSOR_LINEA = 2.75

// Temperatura/Humedad/Bateria comparten escala 0-100 (eje izquierdo); el gas
// corregido en % de metano vive en 0-2% (Decreto 1886) - mezclarlo con las
// otras 3 en el mismo eje lo aplanaria a una linea casi recta pegada a 0, asi
// que va en su propio eje derecho. Colores tomados de la paleta de marca ya
// existente (`mg-accent`/`mg-navy` de src/index.css) mas los 2 tonos "no
// semaforo" ya precedentados en otras pantallas de este mismo proyecto
// (emerald-700 del tunel decorativo en PlanoPuntosControl.jsx, purple-700
// del badge "muteada" en TablaAlertas.jsx) - asi las 4 lineas se sienten
// parte del mismo sistema visual en vez de los colores de ejemplo por
// defecto de recharts (#8884d8/#82ca9d/...). Deliberadamente DISTINTOS de
// la paleta semaforo (mg-safe/mg-alert/mg-danger, verde/amarillo/rojo) que
// ya usa el Dashboard para nivel_alerta - estas son series de datos, no
// estados de alerta, usar esos colores aqui confundiria los dos
// significados (mismo criterio ya aplicado en PlanoPuntosControl.jsx).
const VARIABLES = [
  { clave: "temperatura", etiqueta: "Temperatura (°C)", color: "#2e75b6", eje: "izquierda" }, // mg-accent-500
  { clave: "humedad", etiqueta: "Humedad (%)", color: "#047857", eje: "izquierda" }, // emerald-700 (tunel del Plano)
  { clave: "bateria", etiqueta: "Batería (%)", color: "#7e22ce", eje: "izquierda" }, // purple-700 (badge "muteada")
  { clave: "gas_corregido_porcentaje", etiqueta: "Gas corregido (% CH4)", color: "#1f3864", eje: "derecha" }, // mg-navy-800
]

function formatearFechaISO(fecha) {
  return fecha.toISOString().slice(0, 10)
}

// Por defecto, los ultimos 3 dias: suficiente para mostrar algo apenas se
// abre la seccion sin necesitar que el usuario elija fechas a mano, y lo
// bastante corto para no chocar con el limite de LIMITE_HISTORIAL del
// backend en un punto con mucha actividad reciente (ver docs/PROJECT_CONTEXT.md).
function rangoPorDefecto() {
  const hoy = new Date()
  const haceTresDias = new Date(hoy)
  haceTresDias.setDate(hoy.getDate() - 3)
  return { desde: formatearFechaISO(haceTresDias), hasta: formatearFechaISO(hoy) }
}

function formatearTickEje(iso) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatearFechaTooltip(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })
}

// Reutiliza los puntos ya cargados por PuntosControl.jsx (mismo patron que
// ModalProponerCambio/ModalReportarAlerta: no vuelve a pedirlos al backend).
function GraficoHistorial({ puntos, token }) {
  const puntosActivos = useMemo(() => puntos.filter((p) => p.activo), [puntos])

  const [puntoControlId, setPuntoControlId] = useState("")
  const [rango, setRango] = useState(rangoPorDefecto)
  // Las 4 variables visibles por defecto ("el usuario decide cuales ver a
  // la vez" - se interpreta como que arranca mostrando todo y el usuario
  // desmarca lo que no le interesa, en vez de arrancar vacio).
  const [variablesVisibles, setVariablesVisibles] = useState({
    temperatura: true,
    humedad: true,
    bateria: true,
    gas_corregido_porcentaje: true,
  })

  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")
  const [consultado, setConsultado] = useState(false)

  useEffect(() => {
    if (puntoControlId === "" && puntosActivos.length > 0) {
      setPuntoControlId(String(puntosActivos[0].id))
    }
  }, [puntosActivos, puntoControlId])

  useEffect(() => {
    if (!puntoControlId || !rango.desde || !rango.hasta) return

    if (rango.desde > rango.hasta) {
      setError("La fecha 'desde' no puede ser posterior a 'hasta'.")
      setDatos([])
      setConsultado(true)
      return
    }

    let cancelado = false
    setCargando(true)
    setError("")

    obtenerHistorialTelemetria(token, {
      puntoControlId,
      desde: rango.desde,
      hasta: rango.hasta,
    })
      .then((data) => {
        if (!cancelado) {
          setDatos(data)
          setConsultado(true)
        }
      })
      .catch((err) => {
        if (!cancelado) {
          setError(err instanceof ApiError ? err.message : "No se pudo cargar el historial.")
          setDatos([])
          setConsultado(true)
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })

    return () => {
      cancelado = true
    }
  }, [token, puntoControlId, rango])

  function alternarVariable(clave) {
    setVariablesVisibles((v) => ({ ...v, [clave]: !v[clave] }))
  }

  const variablesActivas = VARIABLES.filter((v) => variablesVisibles[v.clave])
  const hayEjeDerecho = variablesActivas.some((v) => v.eje === "derecha")
  const hayEjeIzquierdo = variablesActivas.some((v) => v.eje === "izquierda")

  return (
    <div className="mt-8 rounded-2xl border border-mg-surface-100 bg-white p-4 shadow-lg shadow-mg-navy-900/5 sm:p-6">
      <h2 className="text-lg font-semibold text-mg-navy-900">Histórico de lecturas</h2>
      <p className="mt-1 text-sm text-mg-navy-700">
        Selecciona un punto de control y un rango de fechas para ver su comportamiento en el tiempo.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="hist-punto" className="block text-sm font-medium text-mg-navy-800">
            Punto de control
          </label>
          <select
            id="hist-punto"
            value={puntoControlId}
            onChange={(evento) => setPuntoControlId(evento.target.value)}
            disabled={puntosActivos.length === 0}
            className="mt-1.5 rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
          >
            {puntosActivos.length === 0 && <option value="">Sin puntos activos</option>}
            {puntosActivos.map((punto) => (
              <option key={punto.id} value={punto.id}>
                Punto {punto.nombre_estacion} - {punto.estacion_nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="hist-desde" className="block text-sm font-medium text-mg-navy-800">
            Desde
          </label>
          <input
            id="hist-desde"
            type="date"
            value={rango.desde}
            max={rango.hasta}
            onChange={(evento) => setRango((r) => ({ ...r, desde: evento.target.value }))}
            className="mt-1.5 rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
          />
        </div>

        <div>
          <label htmlFor="hist-hasta" className="block text-sm font-medium text-mg-navy-800">
            Hasta
          </label>
          <input
            id="hist-hasta"
            type="date"
            value={rango.hasta}
            min={rango.desde}
            onChange={(evento) => setRango((r) => ({ ...r, hasta: evento.target.value }))}
            className="mt-1.5 rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
          />
        </div>
      </div>

      <fieldset className="mt-4 flex flex-wrap gap-2">
        <legend className="sr-only">Variables visibles en el gráfico</legend>
        {VARIABLES.map((variable) => {
          const activa = variablesVisibles[variable.clave]
          return (
            <label
              key={variable.clave}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                activa
                  ? "border-mg-surface-100 bg-mg-surface-50 text-mg-navy-900"
                  : "border-mg-surface-100 bg-white text-mg-navy-700/50"
              }`}
            >
              <input
                type="checkbox"
                checked={activa}
                onChange={() => alternarVariable(variable.clave)}
                className="h-4 w-4 rounded border-mg-surface-100"
                style={{ accentColor: variable.color }}
              />
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full transition-opacity"
                style={{ backgroundColor: variable.color, opacity: activa ? 1 : 0.35 }}
              />
              {variable.etiqueta}
            </label>
          )
        })}
      </fieldset>

      <div className="mt-6">
        {puntosActivos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-mg-surface-100 bg-mg-surface-50 px-4 py-6 text-center text-sm text-mg-navy-700">
            No hay puntos de control activos para mostrar.
          </p>
        ) : cargando ? (
          <p className="text-sm text-mg-navy-700">Cargando historial...</p>
        ) : error ? (
          <div className="rounded-lg border border-mg-danger-500/30 bg-mg-danger-500/10 px-4 py-3 text-sm font-medium text-mg-danger-500">
            {error}
          </div>
        ) : consultado && datos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-mg-surface-100 bg-mg-surface-50 px-4 py-6 text-center text-sm text-mg-navy-700">
            No hay lecturas de este punto de control en el rango de fechas seleccionado. Prueba con otro
            rango.
          </p>
        ) : datos.length === 0 ? (
          <p className="text-sm text-mg-navy-700">Selecciona un punto y un rango de fechas.</p>
        ) : variablesActivas.length === 0 ? (
          <p className="rounded-lg border border-dashed border-mg-surface-100 bg-mg-surface-50 px-4 py-6 text-center text-sm text-mg-navy-700">
            Selecciona al menos una variable para verla en el gráfico.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={datos} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eaf1f8" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatearTickEje}
                tick={{ fontSize: 12, fill: "#274a7e" }}
                stroke="#d7e3f0"
                minTickGap={32}
              />
              {hayEjeIzquierdo && (
                <YAxis yAxisId="izquierda" tick={{ fontSize: 12, fill: "#274a7e" }} stroke="#d7e3f0" />
              )}
              {hayEjeDerecho && (
                <YAxis
                  yAxisId="derecha"
                  orientation="right"
                  tick={{ fontSize: 12, fill: "#274a7e" }}
                  stroke="#d7e3f0"
                />
              )}
              <Tooltip
                labelFormatter={formatearFechaTooltip}
                contentStyle={{ borderRadius: 12, borderColor: "#eaf1f8", fontSize: 13 }}
                labelStyle={{ color: "#14264a", fontWeight: 600 }}
              />
              {/* Sin <Legend/> de recharts: las casillas de arriba ya cumplen ese
                  rol (nombre + color de cada serie) y duplicarlo abajo del
                  grafico era ruido visual repetido. */}
              {variablesActivas.map((variable) => (
                <Line
                  key={variable.clave}
                  type="monotone"
                  dataKey={variable.clave}
                  name={variable.etiqueta}
                  stroke={variable.color}
                  strokeWidth={GROSOR_LINEA}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  yAxisId={variable.eje}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

export default GraficoHistorial
