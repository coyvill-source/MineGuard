const beneficios = [
  {
    titulo: "Prevención de Fatalidades",
    descripcion:
      "Alertas tempranas basadas en la corrección de lecturas de gas reducen el tiempo de reacción ante atmósferas peligrosas.",
    icon: (
      <path
        d="M12 2 3 6v6c0 5 3.8 8.7 9 10 5.2-1.3 9-5 9-10V6l-9-4Zm-1.2 13.2L7 11.4l1.4-1.4 2.4 2.4 5.4-5.4 1.4 1.4-6.8 6.8Z"
        fill="currentColor"
      />
    ),
  },
  {
    titulo: "Monitoreo 3D",
    descripcion:
      "Visualización espacial de puntos de control para ubicar con precisión el origen de cada anomalía en la mina.",
    icon: (
      <path
        d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3 6.4 3.6L12 11.5 5.6 7.9 12 4.3ZM5 9.3l6 3.4v7L5 16.3V9.3Zm8 10.4v-7l6-3.4v7l-6 3.4Z"
        fill="currentColor"
      />
    ),
  },
  {
    titulo: "Confiabilidad de Datos",
    descripcion:
      "El modelo Random Forest corrige el error propio del sensor de gas, entregando lecturas más consistentes para la toma de decisiones.",
    icon: (
      <path
        d="M12 1 4 4v6c0 5.4 3.4 9.9 8 11 4.6-1.1 8-5.6 8-11V4l-8-3Zm0 2.2 6 2.4v5.3c0 4.2-2.6 7.8-6 8.9-3.4-1.1-6-4.7-6-8.9V5.6l6-2.4Zm-1 11.6-3-3 1.4-1.4 1.6 1.6 4-4 1.4 1.4-5.4 5.4Z"
        fill="currentColor"
      />
    ),
  },
  {
    titulo: "Trazabilidad Histórica",
    descripcion:
      "Bitácora completa del ciclo de vida de cada alerta y del histórico de telemetría para auditorías y reportes de seguridad.",
    icon: (
      <path
        d="M5 3h11l3 3v15H5V3Zm2 2v16h10V6.8L15.2 5H7Zm2 5h6v2H9v-2Zm0 4h6v2H9v-2Zm0-8h4v2H9V6Z"
        fill="currentColor"
      />
    ),
  },
]

function Beneficios() {
  return (
    <section id="beneficios" className="bg-mg-surface-50 py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-16">
        <div className="max-w-3xl">
          <span className="text-sm font-semibold tracking-wide text-mg-accent-600 uppercase">
            Beneficios Clave
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-mg-navy-900 sm:text-4xl">
            Diseñado para centros de control y operación en campo
          </h2>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {beneficios.map((item) => (
            <article
              key={item.titulo}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-xl bg-mg-accent-500/10 text-mg-accent-600">
                <svg viewBox="0 0 24 24" className="h-10 w-10" aria-hidden="true">
                  {item.icon}
                </svg>
              </div>
              <h3 className="text-center text-base font-semibold text-mg-navy-900">
                {item.titulo}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {item.descripcion}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Beneficios
