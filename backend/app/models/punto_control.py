from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.estacion import Estacion
    from app.models.telemetria import Telemetria


class PuntoControl(Base):
    __tablename__ = "puntos_control"

    id: Mapped[int] = mapped_column(primary_key=True)
    estacion_id: Mapped[int] = mapped_column(ForeignKey("estaciones.id"), nullable=False)
    nombre_estacion: Mapped[str] = mapped_column(String(150), nullable=False)
    coord_x: Mapped[float] = mapped_column(Float, nullable=False)
    coord_y: Mapped[float] = mapped_column(Float, nullable=False)
    coord_z: Mapped[float] = mapped_column(Float, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    estacion: Mapped["Estacion"] = relationship(back_populates="puntos_control")
    telemetrias: Mapped[list["Telemetria"]] = relationship(
        back_populates="punto_control", lazy="selectin"
    )
