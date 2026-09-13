from typing import Annotated

from fastapi import Depends, HTTPException, status

from app.api.auth import get_current_user
from app.models.usuario import RolUsuario, Usuario

# Jerarquia de roles: cada uno hereda los permisos del anterior
# (trabajador < supervisor < admin), segun docs/PROJECT_CONTEXT.md.
JERARQUIA_ROLES: dict[RolUsuario, int] = {
    RolUsuario.TRABAJADOR: 0,
    RolUsuario.SUPERVISOR: 1,
    RolUsuario.ADMIN: 2,
}


def requiere_rol(rol_minimo: RolUsuario):
    """Dependencia de FastAPI: exige que el usuario autenticado tenga
    al menos el rol indicado (o uno superior en la jerarquia)."""

    async def verificar_rol(
        usuario_actual: Annotated[Usuario, Depends(get_current_user)],
    ) -> Usuario:
        if JERARQUIA_ROLES[usuario_actual.rol] < JERARQUIA_ROLES[rol_minimo]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Esta accion requiere rol '{rol_minimo.value}' o superior",
            )
        return usuario_actual

    return verificar_rol
