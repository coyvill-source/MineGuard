import DashboardLayout from "../components/dashboard/DashboardLayout"
import ErrorBoundary from "../components/ErrorBoundary"
import PlanoPuntosControl from "../components/dashboard/PlanoPuntosControl"
import { useAuth } from "../context/AuthContext"
import { useEstadoActual } from "../hooks/useEstadoActual"

const LEYENDA = [
  { color: "bg-mg-safe-500", etiqueta: "Óptimo" },
  { color: "bg-mg-alert-500", etiqueta: "Alerta" },
  { color: "bg-mg-danger-500", etiqueta: "Crítico" },
  { color: "bg-slate-400", etiqueta: "Sin datos" },
]

function AvisoModeloTemporal() {
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
      <p className="max-w-3xl leading-relaxed">
        Los niveles de alerta (óptimo/alerta/crítico) ya se calculan con los umbrales reales del{" "}
        <strong>Decreto 1886</strong>, convirtiendo la lectura de gas de ppm a % de metano. El{" "}
        <strong>StandardScaler</strong> que usa el modelo de predicción sigue siendo una{" "}
        <strong>aproximación temporal</strong> derivada localmente (no el scaler original de
        entrenamiento), así que la corrección del modelo — y por lo tanto la clasificación que depende
        de ella — puede no ser perfectamente precisa todavía.
      </p>
    </div>
  )
}

function LeyendaSemaforo() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {LEYENDA.map((item) => (
        <div key={item.etiqueta} className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ring-2 ring-white ${item.color}`} aria-hidden="true" />
          <span className="text-xs font-medium text-mg-navy-700">{item.etiqueta}</span>
        </div>
      ))}
    </div>
  )
}

function BarraPlano() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-mg-surface-100 bg-white px-4 py-3 shadow-sm shadow-mg-navy-900/5">
      <LeyendaSemaforo />
      <p className="text-xs text-mg-navy-700/70">
        Pasa el mouse o toca un punto para ver el detalle. Se actualiza automáticamente.
      </p>
    </div>
  )
}

function Dashboard() {
  const { token } = useAuth()
  const { puntos, isLoading, error, huboCargaExitosa, recargar } = useEstadoActual(token)

  return (
    <DashboardLayout titulo="Plano de puntos de control" anchoCompleto>
      <div className="mt-4">
        <AvisoModeloTemporal />
      </div>

      {isLoading ? (
        <div
          className="mt-6 flex aspect-[4/3] items-center justify-center rounded-2xl border border-mg-surface-100 bg-white text-sm text-mg-navy-700 xl:aspect-[16/9]"
          style={{ maxHeight: "calc(100vh - 21rem)" }}
        >
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

          <div className="mt-6">
            <BarraPlano />
          </div>

          {/* justify-center: dentro de un flex, PlanoPuntosControl deja de
              forzar ancho=100% (ver max-w-full + max-height + aspect-ratio
              en su propio contenedor) para poder encoger su ancho cuando la
              altura del viewport es la restricción activa - así todo el
              dashboard cabe sin scroll en laptops estándar. Centrado
              horizontal para que no quede pegado a la izquierda cuando el
              panel termina siendo más angosto que el área disponible. */}
          <div className="mt-3 flex justify-center">
            <ErrorBoundary>
              <PlanoPuntosControl puntos={puntos} />
            </ErrorBoundary>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}

export default Dashboard
