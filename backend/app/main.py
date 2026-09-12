from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.telemetria import router as telemetria_router

app = FastAPI(title="MineGuard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router, prefix="/api/auth")
app.include_router(telemetria_router, prefix="/api/telemetria")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
