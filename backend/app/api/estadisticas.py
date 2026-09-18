from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.puntos_control import construir_consulta_estado_actual
from app.core.database import get_db
from app.core.permissions import requiere_rol
from app.core.umbrales import UMBRAL_BATERIA_BAJA_PORCENTAJE
from app.models.bitacora_alertas import BitacoraAlertas, EstadoAlerta
from app.models.punto_control import PuntoControl
from app.models.telemetria import NivelAlerta, Telemetria
from app.models.usuario import RolUsuario, Usuario
from app.schemas.estadistica import (
    ConteoPorNivel,
    EstadisticasResumen,
    PuntoBateriaBaja,
    RankingPunto,
    ResolucionAlertas,
)

router = APIRouter(tags=["estadisticas"])

# Top N del ranking de puntos mas problematicos (metrica 2) - pedido "5-10",
# se eligio el techo del rango para dar mas contexto sin volverse una lista
# larga.
LIMITE_RANKING = 10


@router.get("/resumen", response_model=EstadisticasResumen)
async def obtener_resumen(
    db: Annotated[AsyncSession, Depends(get_db)],
    _actor: Annotated[Usuario, Depends(requiere_rol(RolUsuario.TRABAJADOR))],
) -> EstadisticasResumen:
    """Las 4 metricas del panel de Estadisticas en una sola respuesta (evita
    4 llamadas separadas desde el frontend). Metricas 1 y 4 comparten la
    MISMA consulta de base (construir_consulta_estado_actual, ya usada por
    GET /api/puntos-control/estado-actual) - se recorre una sola vez para
    construir ambas, en vez de consultar la BD dos veces para el mismo dato."""

    # --- Metricas 1 y 4: comparten la consulta de "ultima lectura por punto
    # activo" ---
    resultado_estado_actual = await db.execute(construir_consulta_estado_actual())

    conteo = {nivel.value: 0 for nivel in (NivelAlerta.OPTIMO, NivelAlerta.ALERTA, NivelAlerta.CRITICO)}
    conteo["sin_datos"] = 0
    bateria_baja: list[PuntoBateriaBaja] = []

    for punto, lectura in resultado_estado_actual.all():
        # Metrica 1: SIN_CLASIFICAR (lectura manual incompleta) cuenta como
        # "sin_datos" igual que no tener ninguna lectura - mismo fallback
        # que ya usa el frontend (PlanoPuntosControl.jsx) para ese nivel.
        if lectura is None or lectura.nivel_alerta not in (
            NivelAlerta.OPTIMO,
            NivelAlerta.ALERTA,
            NivelAlerta.CRITICO,
        ):
            conteo["sin_datos"] += 1
        else:
            conteo[lectura.nivel_alerta.value] += 1

        # Metrica 4: solo si hay lectura Y esa lectura trae bateria (puede
        # ser NULL en una lectura manual solo-gas, ver DECISION de "lectura
        # manual") - sin dato de bateria no se puede evaluar, se omite en
        # vez de asumir que esta baja.
        if lectura is not None and lectura.bateria is not None and lectura.bateria < UMBRAL_BATERIA_BAJA_PORCENTAJE:
            bateria_baja.append(
                PuntoBateriaBaja(
                    punto_control_id=punto.id,
                    nombre_estacion=punto.nombre_estacion,
                    estacion_nombre=punto.estacion_nombre,
                    bateria=lectura.bateria,
                    timestamp=lectura.timestamp,
                )
            )

    bateria_baja.sort(key=lambda p: p.bateria)

    # --- Metrica 2: ranking de puntos mas problematicos (todas las lecturas
    # historicas en ALERTA o CRITICO, agrupado por punto - no solo la
    # ultima, a diferencia de la metrica 1) ---
    consulta_ranking = (
        select(PuntoControl, func.count(Telemetria.id).label("total"))
        .join(Telemetria, Telemetria.punto_id == PuntoControl.id)
        .where(Telemetria.nivel_alerta.in_([NivelAlerta.ALERTA, NivelAlerta.CRITICO]))
        .group_by(PuntoControl.id)
        .order_by(func.count(Telemetria.id).desc())
        .limit(LIMITE_RANKING)
    )
    resultado_ranking = await db.execute(consulta_ranking)
    ranking = [
        RankingPunto(
            punto_control_id=punto.id,
            nombre_estacion=punto.nombre_estacion,
            estacion_nombre=punto.estacion_nombre,
            activo=punto.activo,
            total_lecturas_problematicas=total,
        )
        for punto, total in resultado_ranking.all()
    ]

    # --- Metrica 3: tiempo promedio de resolucion (AVG de un INTERVAL en
    # Postgres, NULL si no hay ninguna RESUELTA - AVG sobre 0 filas es NULL,
    # exactamente el caso que hay que distinguir de "0 minutos") ---
    cantidad_resueltas = await db.scalar(
        select(func.count())
        .select_from(BitacoraAlertas)
        .where(BitacoraAlertas.estado == EstadoAlerta.RESUELTA)
    )
    promedio_intervalo = await db.scalar(
        select(func.avg(BitacoraAlertas.fecha_actualizacion - BitacoraAlertas.fecha_creacion)).where(
            BitacoraAlertas.estado == EstadoAlerta.RESUELTA,
            BitacoraAlertas.fecha_actualizacion.isnot(None),
        )
    )
    promedio_minutos = promedio_intervalo.total_seconds() / 60 if promedio_intervalo is not None else None

    return EstadisticasResumen(
        estado_actual=ConteoPorNivel(**conteo),
        ranking_problematicos=ranking,
        resolucion_alertas=ResolucionAlertas(
            cantidad_resueltas=cantidad_resueltas or 0,
            promedio_minutos=promedio_minutos,
        ),
        bateria_baja=bateria_baja,
        umbral_bateria_baja_porcentaje=UMBRAL_BATERIA_BAJA_PORCENTAJE,
    )
