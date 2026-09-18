"""Pruebas de autenticación por correo/contraseña: registro, login, /me,
forgot-password + reset-password."""

from datetime import timedelta

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.password_reset_token import PasswordResetToken
from tests.conftest import PASSWORD_PRUEBA, UsuarioAutenticado, ahora

DATOS_REGISTRO_BASE = {
    "email": "nuevo.usuario@example.com",
    "password": "ClaveSegura123",
    "nombre": "Ana",
    "apellidos": "Perez",
    "telefono": "3001234567",
    "tipo_documento": "CC",
    "numero_documento": "1000000001",
}


async def test_registro_exitoso(client: AsyncClient) -> None:
    respuesta = await client.post("/api/auth/register", json=DATOS_REGISTRO_BASE)

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["email"] == DATOS_REGISTRO_BASE["email"]
    assert cuerpo["rol"] == "trabajador"
    assert "password" not in cuerpo
    assert "password_hash" not in cuerpo


async def test_registro_rol_enviado_por_cliente_se_ignora(client: AsyncClient) -> None:
    # El schema UsuarioRegistro ni siquiera acepta un campo "rol", pero se
    # verifica explicitamente que enviarlo (Pydantic simplemente lo ignora,
    # extra="ignore" no esta configurado pero BaseModel por defecto tambien
    # ignora campos no declarados salvo que se prohiba) no cambia el rol
    # resultante - sigue siendo trabajador, la regla de seguridad de
    # auth.py (rol=RolUsuario.TRABAJADOR fijo) es lo que manda.
    datos = {**DATOS_REGISTRO_BASE, "email": "otro@example.com", "numero_documento": "1000000002", "rol": "admin"}
    respuesta = await client.post("/api/auth/register", json=datos)

    assert respuesta.status_code == 201
    assert respuesta.json()["rol"] == "trabajador"


async def test_registro_email_duplicado(client: AsyncClient) -> None:
    primera = await client.post("/api/auth/register", json=DATOS_REGISTRO_BASE)
    assert primera.status_code == 201

    duplicado = {**DATOS_REGISTRO_BASE, "numero_documento": "1000000099"}
    segunda = await client.post("/api/auth/register", json=duplicado)

    assert segunda.status_code == 409
    assert "email" in segunda.json()["detail"].lower()


async def test_registro_documento_duplicado(client: AsyncClient) -> None:
    primera = await client.post("/api/auth/register", json=DATOS_REGISTRO_BASE)
    assert primera.status_code == 201

    duplicado = {**DATOS_REGISTRO_BASE, "email": "otro.email@example.com"}
    segunda = await client.post("/api/auth/register", json=duplicado)

    assert segunda.status_code == 409
    assert "documento" in segunda.json()["detail"].lower()


async def test_login_exitoso(client: AsyncClient) -> None:
    await client.post("/api/auth/register", json=DATOS_REGISTRO_BASE)

    respuesta = await client.post(
        "/api/auth/login",
        json={"email": DATOS_REGISTRO_BASE["email"], "password": DATOS_REGISTRO_BASE["password"]},
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["token_type"] == "bearer"
    assert len(cuerpo["access_token"]) > 20


async def test_login_password_incorrecta(client: AsyncClient) -> None:
    await client.post("/api/auth/register", json=DATOS_REGISTRO_BASE)

    respuesta = await client.post(
        "/api/auth/login",
        json={"email": DATOS_REGISTRO_BASE["email"], "password": "clave-incorrecta"},
    )

    assert respuesta.status_code == 401


async def test_login_email_inexistente(client: AsyncClient) -> None:
    respuesta = await client.post(
        "/api/auth/login", json={"email": "no.existe@example.com", "password": "loquesea123"}
    )

    assert respuesta.status_code == 401


async def test_me_con_token_valido(client: AsyncClient, usuario_trabajador: UsuarioAutenticado) -> None:
    respuesta = await client.get("/api/auth/me", headers=usuario_trabajador.headers)

    assert respuesta.status_code == 200
    assert respuesta.json()["email"] == usuario_trabajador.usuario.email


async def test_me_sin_token(client: AsyncClient) -> None:
    respuesta = await client.get("/api/auth/me")

    assert respuesta.status_code in (401, 403)  # HTTPBearer sin credenciales -> 403 en FastAPI/Starlette


async def test_me_con_token_invalido(client: AsyncClient) -> None:
    respuesta = await client.get("/api/auth/me", headers={"Authorization": "Bearer token-invalido"})

    assert respuesta.status_code == 401


async def test_ciclo_completo_forgot_password_reset_password(
    client: AsyncClient, db_session: AsyncSession, usuario_trabajador: UsuarioAutenticado
) -> None:
    respuesta_forgot = await client.post(
        "/api/auth/forgot-password", json={"email": usuario_trabajador.usuario.email}
    )
    assert respuesta_forgot.status_code == 200

    # El endpoint nunca devuelve el token (solo lo "envia" por consola) -
    # se lee directo de la BD, como haria el link del correo real.
    token_row = await db_session.scalar(
        select(PasswordResetToken).where(PasswordResetToken.usuario_id == usuario_trabajador.usuario.id)
    )
    assert token_row is not None
    assert token_row.usado is False

    nueva_password = "OtraClaveNueva456"
    respuesta_reset = await client.post(
        "/api/auth/reset-password",
        json={"token": token_row.token, "nueva_password": nueva_password},
    )
    assert respuesta_reset.status_code == 200

    # El login viejo ya no debe funcionar, el nuevo si.
    login_viejo = await client.post(
        "/api/auth/login",
        json={"email": usuario_trabajador.usuario.email, "password": PASSWORD_PRUEBA},
    )
    assert login_viejo.status_code == 401

    login_nuevo = await client.post(
        "/api/auth/login",
        json={"email": usuario_trabajador.usuario.email, "password": nueva_password},
    )
    assert login_nuevo.status_code == 200


async def test_forgot_password_email_inexistente_no_revela_nada(client: AsyncClient) -> None:
    # Por seguridad, el mensaje debe ser el mismo exista o no el email (no
    # se debe poder usar este endpoint para enumerar cuentas registradas).
    respuesta = await client.post("/api/auth/forgot-password", json={"email": "no.existe@example.com"})

    assert respuesta.status_code == 200
    assert "existe" in respuesta.json()["mensaje"].lower()


async def test_reset_password_token_inexistente(client: AsyncClient) -> None:
    respuesta = await client.post(
        "/api/auth/reset-password", json={"token": "token-que-no-existe", "nueva_password": "ClaveNueva123"}
    )

    assert respuesta.status_code == 400


async def test_reset_password_token_expirado(
    client: AsyncClient, db_session: AsyncSession, usuario_trabajador: UsuarioAutenticado
) -> None:
    token_expirado = PasswordResetToken(
        usuario_id=usuario_trabajador.usuario.id,
        token="token-ya-expirado-de-prueba",
        fecha_expiracion=ahora() - timedelta(minutes=5),
        usado=False,
    )
    db_session.add(token_expirado)
    await db_session.commit()

    respuesta = await client.post(
        "/api/auth/reset-password",
        json={"token": "token-ya-expirado-de-prueba", "nueva_password": "ClaveNueva123"},
    )

    assert respuesta.status_code == 400


async def test_reset_password_token_ya_usado(
    client: AsyncClient, db_session: AsyncSession, usuario_trabajador: UsuarioAutenticado
) -> None:
    token_usado = PasswordResetToken(
        usuario_id=usuario_trabajador.usuario.id,
        token="token-ya-usado-de-prueba",
        fecha_expiracion=ahora() + timedelta(minutes=30),
        usado=True,
    )
    db_session.add(token_usado)
    await db_session.commit()

    respuesta = await client.post(
        "/api/auth/reset-password",
        json={"token": "token-ya-usado-de-prueba", "nueva_password": "ClaveNueva123"},
    )

    assert respuesta.status_code == 400
