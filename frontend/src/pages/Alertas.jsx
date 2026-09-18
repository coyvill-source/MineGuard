import { useState } from "react"
import ModalReportarAlerta from "../components/alertas/ModalReportarAlerta"
import ModalReportarLecturaManual from "../components/alertas/ModalReportarLecturaManual"
import TablaAlertas from "../components/alertas/TablaAlertas"
import DashboardLayout from "../components/dashboard/DashboardLayout"
import { useAuth } from "../context/AuthContext"
import { useAlertas } from "../hooks/useAlertas"

const OPCIONES_ESTADO = [
  ["", "Todos los estados"],
  ["activa", "Activa"],
  ["muteada", "Muteada"],
  ["resuelta", "Resuelta"],
]

function ContenidoAlertas({ token, rol }) {
  const esGestor = rol === "supervisor" || rol === "admin"
  const [filtroEstado, setFiltroEstado] = useState("")
  const { alertas, isLoading, error, recargar } = useAlertas(token, filtroEstado || undefined)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [modalLecturaAbierto, setModalLecturaAbierto] = useState(false)
  const [mensajeExito, setMensajeExito] = useState("")

  function manejarExito(mensaje) {
    setMensajeExito(mensaje)
    setModalAbierto(false)
    recargar()
  }

  function manejarCambioGestion(mensaje) {
    setMensajeExito(mensaje)
    recargar()
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-mg-navy-700">
          Bitácora de alertas de la estación. La creación es manual mientras el motor automático de
          umbrales sigue bloqueado (ver aviso en el Plano).
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setModalLecturaAbierto(true)}
            className="rounded-lg border border-mg-accent-500 px-4 py-2 text-sm font-semibold text-mg-accent-500 transition hover:bg-mg-accent-500/10"
          >
            Reportar lectura manual
          </button>
          <button
            type="button"
            onClick={() => setModalAbierto(true)}
            className="rounded-lg bg-mg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-mg-accent-600"
          >
            Reportar alerta
          </button>
        </div>
      </div>

      {mensajeExito && (
        <div className="mt-4 rounded-lg border border-mg-safe-500/30 bg-mg-safe-500/10 px-4 py-3 text-sm font-medium text-mg-safe-500">
          {mensajeExito}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <label htmlFor="filtro-estado" className="text-sm font-medium text-mg-navy-800">
          Filtrar por estado
        </label>
        <select
          id="filtro-estado"
          value={filtroEstado}
          onChange={(evento) => setFiltroEstado(evento.target.value)}
          className="rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-3 py-1.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
        >
          {OPCIONES_ESTADO.map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <p className="text-sm text-mg-navy-700">Cargando alertas...</p>
        ) : error ? (
          <div className="rounded-2xl border border-mg-danger-500/30 bg-mg-danger-500/10 p-6 text-center">
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
          <TablaAlertas alertas={alertas} esGestor={esGestor} token={token} onCambio={manejarCambioGestion} />
        )}
      </div>

      {modalAbierto && (
        <ModalReportarAlerta token={token} onCerrar={() => setModalAbierto(false)} onExito={manejarExito} />
      )}

      {modalLecturaAbierto && (
        <ModalReportarLecturaManual token={token} onCerrar={() => setModalLecturaAbierto(false)} />
      )}
    </div>
  )
}

function Alertas() {
  const { token } = useAuth()

  return (
    <DashboardLayout titulo="Alertas">{(usuario) => <ContenidoAlertas token={token} rol={usuario?.rol} />}</DashboardLayout>
  )
}

export default Alertas
