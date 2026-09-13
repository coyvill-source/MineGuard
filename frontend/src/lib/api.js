import { API_BASE_URL } from "../config"

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function request(path, options = {}) {
  let response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    })
  } catch {
    throw new ApiError("No se pudo conectar con el servidor. Intenta de nuevo más tarde.", 0)
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : null
    throw new ApiError(detail ?? "Ocurrió un error inesperado. Intenta de nuevo.", response.status)
  }

  return data
}

export function login({ email, password }) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
}

export function register({ email, password, nombre, apellidos, telefono, tipoDocumento, numeroDocumento }) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      nombre,
      apellidos,
      telefono,
      tipo_documento: tipoDocumento,
      numero_documento: numeroDocumento,
    }),
  })
}

export function me(token) {
  return request("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function forgotPassword({ email }) {
  return request("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

export function resetPassword({ token, nuevaPassword }) {
  return request("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, nueva_password: nuevaPassword }),
  })
}

export function obtenerEstadoActualPuntosControl(token) {
  return request("/api/puntos-control/estado-actual", {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function listarPuntosControl(token) {
  return request("/api/puntos-control", {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function crearPuntoControl(token, datos) {
  return request("/api/puntos-control", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  })
}

export function actualizarPuntoControl(token, puntoControlId, datos) {
  return request(`/api/puntos-control/${puntoControlId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  })
}

export function eliminarPuntoControl(token, puntoControlId) {
  return request(`/api/puntos-control/${puntoControlId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function proponerCambioPuntoControl(token, datos) {
  return request("/api/puntos-control/solicitudes", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  })
}

export function listarSolicitudesCambio(token, estado) {
  const query = estado ? `?estado=${encodeURIComponent(estado)}` : ""
  return request(`/api/puntos-control/solicitudes${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function aprobarSolicitudCambio(token, solicitudId) {
  return request(`/api/puntos-control/solicitudes/${solicitudId}/aprobar`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function rechazarSolicitudCambio(token, solicitudId, comentario) {
  return request(`/api/puntos-control/solicitudes/${solicitudId}/rechazar`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ comentario }),
  })
}
