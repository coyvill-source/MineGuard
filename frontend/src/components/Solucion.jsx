const pasos = [
  {
    numero: "01",
    titulo: "Telemetría cruda",
    descripcion:
      "Cada punto de control reporta Temperatura, Humedad, Batería y Gas (CH4) crudo desde la WSN, archivo o simulador.",
  },
  {
    numero: "02",
    titulo: "Escalado (StandardScaler)",
    descripcion:
      "Temperatura, Humedad y Batería se normalizan con los mismos parámetros del entrenamiento antes de entrar al modelo. El gas no se escala: se reserva para la corrección final.",
  },
  {
    numero: "03",
    titulo: "Inferencia Random Forest",
    descripcion:
      "El RandomForestRegressor recibe las 3 variables escaladas y predice el error de lectura asociado al sensor de gas en ese punto de control.",
  },
  {
    numero: "04",
    titulo: "Corrección y detección de anomalías",
    descripcion:
      "El error predicho corrige el gas crudo (Gas Corregido = Ch4 ± Error). El resultado se compara contra umbrales configurables para emitir un nivel de alerta.",
  },
]

function Solucion() {
  return (
    <section id="solucion" className="bg-mg-navy-950 py-24 text-white sm:py-28">
      <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-16">
        <div className="max-w-3xl">
          <span className="text-sm font-semibold tracking-wide text-mg-accent-300 uppercase">
            Nuestra Solución
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Machine Learning aplicado a la corrección de lecturas de gas
            metano
          </h2>
          <p className="mt-5 text-lg text-mg-surface-100/70">
            Un pipeline de 4 etapas transforma la telemetría de la mina en una
            alerta accionable, corrigiendo el error propio del sensor de gas
            en tiempo de inferencia.
          </p>
        </div>

        <div className="relative mt-16">
          <div
            className="absolute top-8 right-0 left-0 hidden h-px bg-gradient-to-r from-transparent via-mg-accent-400/50 to-transparent lg:block"
            aria-hidden="true"
          />

          <ol className="grid gap-8 lg:grid-cols-4 lg:gap-6">
            {pasos.map((paso, index) => (
              <li key={paso.numero} className="relative">
                <div className="flex items-center gap-4 lg:flex-col lg:items-start lg:gap-0">
                  <div className="relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-mg-accent-400/40 bg-mg-navy-900 font-mono text-lg font-bold text-mg-accent-300">
                    {paso.numero}
                  </div>
                  {index < pasos.length - 1 && (
                    <div
                      className="h-full w-px flex-1 bg-mg-accent-400/20 lg:hidden"
                      aria-hidden="true"
                    />
                  )}
                </div>

                <div className="mt-0 pl-0 lg:mt-6">
                  <h3 className="text-lg font-semibold">{paso.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-mg-surface-100/65">
                    {paso.descripcion}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

export default Solucion
