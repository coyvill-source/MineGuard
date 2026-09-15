from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.bitacora_alertas import BitacoraAlertas
    from app.models.modelo_ml import ModeloML
    from app.models.punto_control import PuntoControl


class NivelAlerta(str, enum.Enum):
    OPTIMO = "optimo"
    ALERTA = "alerta"
    CRITICO = "critico"


class EstadoValidacion(str, enum.Enum):
    VALIDO = "valido"
    DESCARTADO = "descartado"


class Telemetria(Base):
    __tablename__ = "telemetrias"

    id: Mapped[int] = mapped_column(primary_key=True)
    punto_id: Mapped[int] = mapped_column(ForeignKey("puntos_control.id"), nullable=False)
    modelo_id: Mapped[int | None] = mapped_column(ForeignKey("modelos_ml.id"), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    temperatura: Mapped[float] = mapped_column(Float, nullable=False)
    humedad: Mapped[float] = mapped_column(Float, nullable=False)
    bateria: Mapped[float] = mapped_column(Float, nullable=False)
    gas_crudo: Mapped[float] = mapped_column(Float, nullable=False)
    error_predicho: Mapped[float | None] = mapped_column(Float, nullable=True)
    gas_corregido: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Porcentaje de metano (gas_corregido en ppm / 10000), NULL si aun no
    # hay gas_corregido - ver app/core/umbrales.py.
    gas_corregido_porcentaje: Mapped[float | None] = mapped_column(Float, nullable=True)
    nivel_alerta: Mapped[NivelAlerta] = mapped_column(
        Enum(NivelAlerta, name="nivel_alerta", native_enum=True), nullable=False
    )
    estado_validacion: Mapped[EstadoValidacion] = mapped_column(
        Enum(EstadoValidacion, name="estado_validacion", native_enum=True), nullable=False
    )

    punto_control: Mapped["PuntoControl"] = relationship(back_populates="telemetrias")
    modelo: Mapped["ModeloML | None"] = relationship(back_populates="telemetrias")
    alertas: Mapped[list["BitacoraAlertas"]] = relationship(
        back_populates="telemetria", lazy="selectin"
    )
