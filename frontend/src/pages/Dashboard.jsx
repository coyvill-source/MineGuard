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

function AvisoCalibracionPendiente() {
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
      <p>
        El sistema de clasificación de niveles de alerta está <strong>pendiente de calibración</strong> con
        datos reales de campo. Por ahora, todos los puntos con lecturas muestran el nivel{" "}
        <strong>"Óptimo"</strong> como valor de referencia — esto{" "}
        <strong>no significa que la mina esté verificada como segura</strong>, es un valor por defecto sin
        lógica de clasificación real todavía.
      </p>
    </div>
  )
}

function LeyendaSemaforo() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-mg-navy-700">
      {LEYENDA.map((item) => (
        <div key={item.etiqueta} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} aria-hidden="true" />
          {item.etiqueta}
        </div>
      ))}
    </div>
  )
}

function Dashboard() {
  const { token } = useAuth()
  const { puntos, isLoading, error, huboCargaExitosa, recargar } = useEstadoActual(token)

  return (
    <DashboardLayout titulo="Plano de puntos de control">
      <div className="mt-4">
        <AvisoCalibracionPendiente />
      </div>

      {isLoading ? (
        <div className="mt-6 flex aspect-[4/3] items-center justify-center rounded-2xl border border-mg-surface-100 bg-white text-sm text-mg-navy-700 xl:aspect-[16/9]">
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

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <LeyendaSemaforo />
            <p className="text-xs text-mg-navy-700/70">
              Pasa el mouse o toca un punto para ver el detalle. Se actualiza automáticamente.
            </p>
          </div>

          <div className="mt-3">
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
