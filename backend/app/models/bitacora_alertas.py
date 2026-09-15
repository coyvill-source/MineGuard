from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.telemetria import Telemetria
    from app.models.usuario import Usuario


class EstadoAlerta(str, enum.Enum):
    ACTIVA = "activa"
    MUTEADA = "muteada"
    RESUELTA = "resuelta"


class BitacoraAlertas(Base):
    __tablename__ = "bitacora_alertas"

    id: Mapped[int] = mapped_column(primary_key=True)
    telemetria_id: Mapped[int] = mapped_column(ForeignKey("telemetrias.id"), nullable=False)
    estado: Mapped[EstadoAlerta] = mapped_column(
        Enum(EstadoAlerta, name="estado_alerta", native_enum=True),
        nullable=False,
        default=EstadoAlerta.ACTIVA,
    )
    observacion_hse: Mapped[str | None] = mapped_column(Text, nullable=True)
    usuario_resolutor_id: Mapped[int | None] = mapped_column(
        ForeignKey("usuarios.id"), nullable=True
    )
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    fecha_actualizacion: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    telemetria: Mapped["Telemetria"] = relationship(back_populates="alertas")
    usuario_resolutor: Mapped["Usuario"] = relationship(back_populates="alertas_resueltas")
