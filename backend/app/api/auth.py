import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.models.password_reset_token import PasswordResetToken
from app.models.usuario import MetodoRegistro, RolUsuario, Usuario
from app.schemas.usuario import (
    MensajeRespuesta,
    RestablecerPassword,
    SolicitudRecuperacion,
    TokenRespuesta,
    UsuarioLogin,
    UsuarioRegistro,
    UsuarioRespuesta,
)

router = APIRouter(tags=["auth"])

RESET_TOKEN_EXPIRE_MINUTES = 30
MENSAJE_RECUPERACION = "Si el correo existe, recibiras instrucciones para restablecer tu contrasena"

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Usuario:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(credentials.credentials)
    except ValueError:
        raise credentials_exception

    usuario_id = payload.get("sub")
    if usuario_id is None:
        raise credentials_exception

    try:
        usuario = await db.get(Usuario, int(usuario_id))
    except (ValueError, TypeError):
        # Un token sin un `sub` numerico de Usuario (ej. el `registro_token`
        # temporal de Google, que no lleva `sub`) nunca debe autenticar -
        # ver DECISION en docs/PROJECT_CONTEXT.md sobre el flujo de Google.
        raise credentials_exception
    if usuario is None:
        raise credentials_exception

    return usuario


@router.post("/register", response_model=UsuarioRespuesta, status_code=status.HTTP_201_CREATED)
async def register(datos: UsuarioRegistro, db: Annotated[AsyncSession, Depends(get_db)]) -> Usuario:
    existente = await db.scalar(select(Usuario).where(Usuario.email == datos.email))
    if existente is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El email ya esta registrado")

    documento_existente = await db.scalar(
        select(Usuario).where(Usuario.numero_documento == datos.numero_documento)
    )
    if documento_existente is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="El numero de documento ya esta registrado"
        )

    usuario = Usuario(
        email=datos.email,
        nombre=datos.nombre,
        apellidos=datos.apellidos,
        telefono=datos.telefono,
        tipo_documento=datos.tipo_documento,
        numero_documento=datos.numero_documento,
        # El rol nunca se acepta del cliente por seguridad: todo registro publico
        # entra como trabajador (ver decision en docs/PROJECT_CONTEXT.md).
        rol=RolUsuario.TRABAJADOR,
        password_hash=hash_password(datos.password),
        metodo_registro=MetodoRegistro.PASSWORD,
    )
    db.add(usuario)
    await db.commit()
    await db.refresh(usuario)
    return usuario


@router.post("/login", response_model=TokenRespuesta)
async def login(datos: UsuarioLogin, db: Annotated[AsyncSession, Depends(get_db)]) -> TokenRespuesta:
    credenciales_invalidas = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Email o contrasena incorrectos",
    )

    usuario = await db.scalar(select(Usuario).where(Usuario.email == datos.email))
    if usuario is None or usuario.password_hash is None:
        raise credenciales_invalidas

    if not verify_password(datos.password, usuario.password_hash):
        raise credenciales_invalidas

    usuario.ultimo_acceso = datetime.now(timezone.utc)
    await db.commit()

    access_token = create_access_token(data={"sub": str(usuario.id)})
    return TokenRespuesta(access_token=access_token)


@router.get("/me", response_model=UsuarioRespuesta)
async def me(usuario_actual: Annotated[Usuario, Depends(get_current_user)]) -> Usuario:
    return usuario_actual


@router.post("/forgot-password", response_model=MensajeRespuesta)
async def forgot_password(
    datos: SolicitudRecuperacion, db: Annotated[AsyncSession, Depends(get_db)]
) -> MensajeRespuesta:
    usuario = await db.scalar(select(Usuario).where(Usuario.email == datos.email))

    if usuario is not None:
        token = secrets.token_urlsafe(32)
        expiracion = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)

        db.add(PasswordResetToken(usuario_id=usuario.id, token=token, fecha_expiracion=expiracion))
        await db.commit()

        link = f"http://localhost:5173/reset-password?token={token}"
        print(f"[forgot-password] Enlace de recuperacion para {usuario.email}: {link}")

    return MensajeRespuesta(mensaje=MENSAJE_RECUPERACION)


@router.post("/reset-password", response_model=MensajeRespuesta)
async def reset_password(
    datos: RestablecerPassword, db: Annotated[AsyncSession, Depends(get_db)]
) -> MensajeRespuesta:
    enlace_invalido = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="El enlace es invalido o ha expirado",
    )

    reset_token = await db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token == datos.token)
    )
    if reset_token is None or reset_token.usado:
        raise enlace_invalido

    if reset_token.fecha_expiracion < datetime.now(timezone.utc):
        raise enlace_invalido

    usuario = await db.get(Usuario, reset_token.usuario_id)
    if usuario is None:
        raise enlace_invalido

    usuario.password_hash = hash_password(datos.nueva_password)
    reset_token.usado = True
    await db.commit()

    return MensajeRespuesta(mensaje="Contrasena actualizada correctamente")
