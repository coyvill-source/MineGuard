const CAMPOS_COORDENADAS = [
  ["coord_x", "Coord. X"],
  ["coord_y", "Coord. Y"],
  ["coord_z", "Coord. Z"],
]

function CamposPuntoControl({ valores, onCambiar, estacionesDisponibles, placeholderVacio }) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="campo-estacion" className="block text-sm font-medium text-mg-navy-800">
          Estación
        </label>
        <select
          id="campo-estacion"
          value={valores.estacion_id}
          onChange={(evento) => onCambiar("estacion_id", evento.target.value)}
          className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
        >
          <option value="">{placeholderVacio}</option>
          {estacionesDisponibles.map((id) => (
            <option key={id} value={id}>
              Estación #{id}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="campo-nombre" className="block text-sm font-medium text-mg-navy-800">
          Nombre / número de control
        </label>
        <input
          id="campo-nombre"
          type="text"
          value={valores.nombre_estacion}
          onChange={(evento) => onCambiar("nombre_estacion", evento.target.value)}
          placeholder={placeholderVacio}
          className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-4 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {CAMPOS_COORDENADAS.map(([campo, etiqueta]) => (
          <div key={campo}>
            <label htmlFor={`campo-${campo}`} className="block text-sm font-medium text-mg-navy-800">
              {etiqueta}
            </label>
            <input
              id={`campo-${campo}`}
              type="number"
              step="any"
              value={valores[campo]}
              onChange={(evento) => onCambiar(campo, evento.target.value)}
              placeholder={placeholderVacio}
              className="mt-1.5 w-full rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-3 py-2.5 text-sm text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default CamposPuntoControl
