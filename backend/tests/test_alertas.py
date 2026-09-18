"""Crear alerta manual, duplicado, mutear/escalar/resolver, y las reglas
de validación de resolver (observación obligatoria, no resolver dos
veces)."""

from datetime import datetime, timezone

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.telemetria import EstadoValidacion, NivelAlerta, Telemetria
from tests.conftest import EstacionYPunto, UsuarioAutenticado


async def _crear_telemetria(db_session: AsyncSession, punto_id: int) -> Telemetria:
    telemetria = Telemetria(
        punto_id=punto_id,
        timestamp=datetime.now(timezone.utc),
        temperatura=20.0,
        humedad=30.0,
        bateria=80.0,
        gas_crudo=5000.0,
        nivel_alerta=NivelAlerta.OPTIMO,
        estado_validacion=EstadoValidacion.VALIDO,
    )
    db_session.add(telemetria)
    await db_session.commit()
    await db_session.refresh(telemetria)
    return telemetria


async def test_crear_alerta(
    client: AsyncClient, db_session: AsyncSession, usuario_trabajador: UsuarioAutenticado,
    estacion_y_punto: EstacionYPunto,
) -> None:
    telemetria = await _crear_telemetria(db_session, estacion_y_punto.punto.id)

    respuesta = await client.post(
        "/api/alertas",
        json={"telemetria_id": telemetria.id, "observacion_hse": "Nivel fuera de lo normal"},
        headers=usuario_trabajador.headers,
    )

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["telemetria_id"] == telemetria.id
    assert cuerpo["estado"] == "activa"


async def test_crear_alerta_telemetria_inexistente(
    client: AsyncClient, usuario_trabajador: UsuarioAutenticado
) -> None:
    respuesta = await client.post(
        "/api/alertas",
        json={"telemetria_id": 999999, "observacion_hse": "x"},
        headers=usuario_trabajador.headers,
    )
    assert respuesta.status_code == 404


async def test_crear_alerta_duplicada_para_la_misma_telemetria(
    client: AsyncClient, db_session: AsyncSession, usuario_trabajador: UsuarioAutenticado,
    estacion_y_punto: EstacionYPunto,
) -> None:
    telemetria = await _crear_telemetria(db_session, estacion_y_punto.punto.id)

    primera = await client.post(
        "/api/alertas",
        json={"telemetria_id": telemetria.id, "observacion_hse": "Primera"},
        headers=usuario_trabajador.headers,
    )
    assert primera.status_code == 201

    segunda = await client.post(
        "/api/alertas",
        json={"telemetria_id": telemetria.id, "observacion_hse": "Segunda"},
        headers=usuario_trabajador.headers,
    )
    assert segunda.status_code == 409


async def test_mutear_alerta(
    client: AsyncClient, db_session: AsyncSession, usuario_trabajador: UsuarioAutenticado,
    usuario_supervisor: UsuarioAutenticado, estacion_y_punto: EstacionYPunto,
) -> None:
    telemetria = await _crear_telemetria(db_session, estacion_y_punto.punto.id)
    creada = await client.post(
        "/api/alertas",
        json={"telemetria_id": telemetria.id, "observacion_hse": "x"},
        headers=usuario_trabajador.headers,
    )
    alerta_id = creada.json()["id"]

    respuesta = await client.patch(
        f"/api/alertas/{alerta_id}/mutear",
        json={"observacion_hse": "Falso positivo conocido"},
        headers=usuario_supervisor.headers,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["estado"] == "muteada"
    assert cuerpo["observacion_hse"] == "Falso positivo conocido"
    assert cuerpo["fecha_actualizacion"] is not None


async def test_escalar_alerta_reactiva_una_muteada(
    client: AsyncClient, db_session: AsyncSession, usuario_trabajador: UsuarioAutenticado,
    usuario_supervisor: UsuarioAutenticado, estacion_y_punto: EstacionYPunto,
) -> None:
    telemetria = await _crear_telemetria(db_session, estacion_y_punto.punto.id)
    creada = await client.post(
        "/api/alertas",
        json={"telemetria_id": telemetria.id, "observacion_hse": "x"},
        headers=usuario_trabajador.headers,
    )
    alerta_id = creada.json()["id"]

    await client.patch(f"/api/alertas/{alerta_id}/mutear", json={}, headers=usuario_supervisor.headers)

    respuesta = await client.patch(
        f"/api/alertas/{alerta_id}/escalar", json={}, headers=usuario_supervisor.headers
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "activa"


async def test_resolver_alerta(
    client: AsyncClient, db_session: AsyncSession, usuario_trabajador: UsuarioAutenticado,
    usuario_supervisor: UsuarioAutenticado, estacion_y_punto: EstacionYPunto,
) -> None:
    telemetria = await _crear_telemetria(db_session, estacion_y_punto.punto.id)
    creada = await client.post(
        "/api/alertas",
        json={"telemetria_id": telemetria.id, "observacion_hse": "x"},
        headers=usuario_trabajador.headers,
    )
    alerta_id = creada.json()["id"]

    respuesta = await client.patch(
        f"/api/alertas/{alerta_id}/resolver",
        json={"observacion_hse": "Corregido en sitio"},
        headers=usuario_supervisor.headers,
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "resuelta"


async def test_resolver_alerta_sin_observacion_falla(
    client: AsyncClient, db_session: AsyncSession, usuario_trabajador: UsuarioAutenticado,
    usuario_supervisor: UsuarioAutenticado, estacion_y_punto: EstacionYPunto,
) -> None:
    telemetria = await _crear_telemetria(db_session, estacion_y_punto.punto.id)
    creada = await client.post(
        "/api/alertas",
        json={"telemetria_id": telemetria.id, "observacion_hse": "x"},
        headers=usuario_trabajador.headers,
    )
    alerta_id = creada.json()["id"]

    # AlertaResolver.observacion_hse es obligatorio (min_length=1) -
    # omitirlo (o mandar "") debe fallar la validacion de Pydantic, nunca
    # resolver la alerta sin dejar constancia de que paso.
    sin_campo = await client.patch(
        f"/api/alertas/{alerta_id}/resolver", json={}, headers=usuario_supervisor.headers
    )
    assert sin_campo.status_code == 422

    vacio = await client.patch(
        f"/api/alertas/{alerta_id}/resolver",
        json={"observacion_hse": ""},
        headers=usuario_supervisor.headers,
    )
    assert vacio.status_code == 422


async def test_resolver_alerta_dos_veces_falla(
    client: AsyncClient, db_session: AsyncSession, usuario_trabajador: UsuarioAutenticado,
    usuario_supervisor: UsuarioAutenticado, estacion_y_punto: EstacionYPunto,
) -> None:
    telemetria = await _crear_telemetria(db_session, estacion_y_punto.punto.id)
    creada = await client.post(
        "/api/alertas",
        json={"telemetria_id": telemetria.id, "observacion_hse": "x"},
        headers=usuario_trabajador.headers,
    )
    alerta_id = creada.json()["id"]

    primera = await client.patch(
        f"/api/alertas/{alerta_id}/resolver",
        json={"observacion_hse": "Resuelto"},
        headers=usuario_supervisor.headers,
    )
    assert primera.status_code == 200

    segunda = await client.patch(
        f"/api/alertas/{alerta_id}/resolver",
        json={"observacion_hse": "Otra vez"},
        headers=usuario_supervisor.headers,
    )
    assert segunda.status_code == 409


async def test_mutear_alerta_ya_resuelta_falla(
    client: AsyncClient, db_session: AsyncSession, usuario_trabajador: UsuarioAutenticado,
    usuario_supervisor: UsuarioAutenticado, estacion_y_punto: EstacionYPunto,
) -> None:
    telemetria = await _crear_telemetria(db_session, estacion_y_punto.punto.id)
    creada = await client.post(
        "/api/alertas",
        json={"telemetria_id": telemetria.id, "observacion_hse": "x"},
        headers=usuario_trabajador.headers,
    )
    alerta_id = creada.json()["id"]

    await client.patch(
        f"/api/alertas/{alerta_id}/resolver",
        json={"observacion_hse": "Resuelto"},
        headers=usuario_supervisor.headers,
    )

    respuesta = await client.patch(
        f"/api/alertas/{alerta_id}/mutear", json={}, headers=usuario_supervisor.headers
    )
    assert respuesta.status_code == 409
