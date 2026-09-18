import { useEffect, useState } from "react"
import { ApiError, listarPuntosControl, reportarLecturaManual } from "../../lib/api"
import Modal from "../Modal"

const VALORES_VACIOS = { temperatura: "", humedad: "", bateria: "", gasCrudo: "" }

const ETIQUETA_NIVEL = {
  optimo: "Óptimo",
  alerta: "Alerta",
  critico: "Crítico",
  sin_clasificar: "Sin clasificar",
}

function validar(puntoControlId, valores) {
  if (!puntoControlId) return "Selecciona el punto de control."
  if (valores.gasCrudo === "") return "El gas es obligatorio."
  return null
}

// Cuarto modo de ingesta (junto a archivo/aleatorio/generador continuo): un
// Trabajador en campo con instrumento portatil reporta una lectura. Temp/
// Humedad/Bateria son opcionales - si vienen las 3, el backend corre el
// mismo pipeline ML; si falta alguna, guarda solo el gas sin corregir. Ver
// DECISION en docs/PROJECT_CONTEXT.md.
function ModalReportarLecturaManual({ token, onCerrar }) {
  const [puntos, setPuntos] = useState([])
  const [cargandoPuntos, setCargandoPuntos] = useState(true)
  const [errorPuntos, setErrorPuntos] = useState("")

  const [puntoControlId, setPuntoControlId] = useState("")
  const [valores, setValores] = useState(VALORES_VACIOS)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  const [resultado, setResultado] = useState(null)

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

  const tieneLas3Variables = valores.temperatura !== "" && valores.humedad !== "" && valores.bateria !== ""

  function cambiarValor(campo, valor) {
    setValores((v) => ({ ...v, [campo]: valor }))
    setResultado(null)
  }

  async function handleSubmit(evento) {
    evento.preventDefault()
    const mensajeError = validar(puntoControlId, valores)
    if (mensajeError) {
      setError(mensajeError)
      return
    }

    setError("")
    setResultado(null)
    setEnviando(true)
    try {
      const respuesta = await reportarLecturaManual(token, {
        punto_control_id: Number(puntoControlId),
        temperatura: valores.temperatura === "" ? null : Number(valores.temperatura),
        humedad: valores.humedad === "" ? null : Number(valores.humedad),
        bateria: valores.bateria === "" ? null : Number(valores.bateria),
        gas_crudo: Number(valores.gasCrudo),
      })
      setResultado(respuesta)
      setValores(VALORES_VACIOS)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar la lectura manual.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal onCerrar={onCerrar} titulo="Reportar lectura manual">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <p className="text-sm text-mg-navy-700">
          Para cuando mides con un instrumento portátil en campo en vez del sensor digital. Temperatura,
          humedad y batería son opcionales: si las 3 vienen completas, la lectura se corrige con el mismo
          modelo ML que usan las demás ingestas; si falta alguna, se guarda solo el gas, sin corrección.
        </p>

        {error && (
          <div className="rounded-lg border border-mg-danger-500/30 bg-mg-danger-500/10 px-4 py-3 text-sm font-medium text-mg-danger-500">
            {error}
          </div>
        )}

        {resultado && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm font-medium ${
              resultado.corregido_por_modelo
                ? "border-mg-safe-500/30 bg-mg-safe-500/10 text-mg-safe-500"
                : "border-mg-alert-500/30 bg-mg-alert-500/10 text-mg-alert-600"
            }`}
          >
            {resultado.corregido_por_modelo ? (
              <>
                Lectura #{resultado.id} procesada con el modelo ML — gas corregido:{" "}
                {resultado.gas_corregido.toFixed(2)} ppm, nivel {ETIQUETA_NIVEL[resultado.nivel_alerta]}.
              </>
            ) : (
              <>
                Lectura #{resultado.id} guardada sin corrección de modelo (datos incompletos): faltó
                temperatura, humedad y/o batería, así que solo se registró el gas crudo.
              </>
            )}
          </div>
        )}

        <div>
          <label htmlFor="lm-punto-control" className="block text-sm font-medium text-mg-navy-800">
            Punto de control
          </label>
          {cargandoPuntos ? (
            <p className="mt-1.5 text-sm text-mg-navy-700">Cargando puntos de control...</p>
          ) : errorPuntos ? (
            <p className="mt-1.5 text-sm font-medium text-mg-danger-500">{errorPuntos}</p>
          ) : (
            <select
              id="lm-punto-control"
              value={puntoControlId}
              onChange={(evento) => setPuntoControlId(evento.target.value)}
              className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
            >
              <option value="">Selecciona un punto</option>
              {puntos.map((punto) => (
                <option key={punto.id} value={punto.id}>
                  Punto {punto.nombre_estacion} - {punto.estacion_nombre}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="lm-temperatura" className="block text-sm font-medium text-mg-navy-800">
              Temperatura
            </label>
            <input
              id="lm-temperatura"
              type="number"
              step="any"
              value={valores.temperatura}
              onChange={(evento) => cambiarValor("temperatura", evento.target.value)}
              placeholder="Opcional"
              className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-3 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
            />
          </div>
          <div>
            <label htmlFor="lm-humedad" className="block text-sm font-medium text-mg-navy-800">
              Humedad
            </label>
            <input
              id="lm-humedad"
              type="number"
              step="any"
              value={valores.humedad}
              onChange={(evento) => cambiarValor("humedad", evento.target.value)}
              placeholder="Opcional"
              className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-3 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
            />
          </div>
          <div>
            <label htmlFor="lm-bateria" className="block text-sm font-medium text-mg-navy-800">
              Batería
            </label>
            <input
              id="lm-bateria"
              type="number"
              step="any"
              value={valores.bateria}
              onChange={(evento) => cambiarValor("bateria", evento.target.value)}
              placeholder="Opcional"
              className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-3 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
            />
          </div>
        </div>

        <div>
          <label htmlFor="lm-gas" className="block text-sm font-medium text-mg-navy-800">
            Gas (ppm)
          </label>
          <input
            id="lm-gas"
            type="number"
            step="any"
            value={valores.gasCrudo}
            onChange={(evento) => cambiarValor("gasCrudo", evento.target.value)}
            placeholder="Requerido"
            className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
          />
        </div>

        <p className="text-sm text-mg-navy-700">
          {tieneLas3Variables
            ? "Con estos datos, la lectura se procesará con el modelo ML (corrección del gas + clasificación)."
            : "Faltan Temperatura, Humedad y/o Batería: la lectura se guardará solo con el gas, sin corrección de modelo."}
        </p>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg px-4 py-2 text-sm font-medium text-mg-navy-700 transition hover:bg-mg-surface-100"
          >
            Cerrar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="rounded-lg bg-mg-accent-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-mg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? "Enviando..." : "Reportar lectura"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default ModalReportarLecturaManual
