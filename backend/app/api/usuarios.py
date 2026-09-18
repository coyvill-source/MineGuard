from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import requiere_rol
from app.models.usuario import RolUsuario, Usuario
from app.schemas.usuario import ActualizarRolUsuario, UsuarioAdminRespuesta, UsuarioRespuesta

router = APIRouter(tags=["usuarios"])


@router.get("", response_model=list[UsuarioAdminRespuesta])
async def listar_usuarios(
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin_actual: Annotated[Usuario, Depends(requiere_rol(RolUsuario.ADMIN))],
) -> list[Usuario]:
    resultado = await db.scalars(select(Usuario).order_by(Usuario.id))
    return list(resultado.all())


@router.patch("/{usuario_id}/rol", response_model=UsuarioRespuesta)
async def actualizar_rol(
    usuario_id: int,
    datos: ActualizarRolUsuario,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin_actual: Annotated[Usuario, Depends(requiere_rol(RolUsuario.ADMIN))],
) -> Usuario:
    # DECISION: un Administrador no puede cambiar su propio rol - debe
    # pedirle a otro administrador que lo haga (evita que se autodegrade y
    # pierda acceso a esta misma pantalla, o que se quede como el unico
    # admin y luego se bloquee a si mismo sin nadie mas que pueda revertirlo).
    # Se valida antes de tocar la BD, comparando contra el usuario ya
    # autenticado por requiere_rol (no hace falta una consulta aparte).
    if usuario_id == admin_actual.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes cambiar tu propio rol, pídele a otro administrador que lo haga.",
        )

    usuario = await db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    usuario.rol = datos.nuevo_rol
    await db.commit()
    await db.refresh(usuario)
    return usuario
