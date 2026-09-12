import { useEffect, useState } from "react"
import logo from "../assets/images/logo/logo.png"

const navLinks = [
  { label: "Inicio", href: "#" },
  { label: "Solución", href: "#solucion" },
  { label: "Beneficios", href: "#beneficios" },
]

function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 bg-white transition-shadow duration-200 ${
        scrolled ? "shadow-md shadow-black/10" : "shadow-none"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-2 sm:px-10 lg:px-16">
        <a href="#" className="flex shrink-0 items-center">
          <img
            src={logo}
            alt="MineGuard"
            className="h-[3.0375rem] w-auto object-contain sm:h-[3.375rem]"
          />
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-mg-navy-800 transition hover:text-mg-accent-500"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden shrink-0 md:block">
          <button
            type="button"
            className="rounded-lg border border-mg-accent-500 px-5 py-2.5 text-sm font-semibold text-mg-accent-500 transition hover:bg-mg-accent-500 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-mg-accent-300 focus-visible:ring-offset-2"
          >
            Iniciar sesión
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label="Abrir menú de navegación"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-mg-navy-800 transition hover:bg-mg-surface-100 md:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
            {menuOpen ? (
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-mg-surface-100 px-6 pb-4 sm:px-10 md:hidden">
          <nav className="flex flex-col gap-1 pt-3">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-mg-navy-800 transition hover:bg-mg-surface-100 hover:text-mg-accent-500"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <button
            type="button"
            className="mt-2 w-full rounded-lg border border-mg-accent-500 px-5 py-2.5 text-sm font-semibold text-mg-accent-500 transition hover:bg-mg-accent-500 hover:text-white"
          >
            Iniciar sesión
          </button>
        </div>
      )}
    </header>
  )
}

export default Header
