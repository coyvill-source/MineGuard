from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.alertas import router as alertas_router
from app.api.auth import router as auth_router
from app.api.puntos_control import router as puntos_control_router
from app.api.telemetria import router as telemetria_router
from app.api.usuarios import router as usuarios_router

app = FastAPI(title="MineGuard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(alertas_router, prefix="/api/alertas")
app.include_router(auth_router, prefix="/api/auth")
app.include_router(puntos_control_router, prefix="/api/puntos-control")
app.include_router(telemetria_router, prefix="/api/telemetria")
app.include_router(usuarios_router, prefix="/api/usuarios")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
