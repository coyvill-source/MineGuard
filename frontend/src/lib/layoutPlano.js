// Constantes de layout compartidas entre Dashboard.jsx y
// PlanoPuntosControl.jsx para que el alto del panel y el de sus estados de
// carga/vacío usen siempre el mismo presupuesto vertical - antes vivían
// duplicadas (un valor en rem en Dashboard.jsx, otro en px en
// PlanoPuntosControl.jsx) y se desincronizaron. Ver DECISIÓN en
// docs/PROJECT_CONTEXT.md.

// Espacio vertical reservado arriba/abajo del panel: header + padding del
// <main> + banner + leyenda + margenes entre ellos + padding inferior de
// la pagina (medido en navegador real a 1366x768).
export const RESERVA_VERTICAL_PX = 380

// Piso de altura: por debajo de esto el texto de los chips deja de ser
// legible (medido en navegador real: a 260px el chip quedaba en ~7px de
// alto de fuente en pantalla). Se prioriza un pequeño scroll (pantallas
// muy bajas, ej. ventana no maximizada) antes que encogerlo mas - a
// 1366x768 maximizado (~760px de alto util) el panel ya queda bastante
// por encima de este piso, así que no dispara scroll ahí.
export const ALTURA_MINIMA_PX = 340

// Alto disponible para el panel: SOLO depende del viewport (nunca del
// ancho ni de la forma de los datos) - el ancho completo y el alto sin
// scroll dejaron de derivarse el uno del otro a traves de un aspecto fijo.
export function calcularAltoDisponible() {
  return Math.max(window.innerHeight - RESERVA_VERTICAL_PX, ALTURA_MINIMA_PX)
}
