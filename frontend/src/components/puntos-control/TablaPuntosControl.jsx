import { useState } from "react"

function formatearCoord(valor) {
  return typeof valor === "number" ? valor.toFixed(2) : "—"
}

function FilaPuntoControl({ punto, esGestor, onEditar, onEliminar }) {
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)

  return (
    <tr className="border-b border-mg-surface-100 last:border-0">
      <td className="px-4 py-3 text-sm font-medium text-mg-navy-900">{punto.nombre_estacion}</td>
      <td className="px-4 py-3 text-sm text-mg-navy-700">{punto.estacion_nombre}</td>
      <td className="px-4 py-3 text-sm text-mg-navy-700">{formatearCoord(punto.coord_x)}</td>
      <td className="px-4 py-3 text-sm text-mg-navy-700">{formatearCoord(punto.coord_y)}</td>
      <td className="px-4 py-3 text-sm text-mg-navy-700">{formatearCoord(punto.coord_z)}</td>
      <td className="px-4 py-3 text-sm">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            punto.activo ? "bg-mg-safe-500/10 text-mg-safe-500" : "bg-slate-200 text-slate-600"
          }`}
        >
          {punto.activo ? "Activo" : "Inactivo"}
        </span>
      </td>
      {esGestor && (
        <td className="px-4 py-3 text-right text-sm">
          {!punto.activo ? (
            <span className="text-xs text-mg-navy-700/40">—</span>
          ) : confirmandoEliminar ? (
            <div className="flex items-center justify-end gap-2">
              <span className="text-xs text-mg-navy-700">¿Eliminar?</span>
              <button
                type="button"
                onClick={() => onEliminar(punto)}
                className="text-xs font-semibold text-mg-danger-500 hover:underline"
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => setConfirmandoEliminar(false)}
                className="text-xs font-semibold text-mg-navy-700 hover:underline"
              >
                No
              </button>
            </div>
          ) : (
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => onEditar(punto)}
                className="text-xs font-semibold text-mg-accent-500 hover:underline"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => setConfirmandoEliminar(true)}
                className="text-xs font-semibold text-mg-danger-500 hover:underline"
              >
                Eliminar
              </button>
            </div>
          )}
        </td>
      )}
    </tr>
  )
}

function TablaPuntosControl({ puntos, esGestor, onEditar, onEliminar }) {
  if (puntos.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-mg-surface-100 bg-white p-6 text-center text-sm text-mg-navy-700">
        No hay puntos de control registrados.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-mg-surface-100 bg-white">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-mg-surface-100 text-xs font-semibold tracking-wide text-mg-navy-700/70 uppercase">
            <th className="px-4 py-3">Punto</th>
            <th className="px-4 py-3">Estación</th>
            <th className="px-4 py-3">X</th>
            <th className="px-4 py-3">Y</th>
            <th className="px-4 py-3">Z</th>
            <th className="px-4 py-3">Estado</th>
            {esGestor && <th className="px-4 py-3 text-right">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {puntos.map((punto) => (
            <FilaPuntoControl
              key={punto.id}
              punto={punto}
              esGestor={esGestor}
              onEditar={onEditar}
              onEliminar={onEliminar}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default TablaPuntosControl
