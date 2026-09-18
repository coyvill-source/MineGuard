import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

// Mismos 4 colores EXACTOS del semaforo ya establecido (LEYENDA en
// Dashboard.jsx / ESTILO_POR_NIVEL en PlanoPuntosControl.jsx) - no una
// paleta nueva. mg-safe-500/mg-alert-500/mg-danger-500 vienen de
// src/index.css; "Sin datos" reutiliza slate-400, el mismo tono ya usado
// para los marcadores sin lectura del Plano.
const NIVELES = [
  { clave: "optimo", etiqueta: "Óptimo", color: "#2e9e5b" },
  { clave: "alerta", etiqueta: "Alerta", color: "#e0a800" },
  { clave: "critico", etiqueta: "Crítico", color: "#c0392b" },
  { clave: "sin_datos", etiqueta: "Sin datos", color: "#94a3b8" },
]

function formatearTooltip(valor) {
  return `${valor} punto${valor === 1 ? "" : "s"}`
}

// Dona con los mismos colores de marca/semaforo que el resto de la app, y
// el mismo tratamiento de Tooltip (esquinas redondeadas, borde
// mg-surface-100) ya establecido en GraficoHistorial.jsx - para que se
// sienta como el mismo sistema de graficos, no uno nuevo.
function GraficoEstadoActual({ conteo }) {
  const datos = NIVELES.map((nivel) => ({ ...nivel, valor: conteo[nivel.clave] }))
  const total = datos.reduce((suma, nivel) => suma + nivel.valor, 0)

  if (total === 0) {
    return (
      <p className="rounded-lg border border-dashed border-mg-surface-100 bg-mg-surface-50 px-4 py-6 text-center text-sm text-mg-navy-700">
        No hay puntos de control activos para evaluar.
      </p>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <ResponsiveContainer width={220} height={220}>
        <PieChart>
          <Tooltip
            formatter={formatearTooltip}
            contentStyle={{ borderRadius: 12, borderColor: "#eaf1f8", fontSize: 13 }}
            labelStyle={{ color: "#14264a", fontWeight: 600 }}
          />
          <Pie
            data={datos}
            dataKey="valor"
            nameKey="etiqueta"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={datos.filter((n) => n.valor > 0).length > 1 ? 2 : 0}
            strokeWidth={0}
            isAnimationActive={false}
          >
            {datos.map((nivel) => (
              <Cell key={nivel.clave} fill={nivel.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <ul className="flex flex-col gap-2">
        {datos.map((nivel) => (
          <li key={nivel.clave} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
              style={{ backgroundColor: nivel.color }}
            />
            <span className="font-medium text-mg-navy-700">{nivel.etiqueta}</span>
            <span className="font-semibold text-mg-navy-900">{nivel.valor}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default GraficoEstadoActual
