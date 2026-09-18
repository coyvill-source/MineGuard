"""Motor de umbrales/semaforo: conversion de ppm a % de metano y
clasificacion del nivel de alerta segun el Decreto 1886.

DECISION (2026-09-15, confirmada con el usuario - ver docs/PROJECT_CONTEXT.md):
- El sensor reporta el gas en ppm; % = ppm / 10000 (1% = 10 000 ppm).
- La conversion se aplica sobre gas_corregido (ya corregido por el
  modelo ML), no sobre gas_crudo directo.
- Rangos (Decreto 1886), con limites exactos:
  OPTIMO <= 0.9% ; 0.9% < ALERTA < 1.5% ; CRITICO >= 1.5%.

PENDIENTE (no construir ahora, solo documentado): estos limites son
constantes fijas hoy. Deberian volverse configurables desde el panel
de administrador en una futura tarea (ya estaba anotado como
requisito en "Pendientes conocidos" de PROJECT_CONTEXT.md desde antes
de que existiera este motor).
"""

from app.models.telemetria import NivelAlerta

PPM_POR_PORCENTAJE = 10_000

LIMITE_OPTIMO_PORCENTAJE = 0.9
LIMITE_CRITICO_PORCENTAJE = 1.5

# Umbral de "bateria baja" para la metrica de salud de sensores
# (GET /api/estadisticas/resumen). Valor por defecto sin confirmar con el
# equipo de HSE/datos (a diferencia de los limites de gas de arriba, que si
# vienen del Decreto 1886) - PENDIENTE (no construir ahora, solo
# documentado): deberia volverse configurable desde el panel de
# administrador en una futura tarea, igual que los limites de gas.
UMBRAL_BATERIA_BAJA_PORCENTAJE = 20.0


def ppm_a_porcentaje(ppm: float) -> float:
    return ppm / PPM_POR_PORCENTAJE


def clasificar_nivel_alerta(porcentaje: float) -> NivelAlerta:
    if porcentaje >= LIMITE_CRITICO_PORCENTAJE:
        return NivelAlerta.CRITICO
    if porcentaje > LIMITE_OPTIMO_PORCENTAJE:
        return NivelAlerta.ALERTA
    return NivelAlerta.OPTIMO
