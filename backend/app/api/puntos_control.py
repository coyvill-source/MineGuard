from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.api.auth import get_current_user
from app.core.database import get_db
from app.core.permissions import requiere_rol
from app.models.estacion import Estacion
from app.models.punto_control import PuntoControl
from app.models.solicitud_cambio_punto_control import (
    EstadoSolicitudCambio,
    SolicitudCambioPuntoControl,
    TipoSolicitudCambio,
)
from app.models.telemetria import Telemetria
from app.models.usuario import RolUsuario, Usuario
from app.schemas.punto_control import (
    PuntoControlActualizar,
    PuntoControlCrear,
    PuntoControlEstadoActual,
    PuntoControlRespuesta,
    SolicitudCambioCrear,
    SolicitudCambioRechazo,
    SolicitudCambioRespuesta,
    UltimaLecturaTelemetria,
)

router = APIRouter(tags=["puntos-control"])


# Las rutas literales bajo /solicitudes deben declararse antes de /{punto_control_id}:
# FastAPI/Starlette hace matching de rutas en orden de declaracion, y "solicitudes"
# calzaria como valor de {punto_control_id} (fallando la conversion a int) si el
# patron generico se declarara primero.


@router.post("/solicitudes", response_model=SolicitudCambioRespuesta, status_code=status.HTTP_201_CREATED)
async def crear_solicitud_cambio(
    datos: SolicitudCambioCrear,
    db: Annotated[AsyncSession, Depends(get_db)],
    usuario_actual: Annotated[Usuario, Depends(get_current_user)],
) -> SolicitudCambioPuntoControl:
    if datos.punto_control_id is not None:
        punto_control = await db.get(PuntoControl, datos.punto_control_id)
        if punto_control is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="El punto de control indicado no existe"
            )

    solicitud = SolicitudCambioPuntoControl(
        tipo=datos.tipo,
        punto_control_id=datos.punto_control_id,
        datos_propuestos=datos.datos_propuestos.model_dump(exclude_none=True),
        estado=EstadoSolicitudCambio.PENDIENTE,
        creado_por_id=usuario_actual.id,
    )
    db.add(solicitud)
    await db.commit()
    await db.refresh(solicitud)
    return solicitud


@router.get("/solicitudes", response_model=list[SolicitudCambioRespuesta])
async def listar_solicitudes_cambio(
    db: Annotated[AsyncSession, Depends(get_db)],
    _actor: Annotated[Usuario, Depends(requiere_rol(RolUsuario.SUPERVISOR))],
    estado: EstadoSolicitudCambio | None = None,
) -> list[SolicitudCambioPuntoControl]:
    consulta = select(SolicitudCambioPuntoControl)
    if estado is not None:
        consulta = consulta.where(SolicitudCambioPuntoControl.estado == estado)
    consulta = consulta.order_by(SolicitudCambioPuntoControl.fecha_creacion.desc())

    resultado = await db.scalars(consulta)
    return list(resultado.all())


@router.patch("/solicitudes/{solicitud_id}/aprobar", response_model=SolicitudCambioRespuesta)
async def aprobar_solicitud_cambio(
    solicitud_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    usuario_actual: Annotated[Usuario, Depends(requiere_rol(RolUsuario.SUPERVISOR))],
) -> SolicitudCambioPuntoControl:
    solicitud = await db.get(SolicitudCambioPuntoControl, solicitud_id)
    if solicitud is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La solicitud indicada no existe")
    if solicitud.estado != EstadoSolicitudCambio.PENDIENTE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La solicitud ya fue revisada (estado actual: {solicitud.estado.value})",
        )

    datos = solicitud.datos_propuestos

    if solicitud.tipo == TipoSolicitudCambio.CREAR:
        estacion = await db.get(Estacion, datos["estacion_id"])
        if estacion is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La estacion_id propuesta ya no existe, no se puede aplicar la solicitud",
            )
        db.add(
            PuntoControl(
                estacion_id=datos["estacion_id"],
                nombre_estacion=datos["nombre_estacion"],
                coord_x=datos["coord_x"],
                coord_y=datos["coord_y"],
                coord_z=datos["coord_z"],
            )
        )
    else:
        punto_control = await db.get(PuntoControl, solicitud.punto_control_id)
        if punto_control is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El punto de control de la solicitud ya no existe, no se puede aplicar",
            )

        if solicitud.tipo == TipoSolicitudCambio.EDITAR:
            for campo, valor in datos.items():
                setattr(punto_control, campo, valor)
        else:  # ELIMINAR
            punto_control.activo = False

    solicitud.estado = EstadoSolicitudCambio.APROBADA
    solicitud.revisado_por_id = usuario_actual.id
    solicitud.fecha_revision = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(solicitud)
    return solicitud


@router.patch("/solicitudes/{solicitud_id}/rechazar", response_model=SolicitudCambioRespuesta)
async def rechazar_solicitud_cambio(
    solicitud_id: int,
    datos: SolicitudCambioRechazo,
    db: Annotated[AsyncSession, Depends(get_db)],
    usuario_actual: Annotated[Usuario, Depends(requiere_rol(RolUsuario.SUPERVISOR))],
) -> SolicitudCambioPuntoControl:
    solicitud = await db.get(SolicitudCambioPuntoControl, solicitud_id)
    if solicitud is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La solicitud indicada no existe")
    if solicitud.estado != EstadoSolicitudCambio.PENDIENTE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La solicitud ya fue revisada (estado actual: {solicitud.estado.value})",
        )

    solicitud.estado = EstadoSolicitudCambio.RECHAZADA
    solicitud.comentario_revision = datos.comentario
    solicitud.revisado_por_id = usuario_actual.id
    solicitud.fecha_revision = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(solicitud)
    return solicitud


@router.get("", response_model=list[PuntoControlRespuesta])
async def listar_puntos_control(
    db: Annotated[AsyncSession, Depends(get_db)],
    _actor: Annotated[Usuario, Depends(requiere_rol(RolUsuario.TRABAJADOR))],
) -> list[PuntoControl]:
    resultado = await db.scalars(select(PuntoControl).order_by(PuntoControl.id))
    return list(resultado.all())


@router.post("", response_model=PuntoControlRespuesta, status_code=status.HTTP_201_CREATED)
async def crear_punto_control(
    datos: PuntoControlCrear,
    db: Annotated[AsyncSession, Depends(get_db)],
    _actor: Annotated[Usuario, Depends(requiere_rol(RolUsuario.SUPERVISOR))],
) -> PuntoControl:
    estacion = await db.get(Estacion, datos.estacion_id)
    if estacion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La estacion indicada no existe")

    punto_control = PuntoControl(**datos.model_dump())
    db.add(punto_control)
    await db.commit()
    await db.refresh(punto_control)
    return punto_control


@router.get("/estado-actual", response_model=list[PuntoControlEstadoActual])
async def obtener_estado_actual(
    db: Annotated[AsyncSession, Depends(get_db)],
    _actor: Annotated[Usuario, Depends(requiere_rol(RolUsuario.TRABAJADOR))],
) -> list[PuntoControlEstadoActual]:
    # DISTINCT ON (punto_id), ordenado por timestamp descendente: trae la
    # lectura mas reciente de cada punto en UNA sola consulta a la BD (sin
    # loop por punto). Declarada antes de /{punto_control_id} por la misma
    # razon que /solicitudes: Starlette haria matching de "estado-actual"
    # como valor de {punto_control_id} si el patron generico fuera primero.
    ultima_por_punto = (
        select(Telemetria)
        .distinct(Telemetria.punto_id)
        .order_by(Telemetria.punto_id, Telemetria.timestamp.desc())
    ).subquery()
    ultima_telemetria = aliased(Telemetria, ultima_por_punto)

    consulta = (
        select(PuntoControl, ultima_telemetria)
        .outerjoin(ultima_telemetria, ultima_telemetria.punto_id == PuntoControl.id)
        .where(PuntoControl.activo.is_(True))
        .order_by(PuntoControl.id)
    )

    resultado = await db.execute(consulta)

    return [
        PuntoControlEstadoActual(
            id=punto.id,
            estacion_id=punto.estacion_id,
            nombre_estacion=punto.nombre_estacion,
            estacion_nombre=punto.estacion_nombre,
            coord_x=punto.coord_x,
            coord_y=punto.coord_y,
            coord_z=punto.coord_z,
            ultima_lectura=(
                UltimaLecturaTelemetria.model_validate(lectura) if lectura is not None else None
            ),
        )
        for punto, lectura in resultado.all()
    ]


@router.get("/{punto_control_id}", response_model=PuntoControlRespuesta)
async def obtener_punto_control(
    punto_control_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _actor: Annotated[Usuario, Depends(requiere_rol(RolUsuario.TRABAJADOR))],
) -> PuntoControl:
    punto_control = await db.get(PuntoControl, punto_control_id)
    if punto_control is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="El punto de control indicado no existe"
        )
    return punto_control


@router.patch("/{punto_control_id}", response_model=PuntoControlRespuesta)
async def actualizar_punto_control(
    punto_control_id: int,
    datos: PuntoControlActualizar,
    db: Annotated[AsyncSession, Depends(get_db)],
    _actor: Annotated[Usuario, Depends(requiere_rol(RolUsuario.SUPERVISOR))],
) -> PuntoControl:
    punto_control = await db.get(PuntoControl, punto_control_id)
    if punto_control is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="El punto de control indicado no existe"
        )

    cambios = datos.model_dump(exclude_none=True)
    if "estacion_id" in cambios:
        estacion = await db.get(Estacion, cambios["estacion_id"])
        if estacion is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La estacion indicada no existe")

    for campo, valor in cambios.items():
        setattr(punto_control, campo, valor)

    await db.commit()
    await db.refresh(punto_control)
    return punto_control


@router.delete("/{punto_control_id}", response_model=PuntoControlRespuesta)
async def eliminar_punto_control(
    punto_control_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _actor: Annotated[Usuario, Depends(requiere_rol(RolUsuario.SUPERVISOR))],
) -> PuntoControl:
    punto_control = await db.get(PuntoControl, punto_control_id)
    if punto_control is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="El punto de control indicado no existe"
        )

    # Soft-delete: nunca se borra la fila, solo se marca inactivo (ya existe
    # el campo `activo` en el modelo PuntoControl).
    punto_control.activo = False

    await db.commit()
    await db.refresh(punto_control)
    return punto_control
