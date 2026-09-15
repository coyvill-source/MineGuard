"""Backfill retroactivo del motor de umbrales.

Recorre TODOS los registros de Telemetria donde gas_corregido NO es NULL
(los que ya pasaron por el pipeline ML) y recalcula, para cada uno:
- gas_corregido_porcentaje = gas_corregido (ppm) / 10000
- nivel_alerta segun los rangos del Decreto 1886 (ver app/core/umbrales.py)

Los registros historicos con gas_corregido NULL (nunca reprocesados por el
pipeline ML) se dejan intactos - no hay nada que calcular para ellos.

Idempotente: el calculo es determinista (misma formula, mismos rangos), asi
que correr el script varias veces sobreescribe cada fila con el mismo
resultado - no duplica ni acumula nada.

Uso: python -m app.scripts.reclasificar_telemetria_historica
"""

import asyncio
import sys
from collections import Counter

from sqlalchemy import select

# asyncpg no es compatible con el ProactorEventLoop que asyncio usa por defecto
# en Windows (provoca ConnectionResetError / ConnectionDoesNotExistError).
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.core.database import AsyncSessionLocal
from app.core.umbrales import clasificar_nivel_alerta, ppm_a_porcentaje
from app.models.telemetria import Telemetria


async def reclasificar() -> None:
    async with AsyncSessionLocal() as db:
        resultado = await db.scalars(
            select(Telemetria).where(Telemetria.gas_corregido.is_not(None))
        )
        filas = list(resultado.all())

        contador_niveles: Counter[str] = Counter()

        for fila in filas:
            porcentaje = ppm_a_porcentaje(fila.gas_corregido)
            nivel = clasificar_nivel_alerta(porcentaje)

            fila.gas_corregido_porcentaje = porcentaje
            fila.nivel_alerta = nivel
            contador_niveles[nivel.value] += 1

        await db.commit()

    print(f"Filas actualizadas: {len(filas)}")
    print("Resumen por nivel:")
    for nivel in ("optimo", "alerta", "critico"):
        print(f"  {nivel}: {contador_niveles.get(nivel, 0)}")


if __name__ == "__main__":
    asyncio.run(reclasificar())
