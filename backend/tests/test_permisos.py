"""Para cada endpoint protegido por rol: el rol insuficiente da 403, el
rol minimo requerido (o superior) funciona."""

from datetime import datetime, timezone

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bitacora_alertas import BitacoraAlertas, EstadoAlerta
from app.models.solicitud_cambio_punto_control import (
    EstadoSolicitudCambio,
    SolicitudCambioPuntoControl,
    TipoSolicitudCambio,
)
from app.models.telemetria import EstadoValidacion, NivelAlerta, Telemetria
from tests.conftest import EstacionYPunto, UsuarioAutenticado


async def _crear_telemetria_y_alerta(db_session: AsyncSession, punto_id: int) -> BitacoraAlertas:
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
    await db_session.flush()

    alerta = BitacoraAlertas(telemetria_id=telemetria.id, estado=EstadoAlerta.ACTIVA)
    db_session.add(alerta)
    await db_session.commit()
    await db_session.refresh(alerta)
    return alerta


async def _crear_solicitud_pendiente(
    db_session: AsyncSession, punto_id: int, creado_por_id: int
) -> SolicitudCambioPuntoControl:
    solicitud = SolicitudCambioPuntoControl(
        tipo=TipoSolicitudCambio.EDITAR,
        punto_control_id=punto_id,
        datos_propuestos={"nombre_estacion": "Nombre propuesto"},
        estado=EstadoSolicitudCambio.PENDIENTE,
        creado_por_id=creado_por_id,
    )
    db_session.add(solicitud)
    await db_session.commit()
    await db_session.refresh(solicitud)
    return solicitud


# --- PATCH /api/usuarios/{id}/rol - admin ---


async def test_actualizar_rol_supervisor_rechazado(
    client: AsyncClient, usuario_supervisor: UsuarioAutenticado, usuario_trabajador: UsuarioAutenticado
) -> None:
    respuesta = await client.patch(
        f"/api/usuarios/{usuario_trabajador.usuario.id}/rol",
        json={"nuevo_rol": "supervisor"},
        headers=usuario_supervisor.headers,
    )
    assert respuesta.status_code == 403


async def test_actualizar_rol_admin_funciona(
    client: AsyncClient, usuario_admin: UsuarioAutenticado, usuario_trabajador: UsuarioAutenticado
) -> None:
    respuesta = await client.patch(
        f"/api/usuarios/{usuario_trabajador.usuario.id}/rol",
        json={"nuevo_rol": "supervisor"},
        headers=usuario_admin.headers,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["rol"] == "supervisor"


# --- CRUD directo de puntos de control - supervisor+ ---


async def test_crear_punto_control_trabajador_rechazado(
    client: AsyncClient, usuario_trabajador: UsuarioAutenticado, estacion_y_punto: EstacionYPunto
) -> None:
    respuesta = await client.post(
        "/api/puntos-control",
        json={
            "estacion_id": estacion_y_punto.estacion.id,
            "nombre_estacion": "Otro punto",
            "coord_x": 1.0, "coord_y": 2.0, "coord_z": 3.0,
        },
        headers=usuario_trabajador.headers,
    )
    assert respuesta.status_code == 403


async def test_crear_punto_control_supervisor_funciona(
    client: AsyncClient, usuario_supervisor: UsuarioAutenticado, estacion_y_punto: EstacionYPunto
) -> None:
    respuesta = await client.post(
        "/api/puntos-control",
        json={
            "estacion_id": estacion_y_punto.estacion.id,
            "nombre_estacion": "Otro punto",
            "coord_x": 1.0, "coord_y": 2.0, "coord_z": 3.0,
        },
        headers=usuario_supervisor.headers,
    )
    assert respuesta.status_code == 201


async def test_actualizar_punto_control_trabajador_rechazado(
    client: AsyncClient, usuario_trabajador: UsuarioAutenticado, estacion_y_punto: EstacionYPunto
) -> None:
    respuesta = await client.patch(
        f"/api/puntos-control/{estacion_y_punto.punto.id}",
        json={"nombre_estacion": "Cambiado"},
        headers=usuario_trabajador.headers,
    )
    assert respuesta.status_code == 403


async def test_actualizar_punto_control_supervisor_funciona(
    client: AsyncClient, usuario_supervisor: UsuarioAutenticado, estacion_y_punto: EstacionYPunto
) -> None:
    respuesta = await client.patch(
        f"/api/puntos-control/{estacion_y_punto.punto.id}",
        json={"nombre_estacion": "Cambiado"},
        headers=usuario_supervisor.headers,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["nombre_estacion"] == "Cambiado"


async def test_eliminar_punto_control_trabajador_rechazado(
    client: AsyncClient, usuario_trabajador: UsuarioAutenticado, estacion_y_punto: EstacionYPunto
) -> None:
    respuesta = await client.delete(
        f"/api/puntos-control/{estacion_y_punto.punto.id}", headers=usuario_trabajador.headers
    )
    assert respuesta.status_code == 403


async def test_eliminar_punto_control_supervisor_funciona(
    client: AsyncClient, usuario_supervisor: UsuarioAutenticado, estacion_y_punto: EstacionYPunto
) -> None:
    respuesta = await client.delete(
        f"/api/puntos-control/{estacion_y_punto.punto.id}", headers=usuario_supervisor.headers
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["activo"] is False


# --- Solicitudes de cambio: listar/aprobar/rechazar - supervisor+ ---


async def test_listar_solicitudes_trabajador_rechazado(
    client: AsyncClient, usuario_trabajador: UsuarioAutenticado
) -> None:
    respuesta = await client.get("/api/puntos-control/solicitudes", headers=usuario_trabajador.headers)
    assert respuesta.status_code == 403


async def test_listar_solicitudes_supervisor_funciona(
    client: AsyncClient, usuario_supervisor: UsuarioAutenticado
) -> None:
    respuesta = await client.get("/api/puntos-control/solicitudes", headers=usuario_supervisor.headers)
    assert respuesta.status_code == 200


async def test_aprobar_solicitud_trabajador_rechazado(
    client: AsyncClient,
    db_session: AsyncSession,
    usuario_trabajador: UsuarioAutenticado,
    estacion_y_punto: EstacionYPunto,
) -> None:
    solicitud = await _crear_solicitud_pendiente(
        db_session, estacion_y_punto.punto.id, usuario_trabajador.usuario.id
    )
    respuesta = await client.patch(
        f"/api/puntos-control/solicitudes/{solicitud.id}/aprobar", headers=usuario_trabajador.headers
    )
    assert respuesta.status_code == 403


async def test_aprobar_solicitud_supervisor_funciona(
    client: AsyncClient,
    db_session: AsyncSession,
    usuario_supervisor: UsuarioAutenticado,
    estacion_y_punto: EstacionYPunto,
) -> None:
    solicitud = await _crear_solicitud_pendiente(
        db_session, estacion_y_punto.punto.id, usuario_supervisor.usuario.id
    )
    respuesta = await client.patch(
        f"/api/puntos-control/solicitudes/{solicitud.id}/aprobar", headers=usuario_supervisor.headers
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "aprobada"


async def test_rechazar_solicitud_trabajador_rechazado(
    client: AsyncClient,
    db_session: AsyncSession,
    usuario_trabajador: UsuarioAutenticado,
    estacion_y_punto: EstacionYPunto,
) -> None:
    solicitud = await _crear_solicitud_pendiente(
        db_session, estacion_y_punto.punto.id, usuario_trabajador.usuario.id
    )
    respuesta = await client.patch(
        f"/api/puntos-control/solicitudes/{solicitud.id}/rechazar",
        json={"comentario": "No procede"},
        headers=usuario_trabajador.headers,
    )
    assert respuesta.status_code == 403


async def test_rechazar_solicitud_supervisor_funciona(
    client: AsyncClient,
    db_session: AsyncSession,
    usuario_supervisor: UsuarioAutenticado,
    estacion_y_punto: EstacionYPunto,
) -> None:
    solicitud = await _crear_solicitud_pendiente(
        db_session, estacion_y_punto.punto.id, usuario_supervisor.usuario.id
    )
    respuesta = await client.patch(
        f"/api/puntos-control/solicitudes/{solicitud.id}/rechazar",
        json={"comentario": "No procede"},
        headers=usuario_supervisor.headers,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "rechazada"


# --- Gestion de alertas: mutear/escalar/resolver - supervisor+ ---


async def test_mutear_alerta_trabajador_rechazado(
    client: AsyncClient, db_session: AsyncSession, usuario_trabajador: UsuarioAutenticado,
    estacion_y_punto: EstacionYPunto,
) -> None:
    alerta = await _crear_telemetria_y_alerta(db_session, estacion_y_punto.punto.id)
    respuesta = await client.patch(
        f"/api/alertas/{alerta.id}/mutear", json={}, headers=usuario_trabajador.headers
    )
    assert respuesta.status_code == 403


async def test_mutear_alerta_supervisor_funciona(
    client: AsyncClient, db_session: AsyncSession, usuario_supervisor: UsuarioAutenticado,
    estacion_y_punto: EstacionYPunto,
) -> None:
    alerta = await _crear_telemetria_y_alerta(db_session, estacion_y_punto.punto.id)
    respuesta = await client.patch(
        f"/api/alertas/{alerta.id}/mutear", json={}, headers=usuario_supervisor.headers
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "muteada"


async def test_escalar_alerta_trabajador_rechazado(
    client: AsyncClient, db_session: AsyncSession, usuario_trabajador: UsuarioAutenticado,
    estacion_y_punto: EstacionYPunto,
) -> None:
    alerta = await _crear_telemetria_y_alerta(db_session, estacion_y_punto.punto.id)
    respuesta = await client.patch(
        f"/api/alertas/{alerta.id}/escalar", json={}, headers=usuario_trabajador.headers
    )
    assert respuesta.status_code == 403


async def test_escalar_alerta_supervisor_funciona(
    client: AsyncClient, db_session: AsyncSession, usuario_supervisor: UsuarioAutenticado,
    estacion_y_punto: EstacionYPunto,
) -> None:
    alerta = await _crear_telemetria_y_alerta(db_session, estacion_y_punto.punto.id)
    respuesta = await client.patch(
        f"/api/alertas/{alerta.id}/escalar", json={}, headers=usuario_supervisor.headers
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "activa"


async def test_resolver_alerta_trabajador_rechazado(
    client: AsyncClient, db_session: AsyncSession, usuario_trabajador: UsuarioAutenticado,
    estacion_y_punto: EstacionYPunto,
) -> None:
    alerta = await _crear_telemetria_y_alerta(db_session, estacion_y_punto.punto.id)
    respuesta = await client.patch(
        f"/api/alertas/{alerta.id}/resolver",
        json={"observacion_hse": "Resuelto"},
        headers=usuario_trabajador.headers,
    )
    assert respuesta.status_code == 403


async def test_resolver_alerta_supervisor_funciona(
    client: AsyncClient, db_session: AsyncSession, usuario_supervisor: UsuarioAutenticado,
    estacion_y_punto: EstacionYPunto,
) -> None:
    alerta = await _crear_telemetria_y_alerta(db_session, estacion_y_punto.punto.id)
    respuesta = await client.patch(
        f"/api/alertas/{alerta.id}/resolver",
        json={"observacion_hse": "Resuelto"},
        headers=usuario_supervisor.headers,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "resuelta"


# --- Generador continuo: iniciar/detener - admin ---


async def test_generador_continuo_iniciar_supervisor_rechazado(
    client: AsyncClient, usuario_supervisor: UsuarioAutenticado
) -> None:
    respuesta = await client.post(
        "/api/telemetria/generador-continuo/iniciar",
        json={"intervalo_segundos": 10},
        headers=usuario_supervisor.headers,
    )
    assert respuesta.status_code == 403


async def test_generador_continuo_iniciar_admin_funciona(
    client: AsyncClient, usuario_admin: UsuarioAutenticado, estacion_y_punto: EstacionYPunto,
    modelo_ml_activo,
) -> None:
    respuesta = await client.post(
        "/api/telemetria/generador-continuo/iniciar",
        json={"intervalo_segundos": 3600},
        headers=usuario_admin.headers,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["corriendo"] is True

    # Limpieza: no dejar la tarea de fondo corriendo entre pruebas.
    await client.post("/api/telemetria/generador-continuo/detener", headers=usuario_admin.headers)


async def test_generador_continuo_detener_supervisor_rechazado(
    client: AsyncClient, usuario_supervisor: UsuarioAutenticado
) -> None:
    respuesta = await client.post(
        "/api/telemetria/generador-continuo/detener", headers=usuario_supervisor.headers
    )
    assert respuesta.status_code == 403
