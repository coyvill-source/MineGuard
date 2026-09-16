import { useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { calcularAltoDisponible } from "../../lib/layoutPlano"

const RADIO_RATIO = 0.05
// Aspecto de respaldo para el primer render, antes de que el
// ResizeObserver mida el aspecto real del contenedor ya pintado (ver
// PlanoPuntosControl). Solo importa por una fracción de segundo.
const ASPECTO_POR_DEFECTO = 16 / 9

// Margenes de encuadre, en multiplos de `radio` (ver calcularEscala): no son
// un porcentaje arbitrario, son la huella real que cada elemento decorativo
// necesita para no cortarse. Se documentan uno por uno porque cada valor
// esta calibrado contra el tamaño real del elemento que protege - si se
// cambia el tamaño de un elemento (el portal, el chip, la rosa), hay que
// revisar el margen correspondiente.
const MARGEN_LATERAL = 2.15 // marcador agrandado en hover/foco (radio*1.3) + su stroke, y tambien el radio que usa la rosa de los vientos en su esquina (ver elegirEsquinaRosa) - subio de 2.0 a 2.15 al agrandar la rosa
const MARGEN_PORTAL = 3.6 // alcance vertical del portal de "Entrada" (arco + etiqueta de texto) sobre el punto "0"
const MARGEN_CHIP = 2.65 // alcance del chip de etiqueta debajo de cada punto - subio de 2.5 a 2.65 al agrandar el chip (ronda 4, legibilidad)

const ESTILO_POR_NIVEL = {
  optimo: { marcador: "fill-mg-safe-500 stroke-mg-safe-500", etiqueta: "Óptimo" },
  alerta: { marcador: "fill-mg-alert-500 stroke-mg-alert-500", etiqueta: "Alerta" },
  critico: { marcador: "fill-mg-danger-500 stroke-mg-danger-500", etiqueta: "Crítico" },
}
const ESTILO_SIN_DATOS = { marcador: "fill-slate-400 stroke-slate-500", etiqueta: "Sin datos" }

// El plano es esquemático (no hay imagen de fondo real de la mina): coord_x
// y coord_y se ubican tal cual en el plano cartesiano, sin invertir el eje Y.
//
// Respiro extra (mas alla del margen ya calculado por MARGEN_*) para que el
// contenido no quede pegado al borde exacto del panel.
const AIRE_RATIO = 0.04

// `aspecto` (ancho/alto) es el aspecto REAL del contenedor en pantalla
// (medido con ResizeObserver) - ya NO se acota (a diferencia de la ronda
// anterior, ver DECISIÓN en docs/PROJECT_CONTEXT.md): el viewBox coincide
// EXACTO con el aspecto del panel, siempre, sin excepcion.
//
// La clave de esta ronda es que ya no se usa un unico factor de escala
// isotropico para todo: las POSICIONES de los puntos (donde cae cada uno
// en el plano) se escalan con dos factores INDEPENDIENTES, `escalaX` y
// `escalaY`, cada uno ajustado para aprovechar el ancho/alto completos del
// viewBox - eso es lo que permite llenar un panel panoramico con datos que
// no lo son, sin dejar franjas vacias a los lados (el problema de la ronda
// anterior). El TAMAÑO de cada elemento (radio del marcador, grosor de
// linea, chip, rosa, portal) usa un tercer factor, `radio`, UNIFORME
// (el menor de escalaX/escalaY) para que nada se vea estirado ni aplastado
// - los marcadores siguen siendo circulos perfectos.
//
// El encuadre se calcula en varios pasos: primero `radioRaw` (tamaño de
// marcador en unidades "crudas", antes de cualquier escalado de posicion)
// sale de la extension real de los puntos (`extentRaw`). Despues, el
// cuadro de contenido (en esas mismas unidades crudas) se arma punto por
// punto sumando el margen que cada uno realmente necesita en cada
// direccion (lateral en todos, mas margen arriba SOLO para el punto "0"
// por el portal de "Entrada", mas margen abajo en todos por el chip de
// etiqueta). Recien ahi se calculan escalaX/escalaY (cuanto hay que
// estirar ese cuadro crudo en cada eje para llenar el viewBox) y se
// transforman las posiciones de los puntos a ese nuevo espacio - el resto
// del componente (tunel, marcadores, chips, rosa, portal) dibuja usando
// esas posiciones YA transformadas, nunca las crudas.
function calcularEscala(puntos, aspecto = 1) {
  const xsRaw = puntos.map((p) => p.coord_x)
  const ysRaw = puntos.map((p) => p.coord_y)
  const extentRaw =
    Math.max(Math.max(...xsRaw) - Math.min(...xsRaw), Math.max(...ysRaw) - Math.min(...ysRaw)) || 1
  const radioRaw = extentRaw * RADIO_RATIO

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const p of puntos) {
    const esEntrada = p.nombre_estacion === "0"
    minX = Math.min(minX, p.coord_x - radioRaw * MARGEN_LATERAL)
    maxX = Math.max(maxX, p.coord_x + radioRaw * MARGEN_LATERAL)
    minY = Math.min(minY, p.coord_y - radioRaw * (esEntrada ? MARGEN_PORTAL : MARGEN_LATERAL))
    maxY = Math.max(maxY, p.coord_y + radioRaw * MARGEN_CHIP)
  }

  const centroXRaw = (minX + maxX) / 2
  const centroYRaw = (minY + maxY) / 2
  // "+ AIRE_RATIO": un respiro parejo en ambos ejes, mas alla del margen ya
  // incluido arriba, para que el contenido no toque el borde exacto.
  const anchoContenidoRaw = (maxX - minX) * (1 + AIRE_RATIO) || 1
  const altoContenidoRaw = (maxY - minY) * (1 + AIRE_RATIO) || 1

  // El viewBox toma el aspecto EXACTO del panel: alto = altoContenidoRaw
  // (referencia, sin estirar) y ancho = alto * aspecto (llena el ancho
  // real disponible). Esta misma formula funciona sin distinguir casos
  // aunque el panel termine siendo mas angosto que alto que el contenido
  // (aspecto < 1): ahi escalaX simplemente da menor a 1 (comprime en vez
  // de estirar), en vez de necesitar una rama aparte.
  const alto = altoContenidoRaw
  const ancho = alto * aspecto

  const escalaX = ancho / anchoContenidoRaw
  const escalaY = alto / altoContenidoRaw // == 1 siempre, por construccion - explicito por claridad
  // Factor de TAMAÑO, uniforme (nunca ancho/alto por separado): el menor
  // de los dos factores de posicion, para que un marcador nunca termine
  // mas grande que el espacio que la propia distribucion de puntos le deja
  // en su eje mas comprimido - así los círculos siguen siendo círculos.
  const radio = radioRaw * Math.min(escalaX, escalaY)

  // `coordXOriginal`/`coordYOriginal` conservan las coordenadas reales de
  // topografía (las que llegan por props) - el tooltip las muestra tal
  // cual (ver TooltipContenido), nunca las transformadas: `coord_x`/
  // `coord_y` de aquí en adelante son posiciones de DIBUJO, no datos.
  const puntosTransformados = puntos.map((p) => ({
    ...p,
    coord_x: (p.coord_x - centroXRaw) * escalaX,
    coord_y: (p.coord_y - centroYRaw) * escalaY,
    coordXOriginal: p.coord_x,
    coordYOriginal: p.coord_y,
  }))

  return {
    minX: -ancho / 2,
    minY: -alto / 2,
    ancho,
    alto,
    radio,
    escalaX,
    escalaY,
    puntosTransformados,
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
        x: {formatearNumero(punto.coordXOriginal, 1)} · y: {formatearNumero(punto.coordYOriginal, 1)} · z:{" "}
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
  // Mismo margen que calcularEscala reserva como margen lateral generico
  // (MARGEN_LATERAL): es exactamente el espacio que se dejo libre de
  // contenido en los lados que no tienen portal ni chip, así que la rosa
  // (que mide menos que ese margen - ver RosaDeLosVientos) cabe sin chocar
  // con ningun punto ni recortarse contra el borde del viewBox.
  const margen = escala.radio * MARGEN_LATERAL
  const esquinas = [
    { x: escala.minX + margen, y: escala.minY + margen },
    { x: escala.minX + escala.ancho - margen, y: escala.minY + margen },
    { x: escala.minX + margen, y: escala.minY + escala.alto - margen },
    { x: escala.minX + escala.ancho - margen, y: escala.minY + escala.alto - margen },
  ]

  if (!puntoEntrada) return esquinas[1] // superior derecha por defecto

  return esquinas.reduce((mejor, esquina) => {
    const distancia = Math.hypot(esquina.x - puntoEntrada.coord_x, esquina.y - puntoEntrada.coord_y)
    const distanciaMejor = Math.hypot(mejor.x - puntoEntrada.coord_x, mejor.y - puntoEntrada.coord_y)
    return distancia > distanciaMejor ? esquina : mejor
  })
}

// Rosa de los vientos decorativa (estilo plano tecnico de ingenieria):
// halo suave + circulo base + anillo bisel + estrella de 8 puntas (eje N-S
// mas largo/prominente que el eje E-O, como en una rosa nautica real) + eje
// central + etiquetas N/S/E/O. Tamaño proporcional a escala.radio, nunca al
// ancho/alto del viewBox, para que se vea igual sin importar el aspecto.
// Radio subido de 1.4 a 1.65 y anillo/borde reforzados (ronda 3: se veia
// "pequeña y perdida" en la esquina) - MARGEN_LATERAL se subio junto con
// este cambio para que siga cabiendo sin chocar ni recortarse (ver
// calcularEscala/elegirEsquinaRosa).
function RosaDeLosVientos({ escala, cx, cy }) {
  const radio = escala.radio * 1.65

  return (
    <g className="pointer-events-none select-none" aria-hidden="true">
      <circle cx={cx} cy={cy} r={radio * 1.15} className="fill-mg-navy-900/8" />
      <circle cx={cx} cy={cy} r={radio} className="fill-white/90 stroke-mg-navy-800/50" strokeWidth={radio * 0.08} />
      <circle
        cx={cx}
        cy={cy}
        r={radio * 0.82}
        fill="none"
        className="stroke-mg-navy-800/30"
        strokeWidth={radio * 0.045}
      />
      <path
        d={`M ${cx} ${cy - radio * 0.82} L ${cx + radio * 0.16} ${cy} L ${cx} ${cy + radio * 0.82} L ${cx - radio * 0.16} ${cy} Z`}
        className="fill-mg-navy-800/80"
      />
      <path
        d={`M ${cx - radio * 0.62} ${cy} L ${cx} ${cy - radio * 0.16} L ${cx + radio * 0.62} ${cy} L ${cx} ${cy + radio * 0.16} Z`}
        className="fill-mg-accent-500/75"
      />
      <circle cx={cx} cy={cy} r={radio * 0.09} className="fill-mg-navy-900" />
      <text
        x={cx}
        y={cy - radio * 1.05}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-mg-navy-800 font-bold"
        style={{ fontSize: radio * 0.42, letterSpacing: "0.02em" }}
      >
        N
      </text>
      <text
        x={cx}
        y={cy + radio * 1.1}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-mg-navy-700 font-semibold"
        style={{ fontSize: radio * 0.36 }}
      >
        S
      </text>
      <text
        x={cx + radio * 1.1}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-mg-navy-700 font-semibold"
        style={{ fontSize: radio * 0.36 }}
      >
        E
      </text>
      <text
        x={cx - radio * 1.1}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-mg-navy-700 font-semibold"
        style={{ fontSize: radio * 0.36 }}
      >
        O
      </text>
    </g>
  )
}

// Marca decorativa de "entrada de la mina" en el punto nombre_estacion "0":
// portal reforzado (postes + arco + viga dintel + riostras diagonales de
// esquina, como una entrada de galeria minera real) dibujado detras del
// marcador (nunca lo tapa - el semaforo de nivel de alerta sigue siendo el
// elemento funcional) + etiqueta "Entrada". Esquematica, no geometria real
// medida - ver docs/PROJECT_CONTEXT.md.
//
// Usa mg-accent (azul de marca), no mg-navy: con navy a baja opacidad el
// portal se leia casi igual de gris que los marcadores "sin datos"
// (slate), y el punto "0" es una referencia especial, no un sensor mas.
function MarcaEntrada({ punto, radio }) {
  const cx = punto.coord_x
  const cy = punto.coord_y
  const ancho = radio * 3.2
  const alto = radio * 2.85
  const postTopY = cy - alto * 0.5
  const postBottomY = cy + alto * 0.15
  const archPeakY = cy - alto
  const leftX = cx - ancho / 2
  const rightX = cx + ancho / 2

  return (
    <g className="pointer-events-none select-none" aria-hidden="true">
      {/* Riostras diagonales de esquina (refuerzo estructural) */}
      <path
        d={`M ${leftX} ${postTopY + alto * 0.28} L ${leftX + ancho * 0.15} ${postTopY}`}
        fill="none"
        className="stroke-mg-accent-500/50"
        strokeWidth={radio * 0.09}
        strokeLinecap="round"
      />
      <path
        d={`M ${rightX} ${postTopY + alto * 0.28} L ${rightX - ancho * 0.15} ${postTopY}`}
        fill="none"
        className="stroke-mg-accent-500/50"
        strokeWidth={radio * 0.09}
        strokeLinecap="round"
      />
      {/* Viga dintel horizontal, en el arranque del arco */}
      <path
        d={`M ${leftX} ${postTopY} L ${rightX} ${postTopY}`}
        fill="none"
        className="stroke-mg-accent-500/60"
        strokeWidth={radio * 0.14}
        strokeLinecap="round"
      />
      {/* Marco: postes + arco */}
      <path
        d={`M ${leftX} ${postBottomY}
            L ${leftX} ${postTopY}
            Q ${leftX} ${archPeakY} ${cx} ${archPeakY}
            Q ${rightX} ${archPeakY} ${rightX} ${postTopY}
            L ${rightX} ${postBottomY}`}
        fill="none"
        className="stroke-mg-accent-600/80"
        strokeWidth={radio * 0.22}
        strokeLinecap="round"
      />
      <text
        x={cx}
        y={archPeakY - radio * 0.22}
        textAnchor="middle"
        className="fill-mg-accent-600 font-semibold"
        style={{ fontSize: radio * 0.62 }}
      >
        Entrada
      </text>
    </g>
  )
}

// Icono minimalista de "sensor sin señal" (barras ascendentes), para que los
// marcadores sin lecturas se lean como un sensor esperando datos, no como un
// placeholder vacio.
function IconoSinDatos({ cx, cy, radio }) {
  const base = cy + radio * 0.32
  const alturas = [radio * 0.34, radio * 0.56, radio * 0.78]
  const anchoBarra = radio * 0.16
  const espacio = radio * 0.08
  const inicioX = cx - (3 * anchoBarra + 2 * espacio) / 2

  return (
    <g className="pointer-events-none" aria-hidden="true">
      {alturas.map((h, i) => (
        <rect
          key={i}
          x={inicioX + i * (anchoBarra + espacio)}
          y={base - h}
          width={anchoBarra}
          height={h}
          rx={anchoBarra * 0.3}
          className="fill-slate-600/85"
        />
      ))}
    </g>
  )
}

function PlanoPuntosControl({ puntos }) {
  const contenedorRef = useRef(null)
  const [activo, setActivo] = useState(null)
  const idGrid = useId()
  const idSombraMarcador = useId()

  // Alto EXPLICITO del panel (px), derivado SOLO del viewport - ver
  // calcularAltoDisponible. El ancho es simplemente `w-full` (ancho
  // completo del contenedor padre, ver JSX abajo): ancho y alto ya NO se
  // derivan el uno del otro a traves de un aspecto fijo (eso fue lo que
  // rompio el ancho completo en la ronda anterior - ver DECISIÓN en
  // docs/PROJECT_CONTEXT.md). El estado inicial ya usa `window.innerHeight`
  // (disponible de entrada en un SPA) para evitar un parpadeo en la
  // primera pintura.
  const [altoDisponible, setAltoDisponible] = useState(calcularAltoDisponible)

  // Aspecto REAL ya renderizado del contenedor (ancho completo x alto fijo
  // de arriba), medido con ResizeObserver - se le pasa a calcularEscala
  // para que el viewBox coincida exactamente con esa caja (ancho x alto).
  // calcularEscala usa este aspecto para escalar las POSICIONES de los
  // puntos en X y en Y con factores independientes (ver comentario ahí) -
  // así el contenido llena la caja disponible sin importar su forma,
  // en vez de la caja adaptarse a la forma de los datos. Mismo mecanismo
  // que ya se uso para eliminar el letterboxing hace varias rondas, solo
  // que ahora ambas dimensiones de
  // la caja son explicitas (ancho completo, alto sin scroll) en vez de
  // depender de un `aspect-ratio` CSS.
  const [aspecto, setAspecto] = useState(ASPECTO_POR_DEFECTO)

  useLayoutEffect(() => {
    const elemento = contenedorRef.current
    if (!elemento) return

    const observador = new ResizeObserver((entradas) => {
      const { width, height } = entradas[0].contentRect
      if (width > 0 && height > 0) setAspecto(width / height)
    })
    observador.observe(elemento)

    const alRedimensionar = () => setAltoDisponible(calcularAltoDisponible())
    window.addEventListener("resize", alRedimensionar)

    return () => {
      observador.disconnect()
      window.removeEventListener("resize", alRedimensionar)
    }
  }, [])

  // El tunel, la busqueda del punto "0" y el dibujo de marcadores usan
  // `escala.puntosTransformados` (posiciones YA escaladas con escalaX/
  // escalaY, ver calcularEscala) - nunca los `puntos` crudos que llegan
  // por props, que estan en el sistema de coordenadas original (sin
  // relacion directa con el viewBox).
  const escala = useMemo(() => calcularEscala(puntos, aspecto), [puntos, aspecto])
  const estructuraTunel = useMemo(
    () => construirEstructuraTunel(escala.puntosTransformados),
    [escala],
  )
  const puntoEntrada = useMemo(
    () => escala.puntosTransformados.find((p) => p.nombre_estacion === "0") ?? null,
    [escala],
  )
  const esquinaRosa = useMemo(() => elegirEsquinaRosa(escala, puntoEntrada), [escala, puntoEntrada])
  const pasoGrid = escala.alto / 20

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
      <div
        className="flex w-full items-center justify-center rounded-2xl border border-dashed border-mg-surface-100 bg-white text-sm text-mg-navy-700"
        style={{ height: calcularAltoDisponible() }}
      >
        No hay puntos de control activos para mostrar.
      </div>
    )
  }

  return (
    <div
      ref={contenedorRef}
      // Sombra alineada con el estandar de "tarjeta elevada" que ya usan
      // Login/Registro/OlvidePassword/ResetPassword y el gate de sesion de
      // DashboardLayout (`shadow-lg shadow-mg-navy-900/5`, mismo token de
      // color en toda la app) - aqui un escalon mas marcado (`shadow-xl` +
      // /10 en vez de /5) porque el plano es el elemento visual mas
      // importante del dashboard y debe sentirse claramente elevado, sin
      // introducir un color de sombra nuevo.
      //
      // `w-full` (ancho completo, siempre) + alto EXPLICITO en px (ver
      // calcularAltoDisponible, solo depende del viewport): ancho y alto ya
      // no compiten entre si a traves de un aspecto fijo compartido - la
      // ronda anterior derivaba el ancho del alto vía `aspectoContenedor`,
      // lo que dejaba el panel angosto y centrado en vez de a todo lo
      // ancho. El viewBox (ver `escala`, más abajo) se adapta a la caja
      // resultante vía `aspecto` medido con ResizeObserver, así que nunca
      // hay letterboxing sin importar que tan panorámica quede la caja.
      className="relative w-full overflow-visible rounded-2xl border border-mg-surface-100 bg-white p-3 shadow-xl shadow-mg-navy-900/10 ring-1 ring-mg-navy-900/5 transition-shadow duration-200 hover:shadow-2xl hover:shadow-mg-navy-900/15 xl:p-4"
      style={{ height: altoDisponible }}
      onClick={() => setActivo((actual) => (actual?.fijado ? null : actual))}
    >
      <svg
        viewBox={`${escala.minX} ${escala.minY} ${escala.ancho} ${escala.alto}`}
        // "xMidYMid meet" (el default, explícito por claridad): el viewBox
        // ahora coincide EXACTO con el aspecto real del panel siempre (ver
        // calcularEscala), así que esto ya no letterboxea en la práctica -
        // se deja como red de seguridad ante cualquier desajuste momentáneo
        // entre el aspecto medido y el renderizado.
        preserveAspectRatio="xMidYMid meet"
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
              strokeWidth={escala.alto * 0.0015}
            />
          </pattern>
          {/* Sombra sutil de los marcadores - los "levanta" del fondo. Usa
              flood-color vía CSS custom property (los presentation
              attributes de un filtro SVG no se pueden expresar con clases
              de Tailwind) para mantenerse dentro de la paleta de marca. */}
          <filter id={idSombraMarcador} x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow
              dx="0"
              dy={escala.radio * 0.14}
              stdDeviation={escala.radio * 0.17}
              style={{ floodColor: "var(--color-mg-navy-900)", floodOpacity: 0.5 }}
            />
          </filter>
        </defs>

        {/* Fondo "papel tecnico": base clara + grid fino, decorativo. */}
        <rect x={escala.minX} y={escala.minY} width={escala.ancho} height={escala.alto} className="fill-mg-surface-50" />
        <rect
          x={escala.minX}
          y={escala.minY}
          width={escala.ancho}
          height={escala.alto}
          fill={`url(#${idGrid})`}
        />

        {/* Tunel decorativo/esquematico - no es geometria real medida. Cada
            tramo lleva un trazo de "sombra" mas oscuro y ancho detras, y el
            trazo emerald encima, mas delgado, para que se lea con volumen
            (galeria) en vez de una linea plana. Ramas primero (mas
            delgadas/tenues), tunel principal encima (mas grueso/opaco) para
            que se lea como el eje estructural. */}
        {estructuraTunel.ramas.map((rama) => (
          <path
            key={`${rama.key}-sombra`}
            d={rama.d}
            fill="none"
            className="stroke-emerald-900/15"
            strokeWidth={escala.radio * 0.27}
            strokeLinecap="round"
          />
        ))}
        {estructuraTunel.principales.map((tramo) => (
          <path
            key={`${tramo.key}-sombra`}
            d={tramo.d}
            fill="none"
            className="stroke-emerald-900/30"
            strokeWidth={escala.radio * 0.52}
            strokeLinecap="round"
          />
        ))}
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

        {escala.puntosTransformados.map((punto) => {
          const estilo = punto.ultima_lectura
            ? (ESTILO_POR_NIVEL[punto.ultima_lectura.nivel_alerta] ?? ESTILO_SIN_DATOS)
            : ESTILO_SIN_DATOS
          const estaActivo = activo?.punto.id === punto.id
          const sinDatos = !punto.ultima_lectura
          // Chip agrandado (ronda 4): con el panel más compacto (ver Tarea
          // 1 en docs/PROJECT_CONTEXT.md) el texto quedaba ilegible en
          // pantalla real (~7px) con las proporciones de la ronda 2 - se
          // subió la fuente y se agrandó la píldora para acompañarla.
          const anchoChip = escala.radio * 2.15
          const altoChip = escala.radio * 1.3
          const yChip = punto.coord_y + escala.radio * 1.25

          return (
            <g key={punto.id}>
              <circle
                cx={punto.coord_x}
                cy={punto.coord_y}
                r={estaActivo ? escala.radio * 1.3 : escala.radio}
                className={`${estilo.marcador} cursor-pointer opacity-90 transition-[r,opacity] duration-150 hover:opacity-100`}
                strokeWidth={escala.radio * 0.18}
                style={{ filter: `url(#${idSombraMarcador})` }}
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
              {sinDatos && <IconoSinDatos cx={punto.coord_x} cy={punto.coord_y} radio={escala.radio} />}

              {/* Chip/badge de la etiqueta del punto, en vez de texto suelto */}
              <rect
                x={punto.coord_x - anchoChip / 2}
                y={yChip}
                width={anchoChip}
                height={altoChip}
                rx={altoChip / 2}
                className="pointer-events-none fill-mg-surface-100 stroke-mg-navy-900/10"
                strokeWidth={escala.radio * 0.05}
              />
              <text
                x={punto.coord_x}
                y={yChip + altoChip / 2}
                textAnchor="middle"
                dominantBaseline="central"
                className="pointer-events-none fill-mg-navy-800 font-semibold select-none"
                style={{ fontSize: escala.radio * 0.9 }}
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
