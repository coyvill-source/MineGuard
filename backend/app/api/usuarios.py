from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import requiere_rol
from app.models.usuario import RolUsuario, Usuario
from app.schemas.usuario import ActualizarRolUsuario, UsuarioRespuesta

router = APIRouter(tags=["usuarios"])


@router.patch("/{usuario_id}/rol", response_model=UsuarioRespuesta)
async def actualizar_rol(
    usuario_id: int,
    datos: ActualizarRolUsuario,
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin_actual: Annotated[Usuario, Depends(requiere_rol(RolUsuario.ADMIN))],
) -> Usuario:
    usuario = await db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    usuario.rol = datos.nuevo_rol
    await db.commit()
    await db.refresh(usuario)
    return usuario
