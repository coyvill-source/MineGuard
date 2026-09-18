"""CRUD directo de puntos de control, flujo de solicitud/aprobación/
rechazo, y soft-delete."""

from httpx import AsyncClient

from tests.conftest import EstacionYPunto, UsuarioAutenticado


async def test_listar_puntos_control(
    client: AsyncClient, usuario_trabajador: UsuarioAutenticado, estacion_y_punto: EstacionYPunto
) -> None:
    respuesta = await client.get("/api/puntos-control", headers=usuario_trabajador.headers)

    assert respuesta.status_code == 200
    ids = [p["id"] for p in respuesta.json()]
    assert estacion_y_punto.punto.id in ids


async def test_crud_directo_actualiza_campos_reales(
    client: AsyncClient, usuario_supervisor: UsuarioAutenticado, estacion_y_punto: EstacionYPunto
) -> None:
    respuesta = await client.patch(
        f"/api/puntos-control/{estacion_y_punto.punto.id}",
        json={"coord_x": 9999.0, "nombre_estacion": "Renombrado"},
        headers=usuario_supervisor.headers,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["coord_x"] == 9999.0
    assert cuerpo["nombre_estacion"] == "Renombrado"
    # Los campos no enviados no deben cambiar.
    assert cuerpo["coord_y"] == estacion_y_punto.punto.coord_y


async def test_soft_delete_no_borra_la_fila(
    client: AsyncClient,
    usuario_supervisor: UsuarioAutenticado,
    estacion_y_punto: EstacionYPunto,
) -> None:
    respuesta = await client.delete(
        f"/api/puntos-control/{estacion_y_punto.punto.id}", headers=usuario_supervisor.headers
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["activo"] is False

    # La fila sigue existiendo (GET directo por id sigue encontrandola).
    directo = await client.get(
        f"/api/puntos-control/{estacion_y_punto.punto.id}", headers=usuario_supervisor.headers
    )
    assert directo.status_code == 200
    assert directo.json()["activo"] is False

    # Pero /estado-actual (que filtra activo=True) ya no la incluye.
    estado_actual = await client.get("/api/puntos-control/estado-actual", headers=usuario_supervisor.headers)
    ids_estado_actual = [p["id"] for p in estado_actual.json()]
    assert estacion_y_punto.punto.id not in ids_estado_actual


# --- Flujo de solicitud / aprobacion / rechazo ---


async def test_solicitud_crear_aprobada_crea_el_punto_real(
    client: AsyncClient,
    usuario_trabajador: UsuarioAutenticado,
    usuario_supervisor: UsuarioAutenticado,
    estacion_y_punto: EstacionYPunto,
) -> None:
    solicitud_resp = await client.post(
        "/api/puntos-control/solicitudes",
        json={
            "tipo": "crear",
            "datos_propuestos": {
                "estacion_id": estacion_y_punto.estacion.id,
                "nombre_estacion": "Punto nuevo por solicitud",
                "coord_x": 111.0, "coord_y": 222.0, "coord_z": 333.0,
            },
        },
        headers=usuario_trabajador.headers,
    )
    assert solicitud_resp.status_code == 201
    solicitud_id = solicitud_resp.json()["id"]
    assert solicitud_resp.json()["estado"] == "pendiente"

    antes = await client.get("/api/puntos-control", headers=usuario_supervisor.headers)
    ids_antes = {p["id"] for p in antes.json()}

    aprobar_resp = await client.patch(
        f"/api/puntos-control/solicitudes/{solicitud_id}/aprobar", headers=usuario_supervisor.headers
    )
    assert aprobar_resp.status_code == 200
    assert aprobar_resp.json()["estado"] == "aprobada"

    despues = await client.get("/api/puntos-control", headers=usuario_supervisor.headers)
    puntos_nuevos = [p for p in despues.json() if p["id"] not in ids_antes]
    assert len(puntos_nuevos) == 1
    assert puntos_nuevos[0]["nombre_estacion"] == "Punto nuevo por solicitud"
    assert puntos_nuevos[0]["coord_x"] == 111.0


async def test_solicitud_editar_aprobada_aplica_el_cambio(
    client: AsyncClient,
    usuario_trabajador: UsuarioAutenticado,
    usuario_supervisor: UsuarioAutenticado,
    estacion_y_punto: EstacionYPunto,
) -> None:
    solicitud_resp = await client.post(
        "/api/puntos-control/solicitudes",
        json={
            "tipo": "editar",
            "punto_control_id": estacion_y_punto.punto.id,
            "datos_propuestos": {"nombre_estacion": "Editado via solicitud"},
        },
        headers=usuario_trabajador.headers,
    )
    assert solicitud_resp.status_code == 201

    await client.patch(
        f"/api/puntos-control/solicitudes/{solicitud_resp.json()['id']}/aprobar",
        headers=usuario_supervisor.headers,
    )

    punto_actualizado = await client.get(
        f"/api/puntos-control/{estacion_y_punto.punto.id}", headers=usuario_supervisor.headers
    )
    assert punto_actualizado.json()["nombre_estacion"] == "Editado via solicitud"


async def test_solicitud_eliminar_aprobada_hace_soft_delete(
    client: AsyncClient,
    usuario_trabajador: UsuarioAutenticado,
    usuario_supervisor: UsuarioAutenticado,
    estacion_y_punto: EstacionYPunto,
) -> None:
    solicitud_resp = await client.post(
        "/api/puntos-control/solicitudes",
        json={"tipo": "eliminar", "punto_control_id": estacion_y_punto.punto.id},
        headers=usuario_trabajador.headers,
    )
    assert solicitud_resp.status_code == 201

    await client.patch(
        f"/api/puntos-control/solicitudes/{solicitud_resp.json()['id']}/aprobar",
        headers=usuario_supervisor.headers,
    )

    punto = await client.get(
        f"/api/puntos-control/{estacion_y_punto.punto.id}", headers=usuario_supervisor.headers
    )
    assert punto.json()["activo"] is False


async def test_solicitud_rechazada_no_aplica_el_cambio(
    client: AsyncClient,
    usuario_trabajador: UsuarioAutenticado,
    usuario_supervisor: UsuarioAutenticado,
    estacion_y_punto: EstacionYPunto,
) -> None:
    nombre_original = estacion_y_punto.punto.nombre_estacion

    solicitud_resp = await client.post(
        "/api/puntos-control/solicitudes",
        json={
            "tipo": "editar",
            "punto_control_id": estacion_y_punto.punto.id,
            "datos_propuestos": {"nombre_estacion": "No deberia aplicarse"},
        },
        headers=usuario_trabajador.headers,
    )
    solicitud_id = solicitud_resp.json()["id"]

    rechazo_resp = await client.patch(
        f"/api/puntos-control/solicitudes/{solicitud_id}/rechazar",
        json={"comentario": "Coordenadas no verificadas"},
        headers=usuario_supervisor.headers,
    )
    assert rechazo_resp.status_code == 200
    assert rechazo_resp.json()["estado"] == "rechazada"
    assert rechazo_resp.json()["comentario_revision"] == "Coordenadas no verificadas"

    punto_sin_cambios = await client.get(
        f"/api/puntos-control/{estacion_y_punto.punto.id}", headers=usuario_supervisor.headers
    )
    assert punto_sin_cambios.json()["nombre_estacion"] == nombre_original


async def test_solicitud_ya_revisada_no_se_puede_volver_a_aprobar(
    client: AsyncClient,
    usuario_trabajador: UsuarioAutenticado,
    usuario_supervisor: UsuarioAutenticado,
    estacion_y_punto: EstacionYPunto,
) -> None:
    solicitud_resp = await client.post(
        "/api/puntos-control/solicitudes",
        json={
            "tipo": "editar",
            "punto_control_id": estacion_y_punto.punto.id,
            "datos_propuestos": {"nombre_estacion": "Primera aprobacion"},
        },
        headers=usuario_trabajador.headers,
    )
    solicitud_id = solicitud_resp.json()["id"]

    primera = await client.patch(
        f"/api/puntos-control/solicitudes/{solicitud_id}/aprobar", headers=usuario_supervisor.headers
    )
    assert primera.status_code == 200

    segunda = await client.patch(
        f"/api/puntos-control/solicitudes/{solicitud_id}/aprobar", headers=usuario_supervisor.headers
    )
    assert segunda.status_code == 409
