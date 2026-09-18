import DashboardLayout from "../components/dashboard/DashboardLayout"
import GraficoEstadoActual from "../components/estadisticas/GraficoEstadoActual"
import { useAuth } from "../context/AuthContext"
import { useEstadisticas } from "../hooks/useEstadisticas"

// Mismo "recipe" de tarjeta que ya usan PlanoPuntosControl.jsx y
// GraficoHistorial.jsx: rounded-2xl + borde mg-surface-100 + shadow-lg
// mg-navy-900/5 + ring-1 mg-navy-900/5 - ninguna sombra/radio nuevos.
const CLASE_TARJETA =
  "rounded-2xl border border-mg-surface-100 bg-white p-4 shadow-lg shadow-mg-navy-900/5 ring-1 ring-mg-navy-900/5 sm:p-6"

function formatearDuracion(minutos) {
  if (minutos < 60) return `${minutos.toFixed(1)} min`
  const horas = Math.floor(minutos / 60)
  const minutosRestantes = Math.round(minutos % 60)
  return `${horas} h ${minutosRestantes} min`
}

function Titulo({ children }) {
  return <h2 className="text-lg font-bold text-mg-navy-900">{children}</h2>
}

function TarjetaEstadoActual({ conteo }) {
  return (
    <div className={CLASE_TARJETA}>
      <Titulo>Estado actual de riesgo</Titulo>
      <p className="mt-1 text-sm text-mg-navy-700">
        Nivel de alerta de la última lectura de cada punto de control activo.
      </p>
      <div className="mt-4">
        <GraficoEstadoActual conteo={conteo} />
      </div>
    </div>
  )
}

function TarjetaResolucionAlertas({ resolucion }) {
  return (
    <div className={CLASE_TARJETA}>
      <Titulo>Tiempo promedio de resolución de alertas</Titulo>
      <p className="mt-1 text-sm text-mg-navy-700">
        Desde que se reporta una alerta hasta que un Supervisor la marca como resuelta.
      </p>
      <div className="mt-6 flex flex-col items-center justify-center py-4 text-center">
        {resolucion.promedio_minutos === null ? (
          <p className="text-sm text-mg-navy-700">
            Todavía no hay alertas resueltas para calcular un promedio.
          </p>
        ) : (
          <>
            <p className="text-4xl font-bold text-mg-navy-900">
              {formatearDuracion(resolucion.promedio_minutos)}
            </p>
            <p className="mt-2 text-xs text-mg-navy-700/70">
              Basado en {resolucion.cantidad_resueltas} alerta
              {resolucion.cantidad_resueltas === 1 ? "" : "s"} resuelta
              {resolucion.cantidad_resueltas === 1 ? "" : "s"}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function TarjetaRanking({ ranking }) {
  return (
    <div className={CLASE_TARJETA}>
      <Titulo>Puntos de control más problemáticos</Titulo>
      <p className="mt-1 text-sm text-mg-navy-700">
        Puntos con más lecturas históricas en nivel Alerta o Crítico.
      </p>

      {ranking.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-mg-surface-100 bg-mg-surface-50 px-4 py-6 text-center text-sm text-mg-navy-700">
          No hay lecturas en Alerta o Crítico registradas todavía.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-mg-surface-100">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-mg-surface-100 text-xs font-semibold tracking-wide text-mg-navy-700/70 uppercase">
                <th className="px-4 py-3">Punto</th>
                <th className="px-4 py-3">Estación</th>
                <th className="px-4 py-3">Lecturas en alerta/crítico</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((punto) => (
                <tr key={punto.punto_control_id} className="border-b border-mg-surface-100 last:border-0">
                  <td className="px-4 py-3 text-sm font-medium text-mg-navy-900">{punto.nombre_estacion}</td>
                  <td className="px-4 py-3 text-sm text-mg-navy-700">{punto.estacion_nombre}</td>
                  <td className="px-4 py-3 text-sm text-mg-navy-700">{punto.total_lecturas_problematicas}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        punto.activo ? "bg-mg-safe-500/10 text-mg-safe-500" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {punto.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function formatearFechaHora(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })
}

function TarjetaBateriaBaja({ puntos, umbral }) {
  return (
    <div className={CLASE_TARJETA}>
      <Titulo>Salud de sensores</Titulo>
      <p className="mt-1 text-sm text-mg-navy-700">
        Puntos cuya última lectura tiene batería por debajo de {umbral}%.
      </p>

      {puntos.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-mg-surface-100 bg-mg-surface-50 px-4 py-6 text-center text-sm text-mg-navy-700">
          No hay puntos con batería baja en este momento.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-mg-surface-100">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-mg-surface-100 text-xs font-semibold tracking-wide text-mg-navy-700/70 uppercase">
                <th className="px-4 py-3">Punto</th>
                <th className="px-4 py-3">Estación</th>
                <th className="px-4 py-3">Batería</th>
                <th className="px-4 py-3">Última lectura</th>
              </tr>
            </thead>
            <tbody>
              {puntos.map((punto) => (
                <tr key={punto.punto_control_id} className="border-b border-mg-surface-100 last:border-0">
                  <td className="px-4 py-3 text-sm font-medium text-mg-navy-900">{punto.nombre_estacion}</td>
                  <td className="px-4 py-3 text-sm text-mg-navy-700">{punto.estacion_nombre}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-mg-danger-500">
                    {punto.bateria.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-sm text-mg-navy-700">{formatearFechaHora(punto.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ContenidoEstadisticas({ token }) {
  const { datos, isLoading, error, recargar } = useEstadisticas(token)

  if (isLoading) {
    return <p className="mt-6 text-sm text-mg-navy-700">Cargando estadísticas...</p>
  }

  if (error) {
    return (
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
    )
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <TarjetaEstadoActual conteo={datos.estado_actual} />
      <TarjetaResolucionAlertas resolucion={datos.resolucion_alertas} />
      <TarjetaRanking ranking={datos.ranking_problematicos} />
      <TarjetaBateriaBaja puntos={datos.bateria_baja} umbral={datos.umbral_bateria_baja_porcentaje} />
    </div>
  )
}

function Estadisticas() {
  const { token } = useAuth()

  return (
    <DashboardLayout titulo="Estadísticas">
      <p className="mt-4 max-w-2xl text-sm text-mg-navy-700">
        Métricas de la operación completa: riesgo actual, puntos con más historial problemático, tiempo de
        respuesta a alertas y salud de los sensores.
      </p>
      <ContenidoEstadisticas token={token} />
    </DashboardLayout>
  )
}

export default Estadisticas
