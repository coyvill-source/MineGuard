"""Seed idempotente de la Estacion Chicamocha y sus puntos de control.

Uso: python -m app.scripts.seed_estacion_chicamocha
"""

import asyncio
import sys
from pathlib import Path

import pandas as pd
from sqlalchemy import select

# asyncpg no es compatible con el ProactorEventLoop que asyncio usa por defecto
# en Windows (provoca ConnectionResetError / ConnectionDoesNotExistError).
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.core.database import AsyncSessionLocal
from app.models.estacion import Estacion
from app.models.punto_control import PuntoControl

NOMBRE_ESTACION = "Estación Chicamocha"
ARCHIVO_COORDENADAS = Path(__file__).resolve().parent.parent / "datos_prueba" / "coordenadas.xlsx"
HOJA_COORDENADAS = "ESTACIÓN_Chicamocha"


async def seed() -> None:
    df = pd.read_excel(ARCHIVO_COORDENADAS, sheet_name=HOJA_COORDENADAS)

    async with AsyncSessionLocal() as db:
        estacion = await db.scalar(select(Estacion).where(Estacion.nombre == NOMBRE_ESTACION))
        if estacion is None:
            estacion = Estacion(nombre=NOMBRE_ESTACION)
            db.add(estacion)
            await db.flush()
            print(f"Estacion creada: {estacion.nombre} (id={estacion.id})")
        else:
            print(f"Estacion ya existente: {estacion.nombre} (id={estacion.id})")

        existentes = await db.scalars(
            select(PuntoControl).where(PuntoControl.estacion_id == estacion.id)
        )
        controles_existentes = {p.nombre_estacion for p in existentes}

        creados = 0
        for _, fila in df.iterrows():
            control = str(int(fila["CONTROL"]))
            if control in controles_existentes:
                continue

            db.add(
                PuntoControl(
                    estacion_id=estacion.id,
                    nombre_estacion=control,
                    coord_x=float(fila["cX"]),
                    coord_y=float(fila["cY"]),
                    coord_z=float(fila["cZ"]),
                )
            )
            creados += 1

        await db.commit()
        print(f"Puntos de control creados: {creados} (ya existian: {len(controles_existentes)})")


if __name__ == "__main__":
    asyncio.run(seed())
