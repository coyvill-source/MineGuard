from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.api.alertas import router as alertas_router
from app.api.auth import router as auth_router
from app.api.auth_google import router as auth_google_router
from app.api.estadisticas import router as estadisticas_router
from app.api.puntos_control import router as puntos_control_router
from app.api.telemetria import router as telemetria_router
from app.api.usuarios import router as usuarios_router
from app.core.config import settings

app = FastAPI(title="MineGuard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Requerido por Authlib (authlib.integrations.starlette_client) para guardar
# el `state`/`nonce` anti-CSRF entre GET /api/auth/google/login y
# GET /api/auth/google/callback. Reutiliza el mismo secret que firma los JWT
# (settings.secret_key) - un solo secreto de firma para todo el backend, sin
# agregar una env var nueva para esto.
app.add_middleware(SessionMiddleware, secret_key=settings.secret_key)


app.include_router(alertas_router, prefix="/api/alertas")
app.include_router(auth_router, prefix="/api/auth")
app.include_router(auth_google_router, prefix="/api/auth")
app.include_router(estadisticas_router, prefix="/api/estadisticas")
app.include_router(puntos_control_router, prefix="/api/puntos-control")
app.include_router(telemetria_router, prefix="/api/telemetria")
app.include_router(usuarios_router, prefix="/api/usuarios")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
