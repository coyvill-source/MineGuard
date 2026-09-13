import { useState } from "react"
import { ApiError, actualizarPuntoControl, crearPuntoControl } from "../../lib/api"
import Modal from "../Modal"
import CamposPuntoControl from "./CamposPuntoControl"

const VALORES_VACIOS = { estacion_id: "", nombre_estacion: "", coord_x: "", coord_y: "", coord_z: "" }

function valoresIniciales(punto) {
  if (!punto) return VALORES_VACIOS
  return {
    estacion_id: String(punto.estacion_id),
    nombre_estacion: punto.nombre_estacion,
    coord_x: String(punto.coord_x),
    coord_y: String(punto.coord_y),
    coord_z: String(punto.coord_z),
  }
}

function validar(valores) {
  if (valores.estacion_id === "") return "Selecciona una estación."
  if (valores.nombre_estacion.trim() === "") return "El nombre / número de control es obligatorio."
  for (const campo of ["coord_x", "coord_y", "coord_z"]) {
    if (valores[campo] === "" || Number.isNaN(Number(valores[campo]))) {
      return "Las coordenadas deben ser números válidos."
    }
  }
  return null
}

// Solo se monta cuando hay algo que crear/editar (ver PuntosControl.jsx) - así
// el formulario arranca limpio en cada apertura sin necesitar un useEffect.
function ModalPuntoDirecto({ modo, punto, estacionesDisponibles, token, onCerrar, onExito }) {
  const [valores, setValores] = useState(() => valoresIniciales(punto))
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(evento) {
    evento.preventDefault()
    const mensajeError = validar(valores)
    if (mensajeError) {
      setError(mensajeError)
      return
    }

    setError("")
    setEnviando(true)
    const datos = {
      estacion_id: Number(valores.estacion_id),
      nombre_estacion: valores.nombre_estacion.trim(),
      coord_x: Number(valores.coord_x),
      coord_y: Number(valores.coord_y),
      coord_z: Number(valores.coord_z),
    }

    try {
      if (modo === "crear") {
        await crearPuntoControl(token, datos)
        onExito(`Punto de control "${datos.nombre_estacion}" creado correctamente.`)
      } else {
        await actualizarPuntoControl(token, punto.id, datos)
        onExito(`Punto de control "${datos.nombre_estacion}" actualizado correctamente.`)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el punto de control.")
      setEnviando(false)
    }
  }

  return (
    <Modal
      onCerrar={onCerrar}
      titulo={modo === "crear" ? "Crear punto de control" : `Editar punto ${punto?.nombre_estacion}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <div className="rounded-lg border border-mg-danger-500/30 bg-mg-danger-500/10 px-4 py-3 text-sm font-medium text-mg-danger-500">
            {error}
          </div>
        )}

        <CamposPuntoControl
          valores={valores}
          onCambiar={(campo, valor) => setValores((v) => ({ ...v, [campo]: valor }))}
          estacionesDisponibles={estacionesDisponibles}
          placeholderVacio="Requerido"
        />

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
            {enviando ? "Guardando..." : modo === "crear" ? "Crear" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default ModalPuntoDirecto
