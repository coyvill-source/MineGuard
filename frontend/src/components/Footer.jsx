import logoBlanco from "../assets/images/logo/logo_blanco.png"

function Footer() {
  const anio = new Date().getFullYear()

  return (
    <footer className="bg-mg-navy-950 text-mg-surface-100/70">
      <div className="mx-auto max-w-7xl px-6 pt-16 pb-3 sm:px-10 lg:px-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <img src={logoBlanco} alt="MineGuard Web" className="h-16 w-auto object-contain" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed">
              Plataforma de monitoreo predictivo de metano en minas
              subterráneas, basada en WSN y Machine Learning.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold tracking-wide text-white uppercase">
              Normativa y referencias
            </h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a
                  href="https://www.anm.gov.co/"
                  target="_blank"
                  rel="noreferrer"
                  className="transition hover:text-white"
                >
                  Agencia Nacional de Minería (ANM)
                </a>
              </li>
              <li>
                <a
                  href="https://www.minenergia.gov.co/"
                  target="_blank"
                  rel="noreferrer"
                  className="transition hover:text-white"
                >
                  Ministerio de Minas y Energía
                </a>
              </li>
              <li>
                <a
                  href="https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=65325"
                  target="_blank"
                  rel="noreferrer"
                  className="transition hover:text-white"
                >
                  Reglamento de Seguridad en las Labores Subterráneas
                  (Decreto 1886 de 2015)
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold tracking-wide text-white uppercase">
              Contacto
            </h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a
                  href="mailto:contacto@mineguard.co"
                  className="transition hover:text-white"
                >
                  contacto@mineguard.co
                </a>
              </li>
              <li>Estación piloto: Chicamocha, Boyacá</li>
              <li>Soporte técnico operativo 24/7</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© {anio} MineGuard Web. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
