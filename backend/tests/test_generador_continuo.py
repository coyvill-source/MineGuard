"""Generador continuo: iniciar, estado, detener, doble-inicio rechazado,
y que realmente inserta lecturas periodicas mientras corre."""

import asyncio

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import telemetria as telemetria_module
from app.models.telemetria import Telemetria
from tests.conftest import EstacionYPunto, UsuarioAutenticado


@pytest_asyncio.fixture(autouse=True)
async def _sin_tarea_de_fondo_huerfana():
    """Defensa extra: si una prueba de este archivo falla ANTES de llamar
    a /detener, la tarea de asyncio.create_task quedaria corriendo en el
    proceso de pytest y podria seguir insertando filas (contra
    PuntoControl/ModeloML que la prueba SIGUIENTE ya trunco) - se cancela
    aqui sin importar como haya terminado la prueba."""
    yield

    tarea = telemetria_module._generador_continuo_task
    if tarea is not None and not tarea.done():
        tarea.cancel()
        try:
            await tarea
        except asyncio.CancelledError:
            pass

    telemetria_module._generador_continuo_task = None
    telemetria_module._generador_continuo_intervalo = None
    telemetria_module._generador_continuo_iniciado_en = None


async def test_estado_inicial_no_corriendo(
    client: AsyncClient, usuario_trabajador: UsuarioAutenticado
) -> None:
    respuesta = await client.get(
        "/api/telemetria/generador-continuo/estado", headers=usuario_trabajador.headers
    )
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["corriendo"] is False
    assert cuerpo["intervalo_segundos"] is None
    assert cuerpo["iniciado_en"] is None


async def test_iniciar_y_estado_refleja_intervalo(
    client: AsyncClient, usuario_admin: UsuarioAutenticado, usuario_trabajador: UsuarioAutenticado,
    estacion_y_punto: EstacionYPunto, modelo_ml_activo,
) -> None:
    inicio = await client.post(
        "/api/telemetria/generador-continuo/iniciar",
        json={"intervalo_segundos": 3600},
        headers=usuario_admin.headers,
    )
    assert inicio.status_code == 200
    assert inicio.json()["corriendo"] is True
    assert inicio.json()["intervalo_segundos"] == 3600

    estado = await client.get(
        "/api/telemetria/generador-continuo/estado", headers=usuario_trabajador.headers
    )
    assert estado.json()["corriendo"] is True
    assert estado.json()["intervalo_segundos"] == 3600
    assert estado.json()["iniciado_en"] is not None


async def test_iniciar_dos_veces_sin_detener_falla(
    client: AsyncClient, usuario_admin: UsuarioAutenticado, estacion_y_punto: EstacionYPunto,
    modelo_ml_activo,
) -> None:
    primera = await client.post(
        "/api/telemetria/generador-continuo/iniciar",
        json={"intervalo_segundos": 3600},
        headers=usuario_admin.headers,
    )
    assert primera.status_code == 200

    segunda = await client.post(
        "/api/telemetria/generador-continuo/iniciar",
        json={"intervalo_segundos": 3600},
        headers=usuario_admin.headers,
    )
    assert segunda.status_code == 409


async def test_intervalo_menor_al_minimo_rechazado(
    client: AsyncClient, usuario_admin: UsuarioAutenticado
) -> None:
    respuesta = await client.post(
        "/api/telemetria/generador-continuo/iniciar",
        json={"intervalo_segundos": 4},
        headers=usuario_admin.headers,
    )
    assert respuesta.status_code == 422


async def test_detener_sin_nada_corriendo_falla(
    client: AsyncClient, usuario_admin: UsuarioAutenticado
) -> None:
    respuesta = await client.post(
        "/api/telemetria/generador-continuo/detener", headers=usuario_admin.headers
    )
    assert respuesta.status_code == 409


async def test_detener_funciona_y_estado_vuelve_a_no_corriendo(
    client: AsyncClient, usuario_admin: UsuarioAutenticado, estacion_y_punto: EstacionYPunto,
    modelo_ml_activo,
) -> None:
    await client.post(
        "/api/telemetria/generador-continuo/iniciar",
        json={"intervalo_segundos": 3600},
        headers=usuario_admin.headers,
    )

    detener = await client.post(
        "/api/telemetria/generador-continuo/detener", headers=usuario_admin.headers
    )
    assert detener.status_code == 200

    estado = await client.get(
        "/api/telemetria/generador-continuo/estado", headers=usuario_admin.headers
    )
    assert estado.json()["corriendo"] is False


async def test_genera_lecturas_periodicas_para_puntos_activos(
    client: AsyncClient, db_session: AsyncSession, usuario_admin: UsuarioAutenticado,
    estacion_y_punto: EstacionYPunto, modelo_ml_activo,
) -> None:
    # Intervalo en el minimo permitido (5s) para que la prueba sea lo mas
    # rapida posible mientras sigue ejercitando el bucle real de fondo (no
    # solo el estado "corriendo").
    inicio = await client.post(
        "/api/telemetria/generador-continuo/iniciar",
        json={"intervalo_segundos": 5},
        headers=usuario_admin.headers,
    )
    assert inicio.status_code == 200

    # Espera ACTIVA (poll) en vez de un sleep fijo: `_bucle_generador_continuo`
    # genera su primer lote casi de inmediato al iniciar (antes del primer
    # `asyncio.sleep(intervalo_segundos)` del bucle, ver telemetria.py), asi
    # que en la practica esto suele resolver en bien menos de 1s. El sleep
    # fijo anterior (6.5s, pensado como "un poco mas que el intervalo minimo
    # de 5s") fallo de forma intermitente corriendo la suite completa (75
    # passed, 1 failed - assert 0 >= 1) pero paso consistente corriendo sola
    # o en una segunda corrida completa: bajo la carga de las otras 75
    # pruebas en el mismo proceso, el scheduling del event loop a veces
    # tardaba mas que el margen fijo. El poll reintenta cada 0.2s hasta un
    # techo generoso de 15s (3x el intervalo minimo), asi que tolera esa
    # carga sin alargar el caso comun ni depender de adivinar un numero de
    # segundos "seguro" - ver DECISION en docs/PROJECT_CONTEXT.md.
    TIMEOUT_SEGUNDOS = 15.0
    INTERVALO_POLL = 0.2
    limite = asyncio.get_event_loop().time() + TIMEOUT_SEGUNDOS
    filas: list[Telemetria] = []
    while asyncio.get_event_loop().time() < limite:
        filas = (
            await db_session.scalars(
                select(Telemetria).where(Telemetria.punto_id == estacion_y_punto.punto.id)
            )
        ).all()
        if len(filas) >= 1:
            break
        await asyncio.sleep(INTERVALO_POLL)

    await client.post("/api/telemetria/generador-continuo/detener", headers=usuario_admin.headers)

    assert len(filas) >= 1, f"No se genero ninguna lectura tras esperar {TIMEOUT_SEGUNDOS}s"
    for fila in filas:
        assert fila.nivel_alerta is not None
        assert fila.gas_corregido is not None
