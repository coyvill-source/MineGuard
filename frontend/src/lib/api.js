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

export function register({ email, password, rol }) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, rol }),
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
