import { useState } from "react"
import { ApiError, proponerCambioPuntoControl } from "../../lib/api"
import Modal from "../Modal"
import CamposPuntoControl from "./CamposPuntoControl"

const VALORES_VACIOS = { estacion_id: "", nombre_estacion: "", coord_x: "", coord_y: "", coord_z: "" }

const TIPOS = [
  ["crear", "Crear"],
  ["editar", "Editar"],
  ["eliminar", "Eliminar"],
]

// Para "editar" solo se incluyen los campos que el usuario si lleno (partial
// update, igual que valida el backend) - dejar un campo vacio significa "sin
// cambio", no se sobreescribe con null.
function construirDatosPropuestos(tipo, valores) {
  if (tipo === "eliminar") return {}

  const datos = {}
  if (valores.estacion_id !== "") datos.estacion_id = Number(valores.estacion_id)
  if (valores.nombre_estacion.trim() !== "") datos.nombre_estacion = valores.nombre_estacion.trim()
  for (const campo of ["coord_x", "coord_y", "coord_z"]) {
    if (valores[campo] !== "") datos[campo] = Number(valores[campo])
  }
  return datos
}

function validar(tipo, puntoControlId, valores) {
  if (tipo === "crear") {
    if (
      valores.estacion_id === "" ||
      valores.nombre_estacion.trim() === "" ||
      valores.coord_x === "" ||
      valores.coord_y === "" ||
      valores.coord_z === ""
    ) {
      return "Para crear un punto se requieren estación, nombre y las 3 coordenadas."
    }
    return null
  }

  if (!puntoControlId) return "Selecciona el punto de control existente."

  if (tipo === "editar" && Object.keys(construirDatosPropuestos(tipo, valores)).length === 0) {
    return "Completa al menos un campo para proponer un cambio."
  }

  return null
}

function ModalProponerCambio({ puntos, token, onCerrar, onExito }) {
  const [tipo, setTipo] = useState("crear")
  const [puntoControlId, setPuntoControlId] = useState("")
  const [valores, setValores] = useState(VALORES_VACIOS)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")

  const puntosActivos = puntos.filter((p) => p.activo)
  const estacionesDisponibles = [...new Set(puntos.map((p) => p.estacion_id))]

  function cambiarTipo(nuevoTipo) {
    setTipo(nuevoTipo)
    setPuntoControlId("")
    setValores(VALORES_VACIOS)
    setError("")
  }

  async function handleSubmit(evento) {
    evento.preventDefault()
    const mensajeError = validar(tipo, puntoControlId, valores)
    if (mensajeError) {
      setError(mensajeError)
      return
    }

    setError("")
    setEnviando(true)
    try {
      await proponerCambioPuntoControl(token, {
        tipo,
        punto_control_id: tipo === "crear" ? null : Number(puntoControlId),
        datos_propuestos: construirDatosPropuestos(tipo, valores),
      })
      onExito("Tu solicitud quedó pendiente de aprobación por un Supervisor o Administrador.")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar la solicitud.")
      setEnviando(false)
    }
  }

  return (
    <Modal onCerrar={onCerrar} titulo="Proponer cambio de punto de control">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <div className="rounded-lg border border-mg-danger-500/30 bg-mg-danger-500/10 px-4 py-3 text-sm font-medium text-mg-danger-500">
            {error}
          </div>
        )}

        <div>
          <span className="block text-sm font-medium text-mg-navy-800">Tipo de cambio</span>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {TIPOS.map(([valor, etiqueta]) => (
              <button
                key={valor}
                type="button"
                onClick={() => cambiarTipo(valor)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                  tipo === valor
                    ? "border-mg-accent-500 bg-mg-accent-500 text-white"
                    : "border-mg-surface-100 text-mg-navy-700 hover:border-mg-accent-300"
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>
        </div>

        {tipo !== "crear" && (
          <div>
            <label htmlFor="punto-existente" className="block text-sm font-medium text-mg-navy-800">
              Punto de control existente
            </label>
            <select
              id="punto-existente"
              value={puntoControlId}
              onChange={(evento) => setPuntoControlId(evento.target.value)}
              className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
            >
              <option value="">Selecciona un punto</option>
              {puntosActivos.map((p) => (
                <option key={p.id} value={p.id}>
                  Punto {p.nombre_estacion} - {p.estacion_nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        {tipo !== "eliminar" && (
          <CamposPuntoControl
            valores={valores}
            onCambiar={(campo, valor) => setValores((v) => ({ ...v, [campo]: valor }))}
            estacionesDisponibles={estacionesDisponibles}
            placeholderVacio={tipo === "editar" ? "(sin cambio)" : "Requerido"}
          />
        )}

        {tipo === "eliminar" && (
          <p className="text-sm text-mg-navy-700">
            Se propondrá marcar este punto de control como inactivo. Un Supervisor o Administrador debe
            aprobar el cambio antes de que se aplique.
          </p>
        )}

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
            {enviando ? "Enviando..." : "Enviar solicitud"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default ModalProponerCambio
