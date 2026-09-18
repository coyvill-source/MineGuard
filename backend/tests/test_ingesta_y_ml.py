"""Ingesta por archivo, ingesta aleatoria, y el pipeline ML compartido
(escalado + inferencia + corrección + clasificación de umbrales)."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.umbrales import clasificar_nivel_alerta, ppm_a_porcentaje
from app.models.telemetria import NivelAlerta, Telemetria
from tests.conftest import EstacionYPunto, UsuarioAutenticado

# Archivo pequeño de prueba (no el de 1713 filas real): 3 filas validas +
# 2 invalidas (una con Temp vacio, otra con Humed no numerico), a
# proposito para verificar el conteo de filas_descartadas.
CSV_PRUEBA = (
    b"Temp,Humed,Ch4,Bateria,hora_insertion\n"
    b"25.5,40.2,8000,75.0,2026-01-01 10:00:00\n"
    b"28.0,35.0,12000,60.0,2026-01-01 10:01:00\n"
    b",50.0,9000,80.0,2026-01-01 10:02:00\n"
    b"30.0,abc,7000,55.0,2026-01-01 10:03:00\n"
    b"22.0,45.0,20000,90.0,2026-01-01 10:04:00\n"
)


async def test_ingesta_archivo_filas_validas_y_descartadas(
    client: AsyncClient,
    db_session: AsyncSession,
    usuario_trabajador: UsuarioAutenticado,
    estacion_y_punto: EstacionYPunto,
    modelo_ml_activo,
) -> None:
    respuesta = await client.post(
        "/api/telemetria/ingesta-archivo",
        data={"punto_control_id": str(estacion_y_punto.punto.id)},
        files={"archivo": ("prueba.csv", CSV_PRUEBA, "text/csv")},
        headers=usuario_trabajador.headers,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["filas_procesadas"] == 3
    assert cuerpo["filas_descartadas"] == 2
    assert cuerpo["punto_control_id"] == estacion_y_punto.punto.id

    filas = (
        await db_session.scalars(
            select(Telemetria).where(Telemetria.punto_id == estacion_y_punto.punto.id)
        )
    ).all()
    assert len(filas) == 3
    for fila in filas:
        assert fila.error_predicho is not None
        assert fila.gas_corregido is not None
        assert fila.gas_corregido_porcentaje is not None
        assert fila.nivel_alerta is not None


async def test_ingesta_archivo_punto_control_inexistente(
    client: AsyncClient, usuario_trabajador: UsuarioAutenticado, modelo_ml_activo
) -> None:
    respuesta = await client.post(
        "/api/telemetria/ingesta-archivo",
        data={"punto_control_id": "999999"},
        files={"archivo": ("prueba.csv", CSV_PRUEBA, "text/csv")},
        headers=usuario_trabajador.headers,
    )
    assert respuesta.status_code == 404


async def test_ingesta_aleatoria_campos_calculados_correctamente(
    client: AsyncClient,
    db_session: AsyncSession,
    usuario_trabajador: UsuarioAutenticado,
    estacion_y_punto: EstacionYPunto,
    modelo_ml_activo,
) -> None:
    cantidad = 5
    respuesta = await client.post(
        "/api/telemetria/ingesta-aleatoria",
        json={"punto_control_id": estacion_y_punto.punto.id, "cantidad": cantidad},
        headers=usuario_trabajador.headers,
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["filas_generadas"] == cantidad

    filas = (
        await db_session.scalars(
            select(Telemetria).where(Telemetria.punto_id == estacion_y_punto.punto.id)
        )
    ).all()
    assert len(filas) == cantidad

    for fila in filas:
        assert fila.error_predicho is not None
        assert fila.gas_corregido is not None
        assert fila.gas_corregido_porcentaje is not None

        # Verifica la formula de correccion real, no solo que el campo
        # exista: gas_corregido = gas_crudo + error_predicho.
        assert fila.gas_corregido == pytest.approx(fila.gas_crudo + fila.error_predicho)

        # Verifica que la clasificacion de nivel_alerta persistida
        # coincide con volver a correr el motor de umbrales sobre el
        # mismo gas_corregido_porcentaje - confirma que ingesta-aleatoria
        # esta usando el motor real, no un valor fijo.
        assert fila.nivel_alerta == clasificar_nivel_alerta(fila.gas_corregido_porcentaje)
        assert fila.gas_corregido_porcentaje == pytest.approx(ppm_a_porcentaje(fila.gas_corregido))


async def test_ingesta_aleatoria_punto_control_inexistente(
    client: AsyncClient, usuario_trabajador: UsuarioAutenticado, modelo_ml_activo
) -> None:
    respuesta = await client.post(
        "/api/telemetria/ingesta-aleatoria",
        json={"punto_control_id": 999999, "cantidad": 1},
        headers=usuario_trabajador.headers,
    )
    assert respuesta.status_code == 404


async def test_ingesta_aleatoria_cantidad_invalida(
    client: AsyncClient, usuario_trabajador: UsuarioAutenticado, estacion_y_punto: EstacionYPunto
) -> None:
    respuesta = await client.post(
        "/api/telemetria/ingesta-aleatoria",
        json={"punto_control_id": estacion_y_punto.punto.id, "cantidad": 0},
        headers=usuario_trabajador.headers,
    )
    assert respuesta.status_code == 422


# --- Motor de umbrales (Decreto 1886): limites exactos de cada rango ---
# OPTIMO <= 0.9% ; 0.9% < ALERTA < 1.5% ; CRITICO >= 1.5%.


@pytest.mark.parametrize(
    ("porcentaje", "nivel_esperado"),
    [
        (0.0, NivelAlerta.OPTIMO),
        (0.5, NivelAlerta.OPTIMO),
        (0.9, NivelAlerta.OPTIMO),  # limite exacto: <= es OPTIMO
        (0.9001, NivelAlerta.ALERTA),  # justo por encima del limite
        (1.2, NivelAlerta.ALERTA),
        (1.4999, NivelAlerta.ALERTA),  # justo por debajo del limite critico
        (1.5, NivelAlerta.CRITICO),  # limite exacto: >= es CRITICO
        (2.0, NivelAlerta.CRITICO),
    ],
)
def test_clasificar_nivel_alerta_limites(porcentaje: float, nivel_esperado: NivelAlerta) -> None:
    assert clasificar_nivel_alerta(porcentaje) == nivel_esperado


def test_ppm_a_porcentaje_conversion() -> None:
    assert ppm_a_porcentaje(10_000) == pytest.approx(1.0)
    assert ppm_a_porcentaje(9_000) == pytest.approx(0.9)
    assert ppm_a_porcentaje(0) == 0.0
