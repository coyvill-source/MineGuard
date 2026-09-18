from datetime import datetime

from pydantic import BaseModel


class ConteoPorNivel(BaseModel):
    """Metrica 1 - estado actual de riesgo: conteo de puntos ACTIVOS por
    nivel_alerta de su ultima lectura, mismo criterio que
    GET /api/puntos-control/estado-actual. `sin_datos` agrupa tanto los
    puntos sin ninguna lectura todavia como los que su ultima lectura quedo
    en SIN_CLASIFICAR (lectura manual con datos incompletos, ver DECISION
    de "lectura manual" en docs/PROJECT_CONTEXT.md) - desde la perspectiva
    de este panel, ambos casos significan lo mismo: "no se puede evaluar el
    riesgo con confianza ahora mismo". Mismo fallback que ya usa el
    frontend (PlanoPuntosControl.jsx, ESTILO_POR_NIVEL[...] ?? ESTILO_SIN_DATOS)."""

    optimo: int
    alerta: int
    critico: int
    sin_datos: int


class RankingPunto(BaseModel):
    """Metrica 2 - un punto en el ranking de "mas problematicos": total de
    lecturas HISTORICAS (no solo la ultima) en nivel ALERTA o CRITICO."""

    punto_control_id: int
    nombre_estacion: str
    estacion_nombre: str
    activo: bool
    total_lecturas_problematicas: int


class ResolucionAlertas(BaseModel):
    """Metrica 3 - tiempo promedio de resolucion de alertas ya RESUELTAS
    (fecha_actualizacion - fecha_creacion). `promedio_minutos` es None si
    `cantidad_resueltas` es 0 - el frontend debe mostrar un mensaje claro en
    ese caso, nunca un promedio de 0 (seria enganoso, no es que se resuelven
    instantaneamente, es que no hay datos)."""

    cantidad_resueltas: int
    promedio_minutos: float | None


class PuntoBateriaBaja(BaseModel):
    """Metrica 4 - un punto cuya ULTIMA lectura tiene bateria por debajo de
    `UMBRAL_BATERIA_BAJA_PORCENTAJE` (ver app/core/umbrales.py)."""

    punto_control_id: int
    nombre_estacion: str
    estacion_nombre: str
    bateria: float
    timestamp: datetime


class EstadisticasResumen(BaseModel):
    estado_actual: ConteoPorNivel
    ranking_problematicos: list[RankingPunto]
    resolucion_alertas: ResolucionAlertas
    bateria_baja: list[PuntoBateriaBaja]
    # Se incluye en la respuesta (no solo como constante de backend) para
    # que el frontend arme su mensaje ("por debajo de X%") sin hardcodear el
    # mismo numero por su cuenta en un segundo lugar - una sola fuente de
    # verdad para el umbral.
    umbral_bateria_baja_porcentaje: float
