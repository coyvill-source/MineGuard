import { useId, useMemo, useRef, useState } from "react"

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

// Estructura del tunel (decorativa/esquematica, ver docs/PROJECT_CONTEXT.md,
// basada en la descripcion del usuario - NO es topografia medida):
// tunel PRINCIPAL "0"->"1"->"3"->"5", mas 3 RAMAS secundarias:
//   rama 1: desde la mitad del tramo "1"-"3" hasta "2"
//   rama 2: desde la mitad del tramo "3"-"5" hasta "6"
//   rama 3: desde "5" (extension mas alla del final) hasta "4"
// Se identifica cada punto por nombre_estacion (no por el id numerico de la
// BD). Si algun nombre_estacion no existe en los datos reales, esa parte de
// la estructura simplemente se omite - nunca crashea.
const SECUENCIA_PRINCIPAL = ["0", "1", "3", "5"]

// Bezier cuadratica entre 2 puntos, con un offset perpendicular a la recta
// que los une (proporcional a la distancia entre ellos) para que se vea
// sinuosa en vez de una linea recta.
function segmentoCurva(desde, hasta, lado, curvatura = 0.18) {
  const dx = hasta.coord_x - desde.coord_x
  const dy = hasta.coord_y - desde.coord_y
  const longitud = Math.hypot(dx, dy) || 1
  const offset = longitud * curvatura * lado

  return {
    x: (desde.coord_x + hasta.coord_x) / 2 + (-dy / longitud) * offset,
    y: (desde.coord_y + hasta.coord_y) / 2 + (dx / longitud) * offset,
  }
}

// Punto sobre una bezier cuadratica en t=[0,1] - se usa para que las ramas
// salgan de un punto real de la curva del tunel principal, no de la recta.
function puntoEnBezier(p0, control, p2, t) {
  const mt = 1 - t
  return {
    coord_x: mt * mt * p0.coord_x + 2 * mt * t * control.x + t * t * p2.coord_x,
    coord_y: mt * mt * p0.coord_y + 2 * mt * t * control.y + t * t * p2.coord_y,
  }
}

function pathSegmento(desde, control, hasta) {
  return `M ${desde.coord_x} ${desde.coord_y} Q ${control.x} ${control.y} ${hasta.coord_x} ${hasta.coord_y}`
}

function construirEstructuraTunel(puntos) {
  const porNombre = new Map(puntos.map((p) => [p.nombre_estacion, p]))
  const buscar = (nombre) => porNombre.get(nombre) ?? null

  const segmentosPrincipales = new Map() // "0-1" -> { desde, control, hasta }
  const principales = []

  for (let i = 1; i < SECUENCIA_PRINCIPAL.length; i++) {
    const nombreDesde = SECUENCIA_PRINCIPAL[i - 1]
    const nombreHasta = SECUENCIA_PRINCIPAL[i]
    const desde = buscar(nombreDesde)
    const hasta = buscar(nombreHasta)
    if (!desde || !hasta) continue

    const control = segmentoCurva(desde, hasta, i % 2 === 0 ? 1 : -1)
    const clave = `${nombreDesde}-${nombreHasta}`
    segmentosPrincipales.set(clave, { desde, control, hasta })
    principales.push({ key: clave, d: pathSegmento(desde, control, hasta) })
  }

  const ramas = []

  function agregarRamaDesdeSegmento(claveSegmento, nombreDestino) {
    const segmento = segmentosPrincipales.get(claveSegmento)
    const destino = buscar(nombreDestino)
    if (!segmento || !destino) return

    const origen = puntoEnBezier(segmento.desde, segmento.control, segmento.hasta, 0.5)
    const control = segmentoCurva(origen, destino, 1, 0.22)
    ramas.push({ key: `${claveSegmento}->${nombreDestino}`, d: pathSegmento(origen, control, destino) })
  }

  agregarRamaDesdeSegmento("1-3", "2")
  agregarRamaDesdeSegmento("3-5", "6")

  const nodo5 = buscar("5")
  const nodo4 = buscar("4")
  if (nodo5 && nodo4) {
    const control = segmentoCurva(nodo5, nodo4, 1, 0.22)
    ramas.push({ key: "5->4", d: pathSegmento(nodo5, control, nodo4) })
  }

  return { principales, ramas }
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

// Elige, de las 4 esquinas del viewBox, la mas alejada del punto de entrada
// (si existe) para la rosa de los vientos - evita que choque visualmente
// con la marca "Entrada" cuando el punto "0" cae cerca de una esquina en
// los datos reales (ocurrio en pruebas: el punto "0" quedo justo en la
// esquina superior-derecha, la posicion fija por defecto de la rosa).
function elegirEsquinaRosa(escala, puntoEntrada) {
  const margen = escala.lado * 0.12
  const esquinas = [
    { x: escala.minX + margen, y: escala.minY + margen },
    { x: escala.minX + escala.lado - margen, y: escala.minY + margen },
    { x: escala.minX + margen, y: escala.minY + escala.lado - margen },
    { x: escala.minX + escala.lado - margen, y: escala.minY + escala.lado - margen },
  ]

  if (!puntoEntrada) return esquinas[1] // superior derecha por defecto

  return esquinas.reduce((mejor, esquina) => {
    const distancia = Math.hypot(esquina.x - puntoEntrada.coord_x, esquina.y - puntoEntrada.coord_y)
    const distanciaMejor = Math.hypot(mejor.x - puntoEntrada.coord_x, mejor.y - puntoEntrada.coord_y)
    return distancia > distanciaMejor ? esquina : mejor
  })
}

// Rosa de los vientos decorativa (estilo plano tecnico de ingenieria),
// tamaño proporcional al viewBox para que se vea igual sin importar cuanto
// se extiendan los puntos. Usa los colores de marca (navy/accent).
function RosaDeLosVientos({ escala, cx, cy }) {
  const radio = escala.lado * 0.05

  return (
    <g className="pointer-events-none select-none" aria-hidden="true">
      <circle
        cx={cx}
        cy={cy}
        r={radio}
        className="fill-white/70 stroke-mg-navy-800/30"
        strokeWidth={radio * 0.05}
      />
      <path
        d={`M ${cx} ${cy - radio * 0.85} L ${cx + radio * 0.2} ${cy} L ${cx} ${cy + radio * 0.85} L ${cx - radio * 0.2} ${cy} Z`}
        className="fill-mg-navy-800/70"
      />
      <path
        d={`M ${cx - radio * 0.85} ${cy} L ${cx} ${cy - radio * 0.2} L ${cx + radio * 0.85} ${cy} L ${cx} ${cy + radio * 0.2} Z`}
        className="fill-mg-accent-500/70"
      />
      <text
        x={cx}
        y={cy - radio * 1.15}
        textAnchor="middle"
        className="fill-mg-navy-800 font-bold"
        style={{ fontSize: radio * 0.5 }}
      >
        N
      </text>
      <text
        x={cx}
        y={cy + radio * 1.35}
        textAnchor="middle"
        className="fill-mg-navy-800"
        style={{ fontSize: radio * 0.42 }}
      >
        S
      </text>
      <text
        x={cx + radio * 1.3}
        y={cy + radio * 0.16}
        textAnchor="middle"
        className="fill-mg-navy-800"
        style={{ fontSize: radio * 0.42 }}
      >
        E
      </text>
      <text
        x={cx - radio * 1.3}
        y={cy + radio * 0.16}
        textAnchor="middle"
        className="fill-mg-navy-800"
        style={{ fontSize: radio * 0.42 }}
      >
        O
      </text>
    </g>
  )
}

// Marca decorativa de "entrada de la mina" en el punto nombre_estacion "0":
// un arco/portal detras del marcador (nunca lo tapa - el semaforo de nivel
// de alerta sigue siendo el elemento funcional) + una etiqueta "Entrada".
// Esquematica, no geometria real medida - ver docs/PROJECT_CONTEXT.md.
function MarcaEntrada({ punto, radio }) {
  const cx = punto.coord_x
  const cy = punto.coord_y
  const ancho = radio * 3.2
  const alto = radio * 2.6

  return (
    <g className="pointer-events-none select-none" aria-hidden="true">
      <path
        d={`M ${cx - ancho / 2} ${cy + alto * 0.15}
            L ${cx - ancho / 2} ${cy - alto * 0.1}
            Q ${cx - ancho / 2} ${cy - alto} ${cx} ${cy - alto}
            Q ${cx + ancho / 2} ${cy - alto} ${cx + ancho / 2} ${cy - alto * 0.1}
            L ${cx + ancho / 2} ${cy + alto * 0.15}`}
        fill="none"
        className="stroke-mg-navy-800/45"
        strokeWidth={radio * 0.16}
        strokeLinecap="round"
      />
      <text
        x={cx}
        y={cy - alto - radio * 0.45}
        textAnchor="middle"
        className="fill-mg-navy-800 font-semibold"
        style={{ fontSize: radio * 0.6 }}
      >
        Entrada
      </text>
    </g>
  )
}

function PlanoPuntosControl({ puntos }) {
  const contenedorRef = useRef(null)
  const [activo, setActivo] = useState(null)
  const idGrid = useId()

  const escala = useMemo(() => calcularEscala(puntos), [puntos])
  const estructuraTunel = useMemo(() => construirEstructuraTunel(puntos), [puntos])
  const puntoEntrada = useMemo(() => puntos.find((p) => p.nombre_estacion === "0") ?? null, [puntos])
  const esquinaRosa = useMemo(() => elegirEsquinaRosa(escala, puntoEntrada), [escala, puntoEntrada])
  const pasoGrid = escala.lado / 20

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
        <defs>
          <pattern id={idGrid} width={pasoGrid} height={pasoGrid} patternUnits="userSpaceOnUse">
            <path
              d={`M ${pasoGrid} 0 L 0 0 0 ${pasoGrid}`}
              fill="none"
              className="stroke-mg-navy-900/5"
              strokeWidth={escala.lado * 0.0015}
            />
          </pattern>
        </defs>

        {/* Fondo "papel tecnico": base clara + grid fino, decorativo. */}
        <rect x={escala.minX} y={escala.minY} width={escala.lado} height={escala.lado} className="fill-mg-surface-50" />
        <rect
          x={escala.minX}
          y={escala.minY}
          width={escala.lado}
          height={escala.lado}
          fill={`url(#${idGrid})`}
        />

        {/* Tunel decorativo/esquematico - no es geometria real medida.
            Ramas primero (mas delgadas/tenues), tunel principal encima
            (mas grueso/opaco) para que se lea como el eje estructural. */}
        {estructuraTunel.ramas.map((rama) => (
          <path
            key={rama.key}
            d={rama.d}
            fill="none"
            className="stroke-emerald-600/20"
            strokeWidth={escala.radio * 0.15}
            strokeLinecap="round"
          />
        ))}
        {estructuraTunel.principales.map((tramo) => (
          <path
            key={tramo.key}
            d={tramo.d}
            fill="none"
            className="stroke-emerald-700/40"
            strokeWidth={escala.radio * 0.34}
            strokeLinecap="round"
          />
        ))}

        <RosaDeLosVientos escala={escala} cx={esquinaRosa.x} cy={esquinaRosa.y} />
        {puntoEntrada && <MarcaEntrada punto={puntoEntrada} radio={escala.radio} />}

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
