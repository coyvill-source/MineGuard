from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.telemetria import Telemetria


class ModeloML(Base):
    __tablename__ = "modelos_ml"

    id: Mapped[int] = mapped_column(primary_key=True)
    archivo_modelo: Mapped[str] = mapped_column(String(255), nullable=False)
    archivo_scaler: Mapped[str] = mapped_column(String(255), nullable=False)
    variables_entrada: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    fecha_carga: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    telemetrias: Mapped[list["Telemetria"]] = relationship(
        back_populates="modelo", lazy="selectin"
    )
