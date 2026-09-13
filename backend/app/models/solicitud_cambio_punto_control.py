from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.punto_control import PuntoControl
    from app.models.usuario import Usuario


class TipoSolicitudCambio(str, enum.Enum):
    CREAR = "crear"
    EDITAR = "editar"
    ELIMINAR = "eliminar"


class EstadoSolicitudCambio(str, enum.Enum):
    PENDIENTE = "pendiente"
    APROBADA = "aprobada"
    RECHAZADA = "rechazada"


class SolicitudCambioPuntoControl(Base):
    __tablename__ = "solicitudes_cambio_punto_control"

    id: Mapped[int] = mapped_column(primary_key=True)
    tipo: Mapped[TipoSolicitudCambio] = mapped_column(
        Enum(TipoSolicitudCambio, name="tipo_solicitud_cambio", native_enum=True), nullable=False
    )
    punto_control_id: Mapped[int | None] = mapped_column(
        ForeignKey("puntos_control.id"), nullable=True
    )
    datos_propuestos: Mapped[dict] = mapped_column(JSON, nullable=False)
    estado: Mapped[EstadoSolicitudCambio] = mapped_column(
        Enum(EstadoSolicitudCambio, name="estado_solicitud_cambio", native_enum=True),
        nullable=False,
        default=EstadoSolicitudCambio.PENDIENTE,
    )
    creado_por_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False)
    revisado_por_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    comentario_revision: Mapped[str | None] = mapped_column(Text, nullable=True)
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    fecha_revision: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    punto_control: Mapped["PuntoControl | None"] = relationship(foreign_keys=[punto_control_id])
    creado_por: Mapped["Usuario"] = relationship(foreign_keys=[creado_por_id])
    revisado_por: Mapped["Usuario | None"] = relationship(foreign_keys=[revisado_por_id])
