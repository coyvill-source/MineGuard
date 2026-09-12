import mineriaSubterranea from "../assets/images/problema/mineria-subterranea.jpg"

const riesgos = [
  {
    titulo: "Atmósferas viciadas",
    descripcion:
      "La acumulación de metano (CH4) en galerías y frentes de explotación reduce el oxígeno disponible y eleva el riesgo de explosión, muchas veces sin señales perceptibles para el operario.",
  },
  {
    titulo: "Propagación electromagnética subterránea",
    descripcion:
      "La roca, la humedad y la geometría irregular de los túneles distorsionan y atenúan las ondas de radio, complicando la transmisión estable de datos de la WSN hacia superficie.",
  },
  {
    titulo: "Decisiones tardías",
    descripcion:
      "Sin un modelo predictivo, la corrección del error de lectura del sensor y la escalada de alertas dependen de inspecciones manuales, con retrasos que pueden ser críticos.",
  },
]

function Problema() {
  return (
    <section id="problema" className="relative overflow-hidden py-24 sm:py-28">
      <img
        src={mineriaSubterranea}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-white/80" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-6 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-sm font-semibold tracking-wide text-mg-navy-800 uppercase">
            El Problema
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-mg-navy-900 sm:text-4xl">
            Contexto Boyacá: minería subterránea de alto riesgo
          </h2>
          <p className="mt-5 text-lg text-slate-900">
            En las minas de carbón de Boyacá, la seguridad operativa
            enfrenta dos desafíos simultáneos: atmósferas confinadas que
            pueden volverse letales en minutos, y una infraestructura de
            sensores inalámbricos que debe operar de forma confiable pese
            a la complejidad electromagnética del subsuelo.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {riesgos.map((riesgo) => (
            <article
              key={riesgo.titulo}
              className="rounded-2xl border-2 border-mg-accent-500 bg-white p-7 transition hover:border-mg-accent-600 hover:shadow-md"
            >
              <h3 className="min-h-[3.5rem] text-center text-lg font-semibold text-mg-navy-900">
                {riesgo.titulo}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-900">
                {riesgo.descripcion}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Problema
