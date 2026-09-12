function Hero() {
  return (
    <header className="relative overflow-hidden bg-mg-navy-900 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-mg-accent-500/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-[88vh] max-w-7xl flex-col justify-center px-6 py-[4.8rem] sm:px-10 lg:px-16">
        <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
          MineGuard Web
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-mg-surface-100/80 sm:text-xl">
          Inteligencia artificial para anticipar atmósferas viciadas y
          proteger vidas en entornos confinados de minería subterránea.
        </p>

        <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <a
            href="#solucion"
            className="text-sm font-medium text-mg-surface-100/70 underline-offset-4 transition hover:text-white hover:underline"
          >
            Ver cómo funciona el modelo &darr;
          </a>
        </div>

        <dl className="mt-8 grid max-w-2xl grid-cols-3 gap-6 border-t border-white/10 pt-8">
          <div>
            <dt className="text-xs tracking-wide text-mg-surface-100/60 uppercase">
              Estación piloto
            </dt>
            <dd className="mt-1 text-2xl font-bold">Chicamocha</dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-mg-surface-100/60 uppercase">
              Puntos de control
            </dt>
            <dd className="mt-1 text-2xl font-bold">8 activos</dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-mg-surface-100/60 uppercase">
              Modelo ML
            </dt>
            <dd className="mt-1 text-2xl font-bold">Random Forest</dd>
          </div>
        </dl>
      </div>
    </header>
  )
}

export default Hero
