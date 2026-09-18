import { useState } from "react"
import DashboardLayout from "../components/dashboard/DashboardLayout"
import { useAuth } from "../context/AuthContext"
import { useUsuarios } from "../hooks/useUsuarios"
import { ApiError, actualizarRolUsuario } from "../lib/api"

// Misma etiqueta/orden ya usada en CabeceraDashboard.jsx (ROL_ETIQUETA, ahi
// privado a ese archivo) - se repite aqui en vez de exportarla desde un
// componente de layout no relacionado, pero con el mismo texto exacto.
const ETIQUETA_ROL = {
  trabajador: "Trabajador",
  supervisor: "Supervisor HSE",
  admin: "Administrador",
}

// 3 niveles de privilegio, ninguno reutiliza la paleta semaforo
// (mg-safe/mg-alert/mg-danger) - trabajador en slate (nivel base, mismo tono
// ya usado para "Inactivo" en TablaPuntosControl.jsx), supervisor en
// mg-accent (color de marca, "elevado"), admin en purple (mismo tono exacto
// ya usado para el estado "muteada" en TablaAlertas.jsx - ya establecido en
// este proyecto como "estado especial/gestionado").
const BADGE_ROL = {
  trabajador: "bg-slate-200 text-slate-600",
  supervisor: "bg-mg-accent-500/10 text-mg-accent-600",
  admin: "bg-purple-100 text-purple-700",
}

const OPCIONES_ROL = [
  ["trabajador", ETIQUETA_ROL.trabajador],
  ["supervisor", ETIQUETA_ROL.supervisor],
  ["admin", ETIQUETA_ROL.admin],
]

const ETIQUETA_METODO = {
  password: "Correo y contraseña",
  google: "Google",
}

function formatearFecha(iso) {
  if (!iso) return "Nunca"
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })
}

function FilaUsuario({ usuario, token, onCambio, esUsuarioActual }) {
  const [editando, setEditando] = useState(false)
  const [rolSeleccionado, setRolSeleccionado] = useState(usuario.rol)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")

  function abrirEdicion() {
    setRolSeleccionado(usuario.rol)
    setError("")
    setEditando(true)
  }

  async function confirmarCambio() {
    setEnviando(true)
    setError("")
    try {
      await actualizarRolUsuario(token, usuario.id, rolSeleccionado)
      setEditando(false)
      onCambio(`Rol de ${usuario.email} actualizado a "${ETIQUETA_ROL[rolSeleccionado]}".`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar el rol.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <tr className="border-b border-mg-surface-100 last:border-0">
      <td className="px-4 py-3 text-sm font-medium text-mg-navy-900">{usuario.email}</td>
      <td className="px-4 py-3 text-sm text-mg-navy-700">
        {usuario.nombre} {usuario.apellidos}
      </td>
      <td className="px-4 py-3 text-sm text-mg-navy-700">{ETIQUETA_METODO[usuario.metodo_registro]}</td>
      <td className="px-4 py-3 text-sm text-mg-navy-700">{formatearFecha(usuario.fecha_creacion)}</td>
      <td className="px-4 py-3 text-sm text-mg-navy-700">{formatearFecha(usuario.ultimo_acceso)}</td>
      <td className="px-4 py-3 text-sm">
        {editando ? (
          <div className="flex flex-col gap-2">
            {error && <p className="text-xs font-medium text-mg-danger-500">{error}</p>}
            <div className="flex items-center gap-2">
              <select
                value={rolSeleccionado}
                onChange={(evento) => setRolSeleccionado(evento.target.value)}
                className="rounded-lg border border-mg-surface-100 bg-mg-surface-50 px-2.5 py-1.5 text-xs text-mg-navy-900 outline-none transition focus:border-mg-accent-500 focus:ring-2 focus:ring-mg-accent-300"
              >
                {OPCIONES_ROL.map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={confirmarCambio}
                disabled={enviando || rolSeleccionado === usuario.rol}
                className="text-xs font-semibold text-mg-accent-500 hover:underline disabled:cursor-not-allowed disabled:text-mg-navy-700/40 disabled:no-underline"
              >
                {enviando ? "Guardando..." : "Confirmar"}
              </button>
              <button
                type="button"
                onClick={() => setEditando(false)}
                disabled={enviando}
                className="text-xs font-semibold text-mg-navy-700 hover:underline"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE_ROL[usuario.rol]}`}>
              {ETIQUETA_ROL[usuario.rol] ?? usuario.rol}
            </span>
            {esUsuarioActual ? (
              <span
                className="text-xs text-mg-navy-700/60"
                title="No puedes cambiar tu propio rol - pídele a otro administrador que lo haga."
              >
                Tu cuenta
              </span>
            ) : (
              <button
                type="button"
                onClick={abrirEdicion}
                className="text-xs font-semibold text-mg-accent-500 hover:underline"
              >
                Cambiar rol
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

function TablaUsuarios({ usuarios, token, onCambio, usuarioActualId }) {
  if (usuarios.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-mg-surface-100 bg-white p-6 text-center text-sm text-mg-navy-700">
        No hay usuarios registrados.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-mg-surface-100 bg-white">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-mg-surface-100 text-xs font-semibold tracking-wide text-mg-navy-700/70 uppercase">
            <th className="px-4 py-3">Correo</th>
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3">Método de registro</th>
            <th className="px-4 py-3">Registrado</th>
            <th className="px-4 py-3">Último acceso</th>
            <th className="px-4 py-3">Rol</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((usuario) => (
            <FilaUsuario
              key={usuario.id}
              usuario={usuario}
              token={token}
              onCambio={onCambio}
              esUsuarioActual={usuario.id === usuarioActualId}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ContenidoGestionUsuarios({ token, usuarioActualId }) {
  const { usuarios, isLoading, error, recargar } = useUsuarios(token)
  const [mensajeExito, setMensajeExito] = useState("")

  function manejarCambio(mensaje) {
    setMensajeExito(mensaje)
    recargar()
  }

  return (
    <div className="mt-4">
      <p className="max-w-2xl text-sm text-mg-navy-700">
        Todos los usuarios registrados en la plataforma. Cambiar el rol de un usuario toma efecto de
        inmediato en su próxima acción.
      </p>

      {mensajeExito && (
        <div className="mt-4 rounded-lg border border-mg-safe-500/30 bg-mg-safe-500/10 px-4 py-3 text-sm font-medium text-mg-safe-500">
          {mensajeExito}
        </div>
      )}

      <div className="mt-4">
        {isLoading ? (
          <p className="text-sm text-mg-navy-700">Cargando usuarios...</p>
        ) : error ? (
          <div className="rounded-2xl border border-mg-danger-500/30 bg-mg-danger-500/10 p-6 text-center">
            <p className="text-sm font-medium text-mg-danger-500">{error}</p>
            <button
              type="button"
              onClick={recargar}
              className="mt-4 rounded-lg bg-mg-accent-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-mg-accent-600"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <TablaUsuarios
            usuarios={usuarios}
            token={token}
            onCambio={manejarCambio}
            usuarioActualId={usuarioActualId}
          />
        )}
      </div>
    </div>
  )
}

// Gate de acceso: DashboardLayout ya resuelve `usuario` via me(token) (gate
// de "no hay token" vive ahi). Aqui se agrega un segundo gate por ROL,
// nuevo en este proyecto - las demas pantallas solo ocultan opciones del
// menu segun el rol, pero no bloqueaban la URL directa todavia. Mismo
// "look" de tarjeta centrada que ya usa el gate de sesion de
// DashboardLayout.jsx, para que se sienta parte del mismo mecanismo, no uno
// nuevo - solo cambia el mensaje.
function GestionUsuarios() {
  const { token } = useAuth()

  return (
    <DashboardLayout titulo="Gestión de Usuarios">
      {(usuario) => {
        if (!usuario) {
          return <p className="mt-6 text-sm text-mg-navy-700">Cargando...</p>
        }

        if (usuario.rol !== "admin") {
          return (
            <div className="mt-6 flex justify-center">
              <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg shadow-mg-navy-900/5">
                <h2 className="text-xl font-bold text-mg-navy-900">Acceso restringido</h2>
                <p className="mt-2 text-sm text-mg-navy-700">
                  Esta sección es solo para Administradores. Si necesitas gestionar usuarios, contacta a un
                  Administrador.
                </p>
              </div>
            </div>
          )
        }

        return <ContenidoGestionUsuarios token={token} usuarioActualId={usuario.id} />
      }}
    </DashboardLayout>
  )
}

export default GestionUsuarios
