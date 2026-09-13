import { useMemo, useRef, useState } from "react"

const PADDING_RATIO = 0.22
const RADIO_RATIO = 0.032

const ESTILO_POR_NIVEL = {
  optimo: { marcador: "fill-mg-safe-500 stroke-mg-safe-500", etiqueta: "Óptimo" },
  alerta: { marcador: "fill-mg-alert-500 stroke-mg-alert-500", etiqueta: "Alerta" },
  critico: { marcador: "fill-mg-danger-500 stroke-mg-danger-500", etiqueta: "Crítico" },
}
const ESTILO_SIN_DATOS = { marcador: "fill-slate-400 stroke-slate-500", etiqueta: "Sin datos" }

// El plano es esquemático (no hay imagen de fondo real de la mina): coord_x
// y coord_y se ubican tal cual en el plano cartesiano, sin invertir el eje Y.
function calcularEscala(puntos) {
  const xs = puntos.map((p) => p.coord_x)
  const ys = puntos.map((p) => p.coord_y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const extent = Math.max(maxX - minX, maxY - minY) || 1
  const centroX = (minX + maxX) / 2
  const centroY = (minY + maxY) / 2
  const mitad = (extent * (1 + PADDING_RATIO)) / 2

  return {
    minX: centroX - mitad,
    minY: centroY - mitad,
    lado: mitad * 2,
    radio: mitad * 2 * RADIO_RATIO,
  }
}

function formatearFecha(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })
}

function formatearNumero(valor, decimales = 2) {
  return typeof valor === "number" ? valor.toFixed(decimales) : "—"
}

function DatoTooltip({ etiqueta, valor, ancho = "" }) {
  return (
    <div className={ancho}>
      <dt className="text-[10px] uppercase tracking-wide text-mg-navy-700/70">{etiqueta}</dt>
      <dd className="font-semibold text-mg-navy-900">{valor}</dd>
    </div>
  )
}

function TooltipContenido({ punto }) {
  const lectura = punto.ultima_lectura

  return (
    <div>
      <p className="text-sm font-bold text-mg-navy-900">Punto {punto.nombre_estacion}</p>
      <p className="mt-0.5 text-xs text-mg-navy-700">
        x: {formatearNumero(punto.coord_x, 1)} · y: {formatearNumero(punto.coord_y, 1)} · z:{" "}
        {formatearNumero(punto.coord_z, 1)}
      </p>

      {lectura ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <DatoTooltip etiqueta="Temperatura" valor={`${formatearNumero(lectura.temperatura)} °C`} />
          <DatoTooltip etiqueta="Humedad" valor={`${formatearNumero(lectura.humedad)} %`} />
          <DatoTooltip etiqueta="Batería" valor={`${formatearNumero(lectura.bateria)} %`} />
          <DatoTooltip etiqueta="Gas crudo" valor={formatearNumero(lectura.gas_crudo, 0)} />
          <DatoTooltip
            etiqueta="Gas corregido"
            valor={lectura.gas_corregido != null ? formatearNumero(lectura.gas_corregido, 2) : "—"}
            ancho="col-span-2"
          />
          <DatoTooltip etiqueta="Última lectura" valor={formatearFecha(lectura.timestamp)} ancho="col-span-2" />
        </dl>
      ) : (
        <p className="mt-3 text-xs font-medium text-mg-navy-700">Sin datos registrados</p>
      )}
    </div>
  )
}

function PlanoPuntosControl({ puntos }) {
  const contenedorRef = useRef(null)
  const [activo, setActivo] = useState(null)

  const escala = useMemo(() => calcularEscala(puntos), [puntos])

  const posicionRelativa = (evento) => {
    const contenedorRect = contenedorRef.current.getBoundingClientRect()
    const objetivoRect = evento.currentTarget.getBoundingClientRect()
    return {
      x: objetivoRect.left + objetivoRect.width / 2 - contenedorRect.left,
      y: objetivoRect.top - contenedorRect.top,
    }
  }

  const mostrarAlPasar = (punto, evento) => {
    // La posicion se calcula ya (sincrono, mientras el evento es valido) en
    // vez de dentro del updater: React StrictMode invoca los updaters de
    // useState dos veces, y para la segunda invocacion evento.currentTarget
    // ya es null (el SyntheticEvent se limpia al terminar el handler).
    const pos = posicionRelativa(evento)
    setActivo((actual) => {
      if (actual?.fijado) return actual
      return { punto, fijado: false, pos }
    })
  }

  const ocultarAlSalir = (punto) => {
    setActivo((actual) => (actual && actual.punto.id === punto.id && !actual.fijado ? null : actual))
  }

  const alternarFijado = (punto, evento) => {
    evento.stopPropagation()
    const pos = posicionRelativa(evento)
    setActivo((actual) => {
      if (actual && actual.punto.id === punto.id && actual.fijado) return null
      return { punto, fijado: true, pos }
    })
  }

  if (puntos.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-dashed border-mg-surface-100 bg-white text-sm text-mg-navy-700 xl:aspect-[16/9]">
        No hay puntos de control activos para mostrar.
      </div>
    )
  }

  return (
    <div
      ref={contenedorRef}
      className="relative aspect-[4/3] w-full overflow-visible rounded-2xl border border-mg-surface-100 bg-white p-2 shadow-sm shadow-mg-navy-900/5 xl:aspect-[16/9]"
      onClick={() => setActivo((actual) => (actual?.fijado ? null : actual))}
    >
      <svg
        viewBox={`${escala.minX} ${escala.minY} ${escala.lado} ${escala.lado}`}
        className="h-full w-full"
        role="img"
        aria-label="Plano de puntos de control de la estación"
      >
        {puntos.map((punto) => {
          const estilo = punto.ultima_lectura
            ? (ESTILO_POR_NIVEL[punto.ultima_lectura.nivel_alerta] ?? ESTILO_SIN_DATOS)
            : ESTILO_SIN_DATOS
          const estaActivo = activo?.punto.id === punto.id

          return (
            <g key={punto.id}>
              <circle
                cx={punto.coord_x}
                cy={punto.coord_y}
                r={estaActivo ? escala.radio * 1.3 : escala.radio}
                className={`${estilo.marcador} cursor-pointer opacity-90 transition-[r,opacity] duration-150 hover:opacity-100`}
                strokeWidth={escala.radio * 0.18}
                tabIndex={0}
                role="button"
                aria-label={`Punto de control ${punto.nombre_estacion}, nivel ${estilo.etiqueta}`}
                onMouseEnter={(e) => mostrarAlPasar(punto, e)}
                onMouseLeave={() => ocultarAlSalir(punto)}
                onFocus={(e) => mostrarAlPasar(punto, e)}
                onBlur={() => ocultarAlSalir(punto)}
                onClick={(e) => alternarFijado(punto, e)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    alternarFijado(punto, e)
                  }
                }}
              />
              <text
                x={punto.coord_x}
                y={punto.coord_y + escala.radio * 2.4}
                textAnchor="middle"
                className="pointer-events-none fill-mg-navy-700 font-medium select-none"
                style={{ fontSize: escala.radio * 0.85 }}
              >
                {punto.nombre_estacion}
              </text>
            </g>
          )
        })}
      </svg>

      {activo && (
        <div
          className="pointer-events-none absolute z-10 w-64 -translate-x-1/2 -translate-y-[calc(100%+0.75rem)] rounded-xl border border-mg-surface-100 bg-white p-4 text-left shadow-lg shadow-mg-navy-900/10"
          style={{ left: activo.pos.x, top: activo.pos.y }}
        >
          <TooltipContenido punto={activo.punto} />
        </div>
      )}
    </div>
  )
}

export default PlanoPuntosControl
