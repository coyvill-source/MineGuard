from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.punto_control import PuntoControl


class Estacion(Base):
    __tablename__ = "estaciones"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    activa: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    puntos_control: Mapped[list["PuntoControl"]] = relationship(
        back_populates="estacion", lazy="selectin"
    )
