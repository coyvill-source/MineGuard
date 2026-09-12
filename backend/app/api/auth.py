from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.models.usuario import MetodoRegistro, Usuario
from app.schemas.usuario import TokenRespuesta, UsuarioLogin, UsuarioRegistro, UsuarioRespuesta

router = APIRouter(tags=["auth"])

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

    usuario = await db.get(Usuario, int(usuario_id))
    if usuario is None:
        raise credentials_exception

    return usuario


@router.post("/register", response_model=UsuarioRespuesta, status_code=status.HTTP_201_CREATED)
async def register(datos: UsuarioRegistro, db: Annotated[AsyncSession, Depends(get_db)]) -> Usuario:
    existente = await db.scalar(select(Usuario).where(Usuario.email == datos.email))
    if existente is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El email ya esta registrado")

    usuario = Usuario(
        email=datos.email,
        rol=datos.rol,
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
