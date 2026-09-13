import { useState } from "react"
import DashboardLayout from "../components/dashboard/DashboardLayout"
import ModalProponerCambio from "../components/puntos-control/ModalProponerCambio"
import ModalPuntoDirecto from "../components/puntos-control/ModalPuntoDirecto"
import SeccionSolicitudesPendientes from "../components/puntos-control/SeccionSolicitudesPendientes"
import TablaPuntosControl from "../components/puntos-control/TablaPuntosControl"
import { useAuth } from "../context/AuthContext"
import { usePuntosControl } from "../hooks/usePuntosControl"
import { useSolicitudesPendientes } from "../hooks/useSolicitudesPendientes"
import { ApiError, eliminarPuntoControl } from "../lib/api"

function ContenidoPuntosControl({ token, rol, puntos, isLoading, error, recargarPuntos }) {
  const esGestor = rol === "supervisor" || rol === "admin"
  const {
    solicitudes,
    isLoading: cargandoSolicitudes,
    error: errorSolicitudes,
    recargar: recargarSolicitudes,
  } = useSolicitudesPendientes(token, esGestor)

  const [modalDirecto, setModalDirecto] = useState(null) // null | {modo:"crear"} | {modo:"editar", punto}
  const [modalProponerAbierto, setModalProponerAbierto] = useState(false)
  const [mensajeExito, setMensajeExito] = useState("")
  const [errorAccion, setErrorAccion] = useState("")

  const estacionesDisponibles = [...new Set(puntos.map((p) => p.estacion_id))]

  function manejarExitoModal(mensaje) {
    setMensajeExito(mensaje)
    setErrorAccion("")
    setModalDirecto(null)
    setModalProponerAbierto(false)
    recargarPuntos()
  }

  function manejarCambioSolicitud(mensaje) {
    setMensajeExito(mensaje)
    setErrorAccion("")
    recargarPuntos()
    recargarSolicitudes()
  }

  async function handleEliminarDirecto(punto) {
    setErrorAccion("")
    try {
      await eliminarPuntoControl(token, punto.id)
      setMensajeExito(`Punto de control "${punto.nombre_estacion}" marcado como inactivo.`)
      recargarPuntos()
    } catch (err) {
      setErrorAccion(err instanceof ApiError ? err.message : "No se pudo eliminar el punto de control.")
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-mg-navy-700">
          {esGestor
            ? "Puedes crear, editar y eliminar puntos de control directamente, y revisar las solicitudes propuestas por Trabajadores."
            : "Puedes ver los puntos de control existentes y proponer un cambio para que un Supervisor o Administrador lo revise."}
        </p>

        {esGestor ? (
          <button
            type="button"
            onClick={() => setModalDirecto({ modo: "crear" })}
            className="shrink-0 rounded-lg bg-mg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-mg-accent-600"
          >
            Crear punto
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setModalProponerAbierto(true)}
            className="shrink-0 rounded-lg bg-mg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-mg-accent-600"
          >
            Proponer cambio
          </button>
        )}
      </div>

      {mensajeExito && (
        <div className="mt-4 rounded-lg border border-mg-safe-500/30 bg-mg-safe-500/10 px-4 py-3 text-sm font-medium text-mg-safe-500">
          {mensajeExito}
        </div>
      )}
      {errorAccion && (
        <div className="mt-4 rounded-lg border border-mg-danger-500/30 bg-mg-danger-500/10 px-4 py-3 text-sm font-medium text-mg-danger-500">
          {errorAccion}
        </div>
      )}

      <div className="mt-4">
        {isLoading ? (
          <p className="text-sm text-mg-navy-700">Cargando puntos de control...</p>
        ) : error ? (
          <div className="rounded-2xl border border-mg-danger-500/30 bg-mg-danger-500/10 p-6 text-center">
            <p className="text-sm font-medium text-mg-danger-500">{error}</p>
            <button
              type="button"
              onClick={recargarPuntos}
              className="mt-4 rounded-lg bg-mg-accent-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-mg-accent-600"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <TablaPuntosControl
            puntos={puntos}
            esGestor={esGestor}
            onEditar={(punto) => setModalDirecto({ modo: "editar", punto })}
            onEliminar={handleEliminarDirecto}
          />
        )}
      </div>

      {esGestor && (
        <SeccionSolicitudesPendientes
          solicitudes={solicitudes}
          isLoading={cargandoSolicitudes}
          error={errorSolicitudes}
          token={token}
          onCambio={manejarCambioSolicitud}
        />
      )}

      {modalDirecto && (
        <ModalPuntoDirecto
          modo={modalDirecto.modo}
          punto={modalDirecto.punto}
          estacionesDisponibles={estacionesDisponibles}
          token={token}
          onCerrar={() => setModalDirecto(null)}
          onExito={manejarExitoModal}
        />
      )}

      {modalProponerAbierto && (
        <ModalProponerCambio
          puntos={puntos}
          token={token}
          onCerrar={() => setModalProponerAbierto(false)}
          onExito={manejarExitoModal}
        />
      )}
    </div>
  )
}

function PuntosControl() {
  const { token } = useAuth()
  const { puntos, isLoading, error, recargar } = usePuntosControl(token)

  return (
    <DashboardLayout titulo="Puntos de Control">
      {(usuario) => (
        <ContenidoPuntosControl
          token={token}
          rol={usuario?.rol}
          puntos={puntos}
          isLoading={isLoading}
          error={error}
          recargarPuntos={recargar}
        />
      )}
    </DashboardLayout>
  )
}

export default PuntosControl
