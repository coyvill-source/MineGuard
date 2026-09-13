"""Seed idempotente del ModeloML activo.

Ajusta un StandardScaler sobre las columnas Temp, Humed, Bateria del
archivo real de despliegue y registra el ModeloML (modelo entrenado +
scaler) como activo en la base de datos.

Uso: python -m app.scripts.seed_modelo_ml
"""

import asyncio
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sqlalchemy import select

# asyncpg no es compatible con el ProactorEventLoop que asyncio usa por defecto
# en Windows (provoca ConnectionResetError / ConnectionDoesNotExistError).
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.core.database import AsyncSessionLocal
from app.models.modelo_ml import ModeloML

APP_DIR = Path(__file__).resolve().parent.parent
ARCHIVO_DATOS = APP_DIR / "datos_prueba" / "Datos_despliegue.xlsx"
ARCHIVO_SCALER_ABSOLUTO = APP_DIR / "ml_models" / "scaler_temporal.joblib"

# Rutas guardadas en la BD, relativas a backend/ (asi las carga tanto este
# script como el endpoint de ingesta, sin depender del cwd del proceso).
ARCHIVO_MODELO_DB = "app/ml_models/modelo_prediccion.joblib"
ARCHIVO_SCALER_DB = "app/ml_models/scaler_temporal.joblib"

VARIABLES_ENTRADA = ["Temp", "Humed", "Bateria"]


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        existente = await db.scalar(
            select(ModeloML).where(
                ModeloML.activo.is_(True),
                ModeloML.archivo_modelo == ARCHIVO_MODELO_DB,
                ModeloML.archivo_scaler == ARCHIVO_SCALER_DB,
            )
        )
        if existente is not None:
            print(f"ModeloML activo ya registrado (id={existente.id}), no se duplica.")
            return

        df = pd.read_excel(ARCHIVO_DATOS)

        # DECISION (ver docs/PROJECT_CONTEXT.md): el equipo de datos no
        # entrego el StandardScaler original de entrenamiento. Este scaler
        # se deriva localmente ajustandolo sobre el archivo real de
        # despliegue como aproximacion TEMPORAL - debe reemplazarse cuando
        # el equipo de datos entregue el scaler real.
        scaler = StandardScaler()
        scaler.fit(df[VARIABLES_ENTRADA])

        ARCHIVO_SCALER_ABSOLUTO.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(scaler, ARCHIVO_SCALER_ABSOLUTO)
        print(f"Scaler temporal guardado en: {ARCHIVO_SCALER_ABSOLUTO}")

        modelo_ml = ModeloML(
            archivo_modelo=ARCHIVO_MODELO_DB,
            archivo_scaler=ARCHIVO_SCALER_DB,
            variables_entrada=VARIABLES_ENTRADA,
            activo=True,
        )
        db.add(modelo_ml)
        await db.commit()
        await db.refresh(modelo_ml)
        print(f"ModeloML creado y activado: id={modelo_ml.id}")


if __name__ == "__main__":
    asyncio.run(seed())
