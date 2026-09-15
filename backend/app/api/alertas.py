from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import requiere_rol
from app.models.bitacora_alertas import BitacoraAlertas, EstadoAlerta
from app.models.telemetria import Telemetria
from app.models.usuario import RolUsuario, Usuario
from app.schemas.alerta import (
    AlertaCrear,
    AlertaObservacionOpcional,
    AlertaResolver,
    AlertaRespuesta,
)

router = APIRouter(tags=["alertas"])


async def _obtener_alerta_o_404(db: AsyncSession, alerta_id: int) -> BitacoraAlertas:
    alerta = await db.get(BitacoraAlertas, alerta_id)
    if alerta is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La alerta indicada no existe")
    return alerta


@router.post("", response_model=AlertaRespuesta, status_code=status.HTTP_201_CREATED)
async def crear_alerta(
    datos: AlertaCrear,
    db: Annotated[AsyncSession, Depends(get_db)],
    _actor: Annotated[Usuario, Depends(requiere_rol(RolUsuario.TRABAJADOR))],
) -> BitacoraAlertas:
    telemetria = await db.get(Telemetria, datos.telemetria_id)
    if telemetria is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="La telemetria indicada no existe"
        )

    # Relacion 1 a 1 aplicada a nivel de aplicacion (el modelo/migracion
    # actual NO tiene una constraint UNIQUE en telemetria_id) - ver nota en
    # docs/PROJECT_CONTEXT.md.
    existente = await db.scalar(
        select(BitacoraAlertas).where(BitacoraAlertas.telemetria_id == datos.telemetria_id)
    )
    if existente is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una alerta para esta telemetria",
        )

    alerta = BitacoraAlertas(
        telemetria_id=datos.telemetria_id,
        estado=EstadoAlerta.ACTIVA,
        observacion_hse=datos.observacion_hse,
    )
    db.add(alerta)
    await db.commit()
    await db.refresh(alerta)
    return alerta


@router.get("", response_model=list[AlertaRespuesta])
async def listar_alertas(
    db: Annotated[AsyncSession, Depends(get_db)],
    _actor: Annotated[Usuario, Depends(requiere_rol(RolUsuario.TRABAJADOR))],
    estado: EstadoAlerta | None = None,
) -> list[BitacoraAlertas]:
    consulta = select(BitacoraAlertas)
    if estado is not None:
        consulta = consulta.where(BitacoraAlertas.estado == estado)
    consulta = consulta.order_by(BitacoraAlertas.id.desc())

    resultado = await db.scalars(consulta)
    return list(resultado.all())


@router.get("/{alerta_id}", response_model=AlertaRespuesta)
async def obtener_alerta(
    alerta_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _actor: Annotated[Usuario, Depends(requiere_rol(RolUsuario.TRABAJADOR))],
) -> BitacoraAlertas:
    return await _obtener_alerta_o_404(db, alerta_id)


@router.patch("/{alerta_id}/mutear", response_model=AlertaRespuesta)
async def mutear_alerta(
    alerta_id: int,
    datos: AlertaObservacionOpcional,
    db: Annotated[AsyncSession, Depends(get_db)],
    usuario_actual: Annotated[Usuario, Depends(requiere_rol(RolUsuario.SUPERVISOR))],
) -> BitacoraAlertas:
    alerta = await _obtener_alerta_o_404(db, alerta_id)
    if alerta.estado == EstadoAlerta.RESUELTA:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="La alerta ya esta resuelta, no se puede mutear"
        )

    alerta.estado = EstadoAlerta.MUTEADA
    if datos.observacion_hse is not None:
        alerta.observacion_hse = datos.observacion_hse
    alerta.usuario_resolutor_id = usuario_actual.id
    alerta.fecha_actualizacion = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(alerta)
    return alerta


@router.patch("/{alerta_id}/escalar", response_model=AlertaRespuesta)
async def escalar_alerta(
    alerta_id: int,
    datos: AlertaObservacionOpcional,
    db: Annotated[AsyncSession, Depends(get_db)],
    usuario_actual: Annotated[Usuario, Depends(requiere_rol(RolUsuario.SUPERVISOR))],
) -> BitacoraAlertas:
    alerta = await _obtener_alerta_o_404(db, alerta_id)
    if alerta.estado == EstadoAlerta.RESUELTA:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="La alerta ya esta resuelta, no se puede escalar"
        )

    # ACTIVA si estaba MUTEADA (reactivar), o simplemente deja constancia si
    # ya estaba ACTIVA.
    alerta.estado = EstadoAlerta.ACTIVA
    if datos.observacion_hse is not None:
        alerta.observacion_hse = datos.observacion_hse
    alerta.usuario_resolutor_id = usuario_actual.id
    alerta.fecha_actualizacion = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(alerta)
    return alerta


@router.patch("/{alerta_id}/resolver", response_model=AlertaRespuesta)
async def resolver_alerta(
    alerta_id: int,
    datos: AlertaResolver,
    db: Annotated[AsyncSession, Depends(get_db)],
    usuario_actual: Annotated[Usuario, Depends(requiere_rol(RolUsuario.SUPERVISOR))],
) -> BitacoraAlertas:
    alerta = await _obtener_alerta_o_404(db, alerta_id)
    if alerta.estado == EstadoAlerta.RESUELTA:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La alerta ya esta resuelta")

    alerta.estado = EstadoAlerta.RESUELTA
    alerta.observacion_hse = datos.observacion_hse
    alerta.usuario_resolutor_id = usuario_actual.id
    alerta.fecha_actualizacion = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(alerta)
    return alerta
